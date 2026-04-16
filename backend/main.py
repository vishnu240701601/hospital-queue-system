from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.config import FRONTEND_URL
from app.routes import departments, doctors, appointments, admin

app = FastAPI(
    title="MediQueue API",
    description="Hospital Queue Management System Backend",
    version="1.0.0",
)

# CORS configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        FRONTEND_URL,
        "http://localhost:5173",
        "http://localhost:3000",
        "https://mediqueue-two-beta.vercel.app",
        "https://mediqueue-js3z9i8ym-vishnud09122006-1748s-projects.vercel.app",
        "https://mediqueue-360.netlify.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register routers
app.include_router(departments.router)
app.include_router(doctors.router)
app.include_router(appointments.router)
app.include_router(admin.router)


@app.get("/")
async def root():
    return {
        "name": "MediQueue API",
        "version": "1.0.0",
        "status": "running",
        "docs": "/docs",
    }


@app.get("/health")
async def health_check():
    return {"status": "healthy"}
