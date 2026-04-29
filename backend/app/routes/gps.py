import math
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, require_admin
from app.config import get_supabase_client
from app.models import LocationUpdate, HospitalSettings

router = APIRouter(prefix="/api/queue", tags=["gps-queue"])


def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """
    Calculate the great-circle distance between two points
    on the Earth using the Haversine formula.
    Returns distance in meters.
    """
    R = 6371000  # Earth's radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (
        math.sin(delta_phi / 2) ** 2
        + math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2) ** 2
    )
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))

    return R * c


def get_hospital_coords():
    """Fetch hospital coordinates and detection radius from settings table."""
    supabase = get_supabase_client()
    result = supabase.table("settings").select("key, value").in_(
        "key", ["hospital_lat", "hospital_lng", "detection_radius"]
    ).execute()

    settings = {row["key"]: row["value"] for row in (result.data or [])}

    hospital_lat = float(settings.get("hospital_lat", "0"))
    hospital_lng = float(settings.get("hospital_lng", "0"))
    detection_radius = float(settings.get("detection_radius", "50"))

    return hospital_lat, hospital_lng, detection_radius


@router.post("/update-location")
async def update_location(data: LocationUpdate, user=Depends(get_current_user)):
    """
    Receive patient GPS coordinates and determine queue demotion logic.
    - If distance > radius and not warned: set warned
    - If distance > radius and warned for > 60s: demote
    - If distance <= radius: reset warning
    """
    supabase = get_supabase_client()

    # Fetch the appointment
    appt_result = supabase.table("appointments").select("*").eq(
        "id", data.appointment_id
    ).single().execute()

    if not appt_result.data:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Appointment not found",
        )

    appointment = appt_result.data

    # Only track waiting appointments
    if appointment.get("status") != "waiting":
        return {
            "distance": 0,
            "status": "not_tracking",
            "demoted": False,
            "message": "Location tracking only applies to waiting appointments.",
        }

    # Get hospital coordinates
    hospital_lat, hospital_lng, detection_radius = get_hospital_coords()

    # Check if hospital coordinates are configured
    if hospital_lat == 0 and hospital_lng == 0:
        return {
            "distance": 0,
            "status": "not_configured",
            "demoted": False,
            "message": "Hospital location not configured. Contact admin.",
        }

    # Calculate distance
    distance = haversine_distance(
        data.patient_lat, data.patient_lng, hospital_lat, hospital_lng
    )
    distance_rounded = round(distance, 1)

    # Update patient location in appointment
    supabase.table("appointments").update({
        "patient_lat": data.patient_lat,
        "patient_lng": data.patient_lng,
        "location_tracking": True,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }).eq("id", data.appointment_id).execute()

    # Already demoted — just return current status
    if appointment.get("was_demoted"):
        return {
            "distance": distance_rounded,
            "status": "demoted",
            "demoted": True,
            "old_position": appointment.get("original_queue_number"),
            "new_position": appointment.get("queue_number"),
            "message": f"Your token was previously moved. You are {distance_rounded}m from the hospital.",
        }

    # WITHIN range — clear any warning
    if distance <= detection_radius:
        if appointment.get("was_warned"):
            supabase.table("appointments").update({
                "was_warned": False,
                "warned_at": None,
                "updated_at": datetime.now(timezone.utc).isoformat(),
            }).eq("id", data.appointment_id).execute()

        return {
            "distance": distance_rounded,
            "status": "within_range",
            "demoted": False,
            "message": f"You are within hospital range ({distance_rounded}m).",
        }

    # OUTSIDE range
    if not appointment.get("was_warned"):
        # First warning
        supabase.table("appointments").update({
            "was_warned": True,
            "warned_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat(),
        }).eq("id", data.appointment_id).execute()

        return {
            "distance": distance_rounded,
            "status": "warned",
            "demoted": False,
            "message": f"Warning: You are {distance_rounded}m away from the hospital. Return within 60 seconds!",
        }

    # Already warned — check grace period
    warned_at = appointment.get("warned_at")
    if warned_at:
        warned_time = datetime.fromisoformat(warned_at.replace("Z", "+00:00"))
        now = datetime.now(timezone.utc)
        elapsed_seconds = (now - warned_time).total_seconds()

        if elapsed_seconds < 60:
            remaining = max(0, int(60 - elapsed_seconds))
            return {
                "distance": distance_rounded,
                "status": "grace_period",
                "demoted": False,
                "grace_remaining": remaining,
                "message": f"You are {distance_rounded}m away! Return within {remaining} seconds or your token will be moved down.",
            }

        # Grace period expired — DEMOTE
        demote_result = supabase.rpc("demote_patient_queue", {
            "p_appointment_id": data.appointment_id,
            "p_demote_by": 2,
        }).execute()

        demote_data = demote_result.data if demote_result.data else {}

        if isinstance(demote_data, dict) and demote_data.get("success"):
            return {
                "distance": distance_rounded,
                "status": "demoted",
                "demoted": True,
                "old_position": demote_data.get("old_position"),
                "new_position": demote_data.get("new_position"),
                "message": demote_data.get("message", "Your token has been moved down."),
            }
        else:
            return {
                "distance": distance_rounded,
                "status": "grace_period",
                "demoted": False,
                "message": demote_data.get("message", "Could not demote at this time.") if isinstance(demote_data, dict) else "Could not demote at this time.",
            }

    return {
        "distance": distance_rounded,
        "status": "warned",
        "demoted": False,
        "message": f"Warning: You are {distance_rounded}m away from the hospital.",
    }


@router.post("/set-hospital-location")
async def set_hospital_location(data: HospitalSettings, user=Depends(require_admin)):
    """Admin endpoint to configure hospital GPS coordinates and detection radius."""
    supabase = get_supabase_client()

    now = datetime.now(timezone.utc).isoformat()

    # Upsert hospital_lat
    supabase.table("settings").upsert({
        "key": "hospital_lat",
        "value": str(data.hospital_lat),
        "updated_at": now,
    }).execute()

    # Upsert hospital_lng
    supabase.table("settings").upsert({
        "key": "hospital_lng",
        "value": str(data.hospital_lng),
        "updated_at": now,
    }).execute()

    # Upsert detection_radius
    supabase.table("settings").upsert({
        "key": "detection_radius",
        "value": str(data.detection_radius),
        "updated_at": now,
    }).execute()

    return {
        "message": "Hospital location updated successfully",
        "hospital_lat": data.hospital_lat,
        "hospital_lng": data.hospital_lng,
        "detection_radius": data.detection_radius,
    }


@router.get("/hospital-location")
async def get_hospital_location():
    """Get the current hospital GPS coordinates and detection radius."""
    hospital_lat, hospital_lng, detection_radius = get_hospital_coords()

    return {
        "hospital_lat": hospital_lat,
        "hospital_lng": hospital_lng,
        "detection_radius": detection_radius,
        "is_configured": not (hospital_lat == 0 and hospital_lng == 0),
    }
