import { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import LandingPage from './pages/LandingPage';
import LoginPage from './pages/auth/LoginPage';
import RegisterPage from './pages/auth/RegisterPage';

// Patient
import PatientDepartments from './pages/patient/PatientDepartments';
import DoctorSelection from './pages/patient/DoctorSelection';
import PatientAppointmentTracker from './pages/patient/PatientAppointmentTracker';
import PatientHistory from './pages/patient/PatientHistory';

// Doctor
import DoctorDashboard from './pages/doctor/DoctorDashboard';
import DoctorHistory from './pages/doctor/DoctorHistory';

// Admin
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminDepartments from './pages/admin/AdminDepartments';
import AdminDoctors from './pages/admin/AdminDoctors';
import AdminAppointments from './pages/admin/AdminAppointments';
import AdminSettings from './pages/admin/AdminSettings';

function AppRoutes() {
  const { user, profile, loading } = useAuth();
  const location = useLocation();

  useEffect(() => {
    document.body.className = '';
    if (location.pathname.startsWith('/admin')) {
      document.body.classList.add('bg-admin');
    } else if (location.pathname.startsWith('/doctor')) {
      document.body.classList.add('bg-doctor');
    }
  }, [location.pathname]);

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh', display: 'flex', alignItems: 'center',
        justifyContent: 'center', background: 'var(--bg-primary)',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ margin: '0 auto 1rem' }}></div>
          <p style={{ color: 'var(--text-secondary)' }}>Loading MediQueue...</p>
        </div>
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/" element={user ? <Navigate to={`/${profile?.role || 'patient'}`} /> : <LandingPage />} />
      <Route path="/login" element={user ? <Navigate to={`/${profile?.role || 'patient'}`} /> : <LoginPage />} />
      <Route path="/register" element={user ? <Navigate to={`/${profile?.role || 'patient'}`} /> : <RegisterPage />} />

      {/* Patient Routes */}
      <Route path="/patient" element={
        <ProtectedRoute allowedRoles={['patient']}>
          <PatientDepartments />
        </ProtectedRoute>
      } />
      <Route path="/patient/doctors/:departmentId" element={
        <ProtectedRoute allowedRoles={['patient']}>
          <DoctorSelection />
        </ProtectedRoute>
      } />
      <Route path="/patient/queue/:appointmentId" element={
        <ProtectedRoute allowedRoles={['patient']}>
          <PatientAppointmentTracker />
        </ProtectedRoute>
      } />
      <Route path="/patient/history" element={
        <ProtectedRoute allowedRoles={['patient']}>
          <PatientHistory />
        </ProtectedRoute>
      } />

      {/* Doctor Routes */}
      <Route path="/doctor" element={
        <ProtectedRoute allowedRoles={['doctor']}>
          <DoctorDashboard />
        </ProtectedRoute>
      } />
      <Route path="/doctor/history" element={
        <ProtectedRoute allowedRoles={['doctor']}>
          <DoctorHistory />
        </ProtectedRoute>
      } />

      {/* Admin Routes */}
      <Route path="/admin" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDashboard />
        </ProtectedRoute>
      } />
      <Route path="/admin/departments" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDepartments />
        </ProtectedRoute>
      } />
      <Route path="/admin/doctors" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminDoctors />
        </ProtectedRoute>
      } />
      <Route path="/admin/appointments" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminAppointments />
        </ProtectedRoute>
      } />
      <Route path="/admin/settings" element={
        <ProtectedRoute allowedRoles={['admin']}>
          <AdminSettings />
        </ProtectedRoute>
      } />

      {/* Catch all */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
}
