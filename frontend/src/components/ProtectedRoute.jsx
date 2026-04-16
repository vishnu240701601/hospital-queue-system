import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="loading-spinner">
        <div className="spinner"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles && profile && !allowedRoles.includes(profile.role)) {
    // Redirect to appropriate dashboard based on role
    const roleRoutes = {
      patient: '/patient',
      doctor: '/doctor',
      admin: '/admin'
    };
    return <Navigate to={roleRoutes[profile.role] || '/login'} replace />;
  }

  return children;
}
