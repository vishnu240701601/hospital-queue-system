from fastapi import APIRouter, Depends, HTTPException, status
from datetime import date, datetime
from app.auth import get_current_user, require_doctor, require_admin
from app.config import get_supabase_client
from app.models import AppointmentCreate, AppointmentStatusUpdate

router = APIRouter(prefix="/api/appointments", tags=["appointments"])


@router.get("/")
async def list_appointments(
    today_only: bool = True,
    department_id: str = None,
    status_filter: str = None,
    user=Depends(get_current_user),
):
    """List appointments based on role and filters."""
    supabase = get_supabase_client()
    query = supabase.table("appointments").select(
        "*, patient:profiles!appointments_patient_id_fkey(name, email), "
        "doctor:doctors(specialization, profile:profiles(name)), "
        "department:departments(name, icon)"
    )

    # Role-based filtering
    if user["role"] == "patient":
        query = query.eq("patient_id", user["id"])
    elif user["role"] == "doctor":
        doc = supabase.table("doctors").select("id").eq("profile_id", user["id"]).single().execute()
        if doc.data:
            query = query.eq("doctor_id", doc.data["id"])
    # Admin sees all

    if today_only:
        today = date.today().isoformat()
        query = query.gte("created_at", today)

    if department_id:
        query = query.eq("department_id", department_id)

    if status_filter:
        query = query.eq("status", status_filter)

    result = query.order("created_at", desc=True).execute()
    return result.data


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_appointment(appt: AppointmentCreate, user=Depends(get_current_user)):
    """Book a new appointment (patient)."""
    if user["role"] != "patient":
        raise HTTPException(status_code=403, detail="Only patients can book appointments")

    supabase = get_supabase_client()
    today = date.today().isoformat()

    # Check for duplicate
    existing = supabase.table("appointments").select("id").eq(
        "patient_id", user["id"]
    ).eq("doctor_id", appt.doctor_id).in_(
        "status", ["waiting", "in-progress"]
    ).gte("created_at", today).execute()

    if existing.data:
        raise HTTPException(status_code=409, detail="You already have an active appointment with this doctor today")

    # Get next queue number
    queue_result = supabase.rpc("get_next_queue_number", {"p_doctor_id": appt.doctor_id}).execute()
    queue_number = queue_result.data if queue_result.data else 1

    result = supabase.table("appointments").insert({
        "patient_id": user["id"],
        "doctor_id": appt.doctor_id,
        "department_id": appt.department_id,
        "status": "waiting",
        "queue_number": queue_number,
    }).execute()

    return result.data[0] if result.data else None


@router.put("/{appt_id}/status")
async def update_appointment_status(
    appt_id: str,
    update: AppointmentStatusUpdate,
    user=Depends(get_current_user),
):
    """Update appointment status (doctor or admin)."""
    if user["role"] not in ("doctor", "admin"):
        raise HTTPException(status_code=403, detail="Not authorized")

    if update.status not in ("waiting", "in-progress", "completed"):
        raise HTTPException(status_code=400, detail="Invalid status")

    supabase = get_supabase_client()
    result = supabase.table("appointments").update({
        "status": update.status,
        "updated_at": datetime.utcnow().isoformat(),
    }).eq("id", appt_id).execute()

    return result.data[0] if result.data else None


@router.get("/doctor/queue")
async def get_doctor_queue(user=Depends(require_doctor)):
    """Get the current doctor's queue for today."""
    supabase = get_supabase_client()
    today = date.today().isoformat()

    doc = supabase.table("doctors").select("id").eq("profile_id", user["id"]).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Doctor record not found")

    result = supabase.table("appointments").select(
        "*, patient:profiles!appointments_patient_id_fkey(name, email)"
    ).eq("doctor_id", doc.data["id"]).in_(
        "status", ["waiting", "in-progress"]
    ).gte("created_at", today).order("queue_number").execute()

    return result.data


@router.post("/doctor/attend-next")
async def attend_next_patient(user=Depends(require_doctor)):
    """Complete current patient and move to next in queue."""
    supabase = get_supabase_client()
    today = date.today().isoformat()

    doc = supabase.table("doctors").select("id").eq("profile_id", user["id"]).single().execute()
    if not doc.data:
        raise HTTPException(status_code=404, detail="Doctor record not found")

    doctor_id = doc.data["id"]

    # Complete current in-progress patient
    in_progress = supabase.table("appointments").select("id").eq(
        "doctor_id", doctor_id
    ).eq("status", "in-progress").gte("created_at", today).execute()

    if in_progress.data:
        for appt in in_progress.data:
            supabase.table("appointments").update({
                "status": "completed",
                "updated_at": datetime.utcnow().isoformat(),
            }).eq("id", appt["id"]).execute()

    # Get next waiting patient
    next_patient = supabase.table("appointments").select("id").eq(
        "doctor_id", doctor_id
    ).eq("status", "waiting").gte("created_at", today).order("queue_number").limit(1).execute()

    if next_patient.data:
        supabase.table("appointments").update({
            "status": "in-progress",
            "updated_at": datetime.utcnow().isoformat(),
        }).eq("id", next_patient.data[0]["id"]).execute()
        return {"message": "Next patient called", "appointment_id": next_patient.data[0]["id"]}

    return {"message": "No more patients in queue"}
