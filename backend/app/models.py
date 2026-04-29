from pydantic import BaseModel
from typing import Optional
from datetime import datetime


class DepartmentCreate(BaseModel):
    name: str
    description: Optional[str] = ""
    icon: Optional[str] = "🏥"


class DepartmentUpdate(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    icon: Optional[str] = None


class DoctorCreate(BaseModel):
    profile_email: str
    department_id: str
    specialization: Optional[str] = ""
    is_available: Optional[bool] = True


class DoctorUpdate(BaseModel):
    department_id: Optional[str] = None
    specialization: Optional[str] = None
    is_available: Optional[bool] = None


class AppointmentCreate(BaseModel):
    doctor_id: str
    department_id: str


class AppointmentStatusUpdate(BaseModel):
    status: str  # waiting, in-progress, completed


class LocationUpdate(BaseModel):
    appointment_id: str
    patient_lat: float
    patient_lng: float


class HospitalSettings(BaseModel):
    hospital_lat: float
    hospital_lng: float
    detection_radius: Optional[float] = 50.0

