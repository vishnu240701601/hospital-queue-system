# MediQueue — Hospital Queue Management System

A full-stack hospital queue management web application with real-time queue tracking, QR code scanning, and dedicated portals for Patients, Doctors, and Admins.

## 🏗️ Tech Stack

| Layer      | Technology                          |
|------------|-------------------------------------|
| Frontend   | React.js (Vite) + Vanilla CSS      |
| Backend    | Python (FastAPI)                    |
| Database   | Supabase (PostgreSQL)              |
| Auth       | Supabase Auth + JWT                |
| Realtime   | Supabase Realtime Subscriptions    |
| Deploy     | Vercel (frontend) + Railway (backend) |

## 📁 Project Structure

```
├── frontend/           # React + Vite app
│   ├── src/
│   │   ├── components/ # Navbar, ProtectedRoute
│   │   ├── context/    # AuthContext
│   │   ├── lib/        # Supabase client
│   │   └── pages/      # All portal pages
│   │       ├── auth/       # Login, Register
│   │       ├── patient/    # Departments, DoctorSelection, Queue, QR Scanner
│   │       ├── doctor/     # Dashboard, History
│   │       └── admin/      # Dashboard, Departments, Doctors, Appointments
│   ├── vercel.json
│   └── .env.example
├── backend/            # FastAPI app
│   ├── app/
│   │   ├── routes/     # API endpoints
│   │   ├── auth.py     # JWT middleware
│   │   ├── config.py   # Supabase config
│   │   └── models.py   # Pydantic schemas
│   ├── main.py
│   ├── requirements.txt
│   └── .env.example
└── supabase_schema.sql # Database setup script
```

## 🚀 Getting Started

### 1. Set Up Supabase

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** → paste and run `supabase_schema.sql`
3. Go to **Settings → API** to get your URL, anon key, and JWT secret
4. Go to **Settings → API → Service Role Key** for the backend

### 2. Frontend Setup

```bash
cd frontend
cp .env.example .env
# Edit .env with your Supabase URL and anon key
npm install
npm run dev
```

### 3. Backend Setup

```bash
cd backend
cp .env.example .env
# Edit .env with your Supabase URL, service role key, and JWT secret
pip install -r requirements.txt
uvicorn main:app --reload
```

### 4. Create Admin User

1. Register a new account on the app
2. In Supabase SQL Editor, run:
   ```sql
   UPDATE profiles SET role = 'admin' WHERE email = 'your-admin-email@example.com';
   ```

## 🔐 Portals

### Patient Portal (`/patient`)
- Browse hospital departments
- Scan department QR codes with camera
- Select available doctors and book appointments
- Real-time queue position and estimated wait time

### Doctor Portal (`/doctor`)
- View live patient queue
- "Attend Next Patient" workflow
- Toggle on/off duty status
- View completed patient history

### Admin Portal (`/admin`)
- Dashboard with live statistics
- Manage departments (CRUD + QR code generation)
- Manage doctors (assign to departments)
- View all appointments (today + history)

## 🌐 Deployment

### Frontend → Vercel
```bash
cd frontend
vercel --prod
```
Set env vars `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in Vercel dashboard.

### Backend → Railway
```bash
cd backend
railway up
```
Set env vars `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_JWT_SECRET`, and `FRONTEND_URL` in Railway dashboard.
