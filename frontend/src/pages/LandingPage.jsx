import { Link } from 'react-router-dom';
import { FiArrowRight, FiShield, FiClock, FiSmartphone, FiMapPin, FiPhone, FiMail } from 'react-icons/fi';

export default function LandingPage() {
  const scrollTo = (id) => {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh' }}>
      {/* Dynamic Navbar placed at the top */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0,
        height: '60px', background: 'transparent',
        display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
        padding: '0 2rem', zIndex: 1000
      }}>
        <div style={{ display: 'flex', gap: '1.5rem', alignItems: 'center' }}>
          <button style={{background:'transparent', color:'var(--text-primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', border: 'none'}} onClick={() => scrollTo('home')}>Home</button>
          <button style={{background:'transparent', color:'var(--text-primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', border: 'none'}} onClick={() => scrollTo('about')}>About</button>
          <button style={{background:'transparent', color:'var(--text-primary)', fontWeight: 600, fontSize: '1rem', cursor: 'pointer', border: 'none'}} onClick={() => scrollTo('contact')}>Contact</button>
        </div>
      </nav>

      {/* Hero */}
      <div id="home" style={{
        minHeight: '100vh',
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '2rem',
        background: `
          linear-gradient(rgba(15, 15, 26, 0.8), rgba(15, 15, 26, 0.95)),
          url('/hospital-bg.png') center/cover no-repeat fixed
        `,
      }}>
        <div style={{
          width: 80, height: 80,
          marginBottom: '1.5rem',
          animation: 'slideUp 0.5s ease',
        }}>
          <img src="/logo.png" alt="MediQueue Logo" style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
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

      {/* About Section */}
      <section id="about" style={{
        padding: '5rem 2rem', 
        background: 'var(--bg-secondary)', 
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        textAlign: 'center'
      }}>
        <div style={{ maxWidth: '800px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1.5rem', color: 'var(--text-primary)' }}>
            About MediQueue Hospital
          </h2>
          <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)', lineHeight: 1.8, marginBottom: '2rem' }}>
            MediQueue Hospital is built on the philosophy that a patient's healing journey begins the moment they arrive. We eliminated the stressful crowded waiting rooms and replaced them with an intelligent, emotionally-aware queueing system. By automating the triage and queuing logistics, we let doctors focus entirely on what matters most: saving lives and improving wellbeing.
          </p>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" style={{
        padding: '5rem 2rem', 
        background: 'var(--bg-primary)', 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center'
      }}>
        <div style={{ textAlign: 'center', marginBottom: '3rem', maxWidth: '700px' }}>
          <h2 style={{ fontSize: '2.5rem', fontWeight: 800, marginBottom: '1rem' }}>Contact Us</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '1.1rem' }}>Reach out to our administrative desk for general inquiries, emergency contacts, or feedback.</p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '2rem', width: '100%', maxWidth: '900px' }}>
          
          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              <FiMapPin color="var(--primary-light)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Our Address</h3>
            <p style={{ color: 'var(--text-secondary)' }}>123 Medical Innovation Drive<br/>Health City, HC 90210<br/>United States</p>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              <FiPhone color="var(--accent-light)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Phone Number</h3>
            <p style={{ color: 'var(--text-secondary)' }}>Emergency: 911<br/>General: +1 (555) 123-4567<br/>Appointments: +1 (555) 987-6543</p>
          </div>

          <div className="glass-card" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center', padding: '2rem' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>
              <FiMail color="var(--success-light)" />
            </div>
            <h3 style={{ fontSize: '1.2rem', marginBottom: '0.5rem' }}>Email Us</h3>
            <p style={{ color: 'var(--text-secondary)' }}>support@mediqueue.org<br/>admin@mediqueue.org<br/>careers@mediqueue.org</p>
          </div>

        </div>
      </section>
    </div>
  );
}
