import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { FiMapPin, FiSave, FiNavigation, FiExternalLink, FiSettings } from 'react-icons/fi';

export default function AdminSettings() {
  const [hospitalLat, setHospitalLat] = useState('');
  const [hospitalLng, setHospitalLng] = useState('');
  const [detectionRadius, setDetectionRadius] = useState('50');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('');
  const [isConfigured, setIsConfigured] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  async function fetchSettings() {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('key, value')
        .in('key', ['hospital_lat', 'hospital_lng', 'detection_radius']);

      if (error) throw error;

      const settings = {};
      (data || []).forEach((row) => { settings[row.key] = row.value; });

      setHospitalLat(settings.hospital_lat || '0');
      setHospitalLng(settings.hospital_lng || '0');
      setDetectionRadius(settings.detection_radius || '50');
      setIsConfigured(
        settings.hospital_lat && settings.hospital_lng &&
        settings.hospital_lat !== '0' && settings.hospital_lng !== '0'
      );
    } catch (err) {
      console.error('Error fetching settings:', err);
    } finally {
      setLoading(false);
    }
  }

  async function handleSave(e) {
    e.preventDefault();
    setSaving(true);
    setMessage('');

    try {
      const lat = parseFloat(hospitalLat);
      const lng = parseFloat(hospitalLng);
      const radius = parseFloat(detectionRadius);

      if (isNaN(lat) || isNaN(lng)) {
        throw new Error('Please enter valid latitude and longitude values.');
      }
      if (lat < -90 || lat > 90) {
        throw new Error('Latitude must be between -90 and 90.');
      }
      if (lng < -180 || lng > 180) {
        throw new Error('Longitude must be between -180 and 180.');
      }
      if (isNaN(radius) || radius < 10 || radius > 5000) {
        throw new Error('Detection radius must be between 10 and 5000 meters.');
      }

      const now = new Date().toISOString();

      // Upsert all three settings
      const { error: e1 } = await supabase
        .from('settings')
        .upsert({ key: 'hospital_lat', value: String(lat), updated_at: now });
      if (e1) throw e1;

      const { error: e2 } = await supabase
        .from('settings')
        .upsert({ key: 'hospital_lng', value: String(lng), updated_at: now });
      if (e2) throw e2;

      const { error: e3 } = await supabase
        .from('settings')
        .upsert({ key: 'detection_radius', value: String(radius), updated_at: now });
      if (e3) throw e3;

      setIsConfigured(true);
      setMessageType('success');
      setMessage('Hospital location saved successfully!');
    } catch (err) {
      setMessageType('error');
      setMessage(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  }

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      setMessageType('error');
      setMessage('Geolocation is not supported by your browser.');
      return;
    }

    setMessage('Getting your current location...');
    setMessageType('');

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setHospitalLat(String(position.coords.latitude));
        setHospitalLng(String(position.coords.longitude));
        setMessage('Location detected! Click Save to apply.');
        setMessageType('success');
      },
      () => {
        setMessageType('error');
        setMessage('Failed to get location. Please enter coordinates manually.');
      },
      { enableHighAccuracy: true, timeout: 15000 }
    );
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container" style={{ maxWidth: '700px' }}>
          <div className="page-header">
            <h1><FiSettings style={{ verticalAlign: 'middle', marginRight: 8 }} />GPS Settings</h1>
            <p>Configure hospital location for smart queue tracking</p>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : (
            <>
              {/* Status Card */}
              <div className="glass-card" style={{
                marginBottom: '1.5rem',
                padding: '1.25rem',
                background: isConfigured
                  ? 'rgba(16, 185, 129, 0.08)'
                  : 'rgba(245, 158, 11, 0.08)',
                border: `1px solid ${isConfigured ? 'rgba(16, 185, 129, 0.3)' : 'rgba(245, 158, 11, 0.3)'}`,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                  <div style={{
                    width: 44, height: 44, borderRadius: 'var(--radius-md)',
                    background: isConfigured
                      ? 'rgba(16, 185, 129, 0.15)'
                      : 'rgba(245, 158, 11, 0.15)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    <FiMapPin size={22} color={isConfigured ? 'var(--success-light)' : 'var(--warning-light)'} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '0.95rem', fontWeight: 600 }}>
                      {isConfigured ? 'Hospital Location Configured' : 'Location Not Set'}
                    </h3>
                    <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                      {isConfigured
                        ? `Lat: ${hospitalLat}, Lng: ${hospitalLng} • Radius: ${detectionRadius}m`
                        : 'Set the hospital GPS coordinates to enable smart queue tracking.'}
                    </p>
                  </div>
                </div>
              </div>

              {/* Settings Form */}
              <div className="glass-card" style={{ padding: '2rem' }}>
                <h2 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <FiNavigation size={18} /> Hospital Coordinates
                </h2>

                {message && (
                  <div style={{
                    padding: '0.75rem 1rem',
                    borderRadius: 'var(--radius-md)',
                    marginBottom: '1.25rem',
                    fontSize: '0.85rem',
                    background: messageType === 'success'
                      ? 'rgba(16, 185, 129, 0.1)'
                      : messageType === 'error'
                        ? 'rgba(239, 68, 68, 0.1)'
                        : 'rgba(99, 102, 241, 0.1)',
                    border: `1px solid ${messageType === 'success'
                      ? 'rgba(16, 185, 129, 0.3)'
                      : messageType === 'error'
                        ? 'rgba(239, 68, 68, 0.3)'
                        : 'rgba(99, 102, 241, 0.3)'}`,
                    color: messageType === 'success'
                      ? 'var(--success-light)'
                      : messageType === 'error'
                        ? 'var(--danger-light)'
                        : 'var(--primary-light)',
                  }}>
                    {message}
                  </div>
                )}

                <form onSubmit={handleSave}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label className="form-label">Hospital Latitude</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 12.9716"
                        value={hospitalLat}
                        onChange={(e) => setHospitalLat(e.target.value)}
                        required
                      />
                    </div>
                    <div className="form-group">
                      <label className="form-label">Hospital Longitude</label>
                      <input
                        type="text"
                        className="form-input"
                        placeholder="e.g. 77.5946"
                        value={hospitalLng}
                        onChange={(e) => setHospitalLng(e.target.value)}
                        required
                      />
                    </div>
                  </div>

                  <div className="form-group">
                    <label className="form-label">Detection Radius (meters)</label>
                    <input
                      type="number"
                      className="form-input"
                      placeholder="50"
                      min="10"
                      max="5000"
                      value={detectionRadius}
                      onChange={(e) => setDetectionRadius(e.target.value)}
                      required
                    />
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                      Patients who move beyond this radius will receive a warning. Default: 50 meters.
                    </span>
                  </div>

                  <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap', marginTop: '0.5rem' }}>
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={useCurrentLocation}
                      style={{ flex: '1 1 auto' }}
                    >
                      <FiNavigation size={16} /> Use My Current Location
                    </button>
                    <button
                      type="submit"
                      className="btn btn-primary"
                      disabled={saving}
                      style={{ flex: '1 1 auto' }}
                    >
                      <FiSave size={16} /> {saving ? 'Saving...' : 'Save Location'}
                    </button>
                  </div>
                </form>

                {/* Google Maps Preview */}
                {isConfigured && hospitalLat && hospitalLng && hospitalLat !== '0' && hospitalLng !== '0' && (
                  <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                    <h3 style={{ fontSize: '0.9rem', fontWeight: 600, marginBottom: '0.75rem', color: 'var(--text-secondary)' }}>
                      📍 Map Preview
                    </h3>
                    <a
                      href={`https://maps.google.com/?q=${hospitalLat},${hospitalLng}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="btn btn-secondary"
                      style={{ width: '100%', textDecoration: 'none' }}
                    >
                      <FiExternalLink size={16} />
                      View on Google Maps ({hospitalLat}, {hospitalLng})
                    </a>
                  </div>
                )}
              </div>

              {/* How it works */}
              <div className="glass-card" style={{ marginTop: '1.5rem', padding: '1.5rem' }}>
                <h3 style={{ fontSize: '1rem', fontWeight: 700, marginBottom: '1rem' }}>
                  🛡️ How Smart Queue Tracking Works
                </h3>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.8 }}>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--success-light)', fontWeight: 700, flexShrink: 0 }}>1.</span>
                    <span>When a patient books an appointment, their GPS location is recorded.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--warning-light)', fontWeight: 700, flexShrink: 0 }}>2.</span>
                    <span>If the patient moves beyond the detection radius, they receive a warning.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem', marginBottom: '0.75rem' }}>
                    <span style={{ color: 'var(--danger-light)', fontWeight: 700, flexShrink: 0 }}>3.</span>
                    <span>If they stay outside for more than 60 seconds, their token is automatically moved down by 2 positions.</span>
                  </div>
                  <div style={{ display: 'flex', gap: '0.75rem' }}>
                    <span style={{ color: 'var(--primary-light)', fontWeight: 700, flexShrink: 0 }}>4.</span>
                    <span>Patients in between are moved up by 1 position. Everything updates in real-time.</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
