from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, require_admin, require_doctor
from app.config import get_supabase_client
from app.models import DoctorCreate, DoctorUpdate

router = APIRouter(prefix="/api/doctors", tags=["doctors"])


@router.get("/")
async def list_doctors(department_id: str = None, available_only: bool = False):
    """List doctors, optionally filtered by department and availability."""
    supabase = get_supabase_client()
    query = supabase.table("doctors").select("*, profile:profiles(name, email), department:departments(name, icon)")

    if department_id:
        query = query.eq("department_id", department_id)
    if available_only:
        query = query.eq("is_available", True)

    result = query.execute()
    return result.data


@router.get("/me")
async def get_my_doctor_record(user=Depends(require_doctor)):
    """Get the current doctor's record."""
    supabase = get_supabase_client()
    result = supabase.table("doctors").select(
        "*, department:departments(name, icon)"
    ).eq("profile_id", user["id"]).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Doctor record not found")
    return result.data


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_doctor(doctor: DoctorCreate, user=Depends(require_admin)):
    """Add a new doctor (admin only). Requires the user to exist in profiles."""
    supabase = get_supabase_client()

    # Find profile by email
    profile_result = supabase.table("profiles").select("id, role").eq(
        "email", doctor.profile_email
    ).single().execute()

    if not profile_result.data:
        raise HTTPException(status_code=404, detail="User not found with that email")

    profile_id = profile_result.data["id"]

    # Update role to doctor if needed
    if profile_result.data["role"] != "doctor":
        supabase.table("profiles").update({"role": "doctor"}).eq("id", profile_id).execute()

    # Create doctor record
    result = supabase.table("doctors").insert({
        "profile_id": profile_id,
        "department_id": doctor.department_id,
        "specialization": doctor.specialization,
        "is_available": doctor.is_available,
    }).execute()

    return result.data[0] if result.data else None


@router.put("/{doctor_id}")
async def update_doctor(doctor_id: str, doctor: DoctorUpdate, user=Depends(get_current_user)):
    """Update a doctor record. Admins can update any, doctors can update their own."""
    supabase = get_supabase_client()

    # Check permissions
    if user["role"] != "admin":
        doc_result = supabase.table("doctors").select("profile_id").eq("id", doctor_id).single().execute()
        if not doc_result.data or doc_result.data["profile_id"] != user["id"]:
            raise HTTPException(status_code=403, detail="Not authorized")

    update_data = {k: v for k, v in doctor.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("doctors").update(update_data).eq("id", doctor_id).execute()
    return result.data[0] if result.data else None


@router.delete("/{doctor_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_doctor(doctor_id: str, user=Depends(require_admin)):
    """Delete a doctor record (admin only)."""
    supabase = get_supabase_client()
    supabase.table("doctors").delete().eq("id", doctor_id).execute()
    return None
