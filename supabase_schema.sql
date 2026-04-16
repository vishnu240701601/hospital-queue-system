-- =============================================
-- Hospital Queue Management System - Supabase Schema
-- Run this in the Supabase SQL Editor
-- =============================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. Profiles table (extends Supabase Auth)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL CHECK (role IN ('patient', 'doctor', 'admin')) DEFAULT 'patient',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Departments table
CREATE TABLE IF NOT EXISTS departments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL UNIQUE,
  description TEXT DEFAULT '',
  icon TEXT DEFAULT '🏥',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Doctors table
CREATE TABLE IF NOT EXISTS doctors (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  profile_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  specialization TEXT DEFAULT '',
  is_available BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(profile_id)
);

-- 4. Appointments table
CREATE TABLE IF NOT EXISTS appointments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  patient_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  doctor_id UUID NOT NULL REFERENCES doctors(id) ON DELETE CASCADE,
  department_id UUID NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  status TEXT NOT NULL CHECK (status IN ('waiting', 'in-progress', 'completed')) DEFAULT 'waiting',
  queue_number INTEGER NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- =============================================
-- Row Level Security Policies
-- =============================================

ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE doctors ENABLE ROW LEVEL SECURITY;
ALTER TABLE appointments ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read all, update own
CREATE POLICY "Anyone can view profiles" ON profiles FOR SELECT USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE USING (auth.uid() = id);
CREATE POLICY "Enable insert for auth users" ON profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Departments: anyone can read, admins can modify
CREATE POLICY "Anyone can view departments" ON departments FOR SELECT USING (true);
CREATE POLICY "Admins can insert departments" ON departments FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update departments" ON departments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can delete departments" ON departments FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Doctors: anyone can read, admins can modify
CREATE POLICY "Anyone can view doctors" ON doctors FOR SELECT USING (true);
CREATE POLICY "Admins can insert doctors" ON doctors FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update doctors" ON doctors FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  OR profile_id = auth.uid()
);
CREATE POLICY "Admins can delete doctors" ON doctors FOR DELETE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Appointments: patients see own, doctors see assigned, admins see all
CREATE POLICY "Patients can view own appointments" ON appointments FOR SELECT USING (
  patient_id = auth.uid()
  OR EXISTS (SELECT 1 FROM doctors WHERE doctors.id = appointments.doctor_id AND doctors.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Patients can insert appointments" ON appointments FOR INSERT WITH CHECK (
  patient_id = auth.uid()
);
CREATE POLICY "Doctors and admins can update appointments" ON appointments FOR UPDATE USING (
  EXISTS (SELECT 1 FROM doctors WHERE doctors.id = appointments.doctor_id AND doctors.profile_id = auth.uid())
  OR EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- =============================================
-- Function to auto-create profile on signup
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', 'User'),
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'role', 'patient')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to auto-create profile
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =============================================
-- Function to get next queue number for a doctor today
-- =============================================

CREATE OR REPLACE FUNCTION get_next_queue_number(p_doctor_id UUID)
RETURNS INTEGER AS $$
DECLARE
  next_num INTEGER;
BEGIN
  SELECT COALESCE(MAX(queue_number), 0) + 1 INTO next_num
  FROM appointments
  WHERE doctor_id = p_doctor_id
    AND created_at::date = CURRENT_DATE;
  RETURN next_num;
END;
$$ LANGUAGE plpgsql;

-- =============================================
-- Enable Realtime for appointments table
-- =============================================

ALTER PUBLICATION supabase_realtime ADD TABLE appointments;

-- =============================================
-- Seed data: Create an admin user profile
-- (You will need to sign up an admin user first via Auth,
--  then update their role here)
-- =============================================

-- Example: UPDATE profiles SET role = 'admin' WHERE email = 'admin@hospital.com';

-- =============================================
-- Feature Additions (Patient Flow & Receipts)
-- =============================================

-- Add columns for receipts and doctor flow
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS completed_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS doctor_notes TEXT;

-- Create view for patient receipts
CREATE OR REPLACE VIEW patient_receipts AS
SELECT 
  a.id,
  a.patient_id,
  a.doctor_id,
  a.department_id,
  a.queue_number,
  a.created_at,
  a.completed_at,
  a.doctor_notes,
  p.name as patient_name,
  doc_profile.name as doctor_name,
  d.name as department_name
FROM appointments a
JOIN profiles p ON a.patient_id = p.id
JOIN doctors doc ON a.doctor_id = doc.id
JOIN profiles doc_profile ON doc.profile_id = doc_profile.id
JOIN departments d ON a.department_id = d.id
WHERE a.status = 'completed';
