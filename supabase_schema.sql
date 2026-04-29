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

-- =============================================
-- GPS-Based Smart Queue Demotion System
-- =============================================

-- Add GPS tracking columns to appointments
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_lat DOUBLE PRECISION;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS patient_lng DOUBLE PRECISION;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS location_tracking BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS was_warned BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS warned_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS was_demoted BOOLEAN DEFAULT false;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS demoted_at TIMESTAMPTZ;
ALTER TABLE appointments ADD COLUMN IF NOT EXISTS original_queue_number INTEGER;

-- Settings table for hospital GPS coordinates
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS on settings
ALTER TABLE settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can view settings" ON settings FOR SELECT USING (true);

-- Only admins can modify settings
CREATE POLICY "Admins can insert settings" ON settings FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);
CREATE POLICY "Admins can update settings" ON settings FOR UPDATE USING (
  EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
);

-- Seed default hospital coordinates (update with real values)
INSERT INTO settings (key, value) VALUES ('hospital_lat', '0') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('hospital_lng', '0') ON CONFLICT (key) DO NOTHING;
INSERT INTO settings (key, value) VALUES ('detection_radius', '50') ON CONFLICT (key) DO NOTHING;

-- Enable Realtime for settings table
ALTER PUBLICATION supabase_realtime ADD TABLE settings;

-- =============================================
-- Function: Demote patient in queue
-- Moves a patient DOWN by `demote_by` positions and shifts
-- patients in between UP by 1 position.
-- =============================================

CREATE OR REPLACE FUNCTION demote_patient_queue(
  p_appointment_id UUID,
  p_demote_by INTEGER DEFAULT 2
)
RETURNS JSON AS $$
DECLARE
  v_current_queue INTEGER;
  v_doctor_id UUID;
  v_max_queue INTEGER;
  v_new_queue INTEGER;
  v_original_queue INTEGER;
  v_today DATE := CURRENT_DATE;
BEGIN
  -- Get the current appointment details
  SELECT queue_number, doctor_id, COALESCE(original_queue_number, queue_number)
  INTO v_current_queue, v_doctor_id, v_original_queue
  FROM appointments
  WHERE id = p_appointment_id
    AND status = 'waiting';

  IF v_current_queue IS NULL THEN
    RETURN json_build_object('success', false, 'message', 'Appointment not found or not in waiting status');
  END IF;

  -- Get the max queue number for this doctor today
  SELECT COALESCE(MAX(queue_number), v_current_queue)
  INTO v_max_queue
  FROM appointments
  WHERE doctor_id = v_doctor_id
    AND status = 'waiting'
    AND created_at::date = v_today;

  -- Calculate new position (cap at max)
  v_new_queue := LEAST(v_current_queue + p_demote_by, v_max_queue);

  -- If already at the bottom, nothing to do
  IF v_new_queue <= v_current_queue THEN
    RETURN json_build_object('success', false, 'message', 'Patient is already at the bottom of the queue');
  END IF;

  -- Move patients between old and new position UP by 1
  UPDATE appointments
  SET queue_number = queue_number - 1,
      updated_at = NOW()
  WHERE doctor_id = v_doctor_id
    AND status = 'waiting'
    AND created_at::date = v_today
    AND queue_number > v_current_queue
    AND queue_number <= v_new_queue;

  -- Move the demoted patient to new position
  UPDATE appointments
  SET queue_number = v_new_queue,
      was_demoted = true,
      demoted_at = NOW(),
      original_queue_number = v_original_queue,
      updated_at = NOW()
  WHERE id = p_appointment_id;

  RETURN json_build_object(
    'success', true,
    'old_position', v_current_queue,
    'new_position', v_new_queue,
    'message', 'Patient demoted from #' || v_current_queue || ' to #' || v_new_queue
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
