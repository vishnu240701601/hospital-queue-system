import { Link } from 'react-router-dom';
import { FiArrowRight, FiShield, FiClock, FiSmartphone } from 'react-icons/fi';

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Hero */}
      <div style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '2rem',
        background: `
          radial-gradient(ellipse at 30% 20%, rgba(99, 102, 241, 0.15) 0%, transparent 50%),
          radial-gradient(ellipse at 70% 80%, rgba(6, 182, 212, 0.1) 0%, transparent 50%),
          var(--bg-primary)
        `,
      }}>
        <div style={{
          width: 72, height: 72,
          background: 'linear-gradient(135deg, var(--primary), var(--accent))',
          borderRadius: 'var(--radius-lg)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '2rem', marginBottom: '1.5rem',
          boxShadow: '0 0 40px var(--primary-glow)',
          animation: 'slideUp 0.5s ease',
        }}>
          🏥
        </div>

        <h1 style={{
          fontSize: 'clamp(2rem, 5vw, 3.5rem)',
          fontWeight: 800,
          lineHeight: 1.1,
          marginBottom: '1rem',
          background: 'linear-gradient(135deg, var(--text-primary), var(--primary-light))',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: 'slideUp 0.6s ease',
        }}>
          MediQueue
        </h1>

        <p style={{
          fontSize: 'clamp(1rem, 2vw, 1.2rem)',
          color: 'var(--text-secondary)',
          maxWidth: '600px',
          marginBottom: '2.5rem',
          lineHeight: 1.7,
          animation: 'slideUp 0.7s ease',
        }}>
          Smart Hospital Queue Management System. Reduce wait times, streamline appointments, and enhance patient experience with real-time queue tracking.
        </p>

        <div style={{
          display: 'flex', gap: '1rem', flexWrap: 'wrap',
          justifyContent: 'center',
          animation: 'slideUp 0.8s ease',
        }}>
          <Link to="/login" className="btn btn-primary btn-lg">
            Sign In <FiArrowRight />
          </Link>
          <Link to="/register" className="btn btn-secondary btn-lg">
            Create Account
          </Link>
        </div>

        {/* Features */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
          gap: '1.5rem',
          maxWidth: '900px',
          width: '100%',
          marginTop: '4rem',
          animation: 'slideUp 0.9s ease',
        }}>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
              <FiClock color="var(--primary-light)" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Real-Time Tracking</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Monitor your queue position and estimated wait time live.
            </p>
          </div>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
              <FiSmartphone color="var(--accent-light)" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>QR Code Check-In</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              Scan department QR codes to instantly find and book doctors.
            </p>
          </div>
          <div className="glass-card" style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '0.75rem' }}>
              <FiShield color="var(--success-light)" />
            </div>
            <h3 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.5rem' }}>Secure & Reliable</h3>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
              JWT authentication with role-based access for patients, doctors, and admins.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
