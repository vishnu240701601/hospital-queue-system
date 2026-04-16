from fastapi import APIRouter, Depends, HTTPException, status
from app.auth import get_current_user, require_admin
from app.config import get_supabase_client
from app.models import DepartmentCreate, DepartmentUpdate

router = APIRouter(prefix="/api/departments", tags=["departments"])


@router.get("/")
async def list_departments():
    """List all departments."""
    supabase = get_supabase_client()
    result = supabase.table("departments").select("*").order("name").execute()
    return result.data


@router.get("/{dept_id}")
async def get_department(dept_id: str):
    """Get a single department by ID."""
    supabase = get_supabase_client()
    result = supabase.table("departments").select("*").eq("id", dept_id).single().execute()
    if not result.data:
        raise HTTPException(status_code=404, detail="Department not found")
    return result.data


@router.post("/", status_code=status.HTTP_201_CREATED)
async def create_department(dept: DepartmentCreate, user=Depends(require_admin)):
    """Create a new department (admin only)."""
    supabase = get_supabase_client()
    result = supabase.table("departments").insert({
        "name": dept.name,
        "description": dept.description,
        "icon": dept.icon,
    }).execute()
    return result.data[0] if result.data else None


@router.put("/{dept_id}")
async def update_department(dept_id: str, dept: DepartmentUpdate, user=Depends(require_admin)):
    """Update a department (admin only)."""
    supabase = get_supabase_client()
    update_data = {k: v for k, v in dept.model_dump().items() if v is not None}
    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    result = supabase.table("departments").update(update_data).eq("id", dept_id).execute()
    return result.data[0] if result.data else None


@router.delete("/{dept_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_department(dept_id: str, user=Depends(require_admin)):
    """Delete a department (admin only)."""
    supabase = get_supabase_client()
    supabase.table("departments").delete().eq("id", dept_id).execute()
    return None
