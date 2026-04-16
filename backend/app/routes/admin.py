from fastapi import APIRouter, Depends
from datetime import date
from app.auth import require_admin
from app.config import get_supabase_client

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/stats")
async def get_admin_stats(user=Depends(require_admin)):
    """Get admin dashboard statistics."""
    supabase = get_supabase_client()
    today = date.today().isoformat()

    # Doctors on duty
    doctors_on_duty = supabase.table("doctors").select(
        "id", count="exact"
    ).eq("is_available", True).execute()

    # Total patients today
    total_today = supabase.table("appointments").select(
        "id", count="exact"
    ).gte("created_at", today).execute()

    # Waiting count
    waiting = supabase.table("appointments").select(
        "id", count="exact"
    ).eq("status", "waiting").gte("created_at", today).execute()

    # Completed count
    completed = supabase.table("appointments").select(
        "id", count="exact"
    ).eq("status", "completed").gte("created_at", today).execute()

    # Department-wise stats
    departments = supabase.table("departments").select("id, name, icon").execute()
    dept_stats = []

    for dept in (departments.data or []):
        d_waiting = supabase.table("appointments").select(
            "id", count="exact"
        ).eq("department_id", dept["id"]).eq("status", "waiting").gte(
            "created_at", today
        ).execute()

        d_in_progress = supabase.table("appointments").select(
            "id", count="exact"
        ).eq("department_id", dept["id"]).eq("status", "in-progress").gte(
            "created_at", today
        ).execute()

        d_completed = supabase.table("appointments").select(
            "id", count="exact"
        ).eq("department_id", dept["id"]).eq("status", "completed").gte(
            "created_at", today
        ).execute()

        dept_stats.append({
            "id": dept["id"],
            "name": dept["name"],
            "icon": dept["icon"],
            "waiting": d_waiting.count or 0,
            "in_progress": d_in_progress.count or 0,
            "completed": d_completed.count or 0,
        })

    return {
        "doctors_on_duty": doctors_on_duty.count or 0,
        "total_patients_today": total_today.count or 0,
        "total_waiting": waiting.count or 0,
        "total_completed": completed.count or 0,
        "departments": dept_stats,
    }
