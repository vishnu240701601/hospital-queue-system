import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { FiLogOut } from 'react-icons/fi';

export default function Navbar() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  if (!profile) return null;

  const handleSignOut = async () => {
    await signOut();
    navigate('/login');
  };

  const navLinks = {
    patient: [
      { to: '/patient', label: 'Departments' },
      { to: '/patient/history', label: 'My History' },
    ],
    doctor: [
      { to: '/doctor', label: 'Dashboard' },
      { to: '/doctor/history', label: 'History' },
    ],
    admin: [
      { to: '/admin', label: 'Dashboard' },
      { to: '/admin/departments', label: 'Departments' },
      { to: '/admin/doctors', label: 'Doctors' },
      { to: '/admin/appointments', label: 'Appointments' },
    ],
  };

  const links = navLinks[profile.role] || [];

  return (
    <nav className="navbar">
      <Link to={`/${profile.role}`} className="navbar-brand">
        <img src="/logo.png" alt="logo" style={{width: 32, height: 32, marginRight: '0.5rem', objectFit: 'contain'}} />
        <span>MediQueue</span>
      </Link>

      <div className="navbar-nav">
        {links.map((link) => (
          <Link
            key={link.to}
            to={link.to}
            className={`nav-link ${location.pathname === link.to ? 'active' : ''}`}
          >
            {link.label}
          </Link>
        ))}
      </div>

      <div className="navbar-user">
        <div style={{ textAlign: 'right' }}>
          <div className="user-name">{profile.name}</div>
          <div className="user-role">{profile.role}</div>
        </div>
        <button className="btn btn-icon btn-secondary" onClick={handleSignOut} title="Sign Out">
          <FiLogOut />
        </button>
      </div>
    </nav>
  );
}
