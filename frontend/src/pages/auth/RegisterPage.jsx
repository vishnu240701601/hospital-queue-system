import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { FiUser, FiActivity, FiShield } from 'react-icons/fi';

export default function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('patient');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const { signUp } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      setLoading(false);
      return;
    }

    try {
      await signUp({ email, password, name, role });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.message || 'Failed to create account');
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="auth-logo" style={{
            width: 56, height: 56,
            background: 'linear-gradient(135deg, var(--success), #059669)',
            borderRadius: 'var(--radius-lg)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '1.6rem', margin: '0 auto 1rem',
          }}>✓</div>
          <h2 style={{ marginBottom: '0.5rem' }}>Account Created!</h2>
          <p style={{ color: 'var(--text-secondary)' }}>
            Please check your email to verify your account, then sign in.
          </p>
          <Link to="/login" className="btn btn-primary" style={{ marginTop: '1.5rem' }}>
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-logo" style={{ background: 'transparent', boxShadow: 'none' }}>
            <img src="/logo.png" alt="logo" style={{width: '100%', height: '100%', objectFit: 'contain'}} />
          </div>
          <h1>Create Account</h1>
          <p>Join MediQueue Hospital System</p>
        </div>

        {error && <div className="auth-error">{error}</div>}

        <form onSubmit={handleSubmit}>
          
          <div className="form-group" style={{ marginBottom: '1.5rem' }}>
            <label className="form-label">I am registering as a</label>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.75rem', marginTop: '0.5rem' }}>
              <div 
                onClick={() => setRole('patient')}
                style={{
                  padding: '1rem 0.5rem', border: `2px solid ${role === 'patient' ? 'var(--primary)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', background: role === 'patient' ? 'rgba(99,102,241,0.1)' : 'var(--bg-input)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                }}
              >
                <FiUser size={24} color={role === 'patient' ? 'var(--primary-light)' : 'var(--text-secondary)'} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: role === 'patient' ? 'white' : 'var(--text-secondary)' }}>Patient</div>
              </div>

              <div 
                onClick={() => setRole('doctor')}
                style={{
                  padding: '1rem 0.5rem', border: `2px solid ${role === 'doctor' ? 'var(--accent)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', background: role === 'doctor' ? 'rgba(6,182,212,0.1)' : 'var(--bg-input)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                }}
              >
                <FiActivity size={24} color={role === 'doctor' ? 'var(--accent-light)' : 'var(--text-secondary)'} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: role === 'doctor' ? 'white' : 'var(--text-secondary)' }}>Doctor</div>
              </div>

              <div 
                onClick={() => setRole('admin')}
                style={{
                  padding: '1rem 0.5rem', border: `2px solid ${role === 'admin' ? 'var(--danger)' : 'var(--border)'}`,
                  borderRadius: 'var(--radius-md)', background: role === 'admin' ? 'rgba(239,68,68,0.1)' : 'var(--bg-input)',
                  cursor: 'pointer', textAlign: 'center', transition: 'all 0.2s'
                }}
              >
                <FiShield size={24} color={role === 'admin' ? 'var(--danger-light)' : 'var(--text-secondary)'} style={{ marginBottom: '0.5rem' }} />
                <div style={{ fontSize: '0.85rem', fontWeight: 600, color: role === 'admin' ? 'white' : 'var(--text-secondary)' }}>Admin</div>
              </div>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-name">Full Name</label>
            <input
              id="reg-name"
              type="text"
              className="form-input"
              placeholder="Enter your full name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-email">Email</label>
            <input
              id="reg-email"
              type="email"
              className="form-input"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="reg-password">Password</label>
            <input
              id="reg-password"
              type="password"
              className="form-input"
              placeholder="Minimum 6 characters"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
          </div>

          <button
            type="submit"
            className="btn btn-primary btn-lg"
            style={{ width: '100%' }}
            disabled={loading}
          >
            {loading ? 'Creating Account...' : 'Create Account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Sign In</Link>
        </div>
      </div>
    </div>
  );
}
