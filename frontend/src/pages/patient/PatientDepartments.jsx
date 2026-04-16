import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { FiUsers, FiActivity, FiX, FiCamera } from 'react-icons/fi';
import { Html5QrcodeScanner } from 'html5-qrcode';
import { getDeptIcon } from '../../utils/iconMap';

export default function PatientDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [scanDept, setScanDept] = useState(null);
  const [scanError, setScanError] = useState('');
  const scannerRef = useRef(null);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');

      if (error) throw error;
      setDepartments(data || []);
    } catch (err) {
      console.error('Error fetching departments:', err);
    } finally {
      setLoading(false);
    }
  }

  function startScanner(dept) {
    setScanDept(dept);
    setScanError('');
    
    // Allow React to render the modal first
    setTimeout(() => {
      const scanner = new Html5QrcodeScanner('inline-qr-reader', {
        qrbox: { width: 250, height: 250 },
        fps: 10,
      });

      scanner.render(
        (decodedText) => {
          scanner.clear();
          const match = decodedText.match(/MEDIQUEUE_DEPT_(.+)/);
          const scannedId = match ? match[1] : decodedText;

          if (scannedId === dept.id) {
            navigate(`/patient/doctors/${dept.id}`);
          } else {
            setScanError('Wrong QR code. Please scan the correct department QR code.');
            // Restart scanner after failure
            setTimeout(() => startScanner(dept), 2000);
          }
        },
        (err) => {
          // Silently handle scan errors
        }
      );

      scannerRef.current = scanner;
    }, 100);
  }

  function closeScanner() {
    if (scannerRef.current) {
      scannerRef.current.clear().catch(() => {});
    }
    setScanDept(null);
    setScanError('');
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div className="page-header">
            <h1>Hospital Departments</h1>
            <p>Select a department to view available doctors and book an appointment</p>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : departments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon"><img src="/logo.png" width="48" style={{opacity:0.5}}/></div>
              <h3>No Departments Available</h3>
              <p>Departments will appear here once they are added by the admin.</p>
            </div>
          ) : (
            <div className="dept-grid">
              {departments.map((dept, index) => (
                <div
                  key={dept.id}
                  className="dept-card"
                  onClick={() => startScanner(dept)}
                  style={{ animationDelay: `${index * 0.05}s`, animation: 'slideUp 0.4s ease forwards' }}
                >
                  <div className="dept-icon" style={{color: 'var(--primary)'}}>{getDeptIcon(dept.name, 40)}</div>
                  <h3>{dept.name}</h3>
                  <p>{dept.description || 'Click to view available doctors'}</p>
                  <div style={{
                    display: 'flex', gap: '1rem', marginTop: '1rem',
                    fontSize: '0.8rem', color: 'var(--text-muted)'
                  }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FiUsers size={14} /> Doctors Available
                    </span>
                    <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                      <FiActivity size={14} /> Queue Open
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {scanDept && (
        <div className="modal-overlay" onClick={closeScanner}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modal-header">
              <h2><FiCamera style={{ marginRight: 8, verticalAlign: 'middle' }}/> Scan QR for {scanDept.name}</h2>
              <button className="modal-close" onClick={closeScanner}><FiX /></button>
            </div>
            
            <p style={{ marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Please point your camera at the QR code located at the <strong>{scanDept.name}</strong> department entrance.
            </p>

            {scanError && <div className="auth-error" style={{ marginBottom: '1rem' }}>{scanError}</div>}

            <div className="glass-card" style={{ padding: 0, overflow: 'hidden' }}>
              <div id="inline-qr-reader" style={{ width: '100%', borderRadius: 'var(--radius-md)', overflow: 'hidden' }} />
            </div>
          </div>
        </div>
      )}
    </>
  );
}
