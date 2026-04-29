import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { startLocationTracking } from '../../lib/gps';
import Navbar from '../../components/Navbar';
import { FiClock, FiCheckCircle, FiActivity, FiUser, FiCalendar, FiArrowLeft, FiMapPin, FiAlertTriangle, FiNavigation } from 'react-icons/fi';

export default function PatientAppointmentTracker() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

  // GPS tracking state
  const [gpsStatus, setGpsStatus] = useState('initializing'); // within_range, warned, grace_period, demoted, error, gps_error, not_configured, not_tracking
  const [distance, setDistance] = useState(0);
  const [wasDemoted, setWasDemoted] = useState(false);
  const [graceSeconds, setGraceSeconds] = useState(60);
  const [demotionInfo, setDemotionInfo] = useState(null);
  const [gpsMessage, setGpsMessage] = useState('Initializing GPS tracking...');
  const cleanupRef = useRef(null);

  useEffect(() => {
    fetchAppointmentDetails();

    const channel = supabase
      .channel(`appointment-${appointmentId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `id=eq.${appointmentId}`,
        },
        () => {
          fetchAppointmentDetails();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [appointmentId]);

  // Start GPS tracking when appointment loads
  useEffect(() => {
    if (!appointment || appointment.status !== 'waiting') return;

    try {
      const cleanup = startLocationTracking(appointmentId, handleGpsUpdate);
      cleanupRef.current = cleanup;
    } catch (err) {
      console.error('Failed to start GPS tracking:', err);
      setGpsStatus('error');
      setGpsMessage('Failed to initialize GPS tracking.');
    }

    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
        cleanupRef.current = null;
      }
    };
  }, [appointment?.id, appointment?.status]);

  function handleGpsUpdate(result) {
    if (!result) return;
    setDistance(result.distance || 0);
    setGpsStatus(result.status || 'error');
    setGpsMessage(result.message || '');

    if (result.status === 'grace_period') {
      setGraceSeconds(result.grace_remaining || 0);
    }

    if (result.demoted) {
      setWasDemoted(true);
      setDemotionInfo({
        oldPosition: result.old_position,
        newPosition: result.new_position,
      });
      // Refresh appointment data to get updated queue number
      fetchAppointmentDetails();
    }
  }

  async function fetchAppointmentDetails() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          doctor:doctors(
            specialization,
            profile:profiles(name)
          ),
          department:departments(name, icon)
        `)
        .eq('id', appointmentId)
        .single();

      if (error) throw error;

      if (data.status === 'waiting') {
        const { count } = await supabase
          .from('appointments')
          .select('id', { count: 'exact', head: true })
          .eq('doctor_id', data.doctor_id)
          .eq('status', 'waiting')
          .lt('queue_number', data.queue_number)
          .gte('created_at', today);
        
        data.position = (count || 0) + 1;
        data.estimatedWait = (count || 0) * 10;
      }

      // Check existing demotion state
      if (data.was_demoted && data.original_queue_number) {
        setWasDemoted(true);
        setDemotionInfo({
          oldPosition: data.original_queue_number,
          newPosition: data.queue_number,
        });
      }

      setAppointment(data);
    } catch (err) {
      console.error('Error fetching appointment:', err);
    } finally {
      setLoading(false);
    }
  }

  function getGpsStatusCard() {
    if (!appointment || appointment.status !== 'waiting') return null;

    const statusStyles = {
      initializing: {
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        iconColor: 'var(--primary-light)',
        icon: <FiNavigation size={20} />,
      },
      within_range: {
        background: 'rgba(16, 185, 129, 0.1)',
        border: '1px solid rgba(16, 185, 129, 0.3)',
        iconColor: 'var(--success-light)',
        icon: <FiMapPin size={20} />,
      },
      warned: {
        background: 'rgba(245, 158, 11, 0.15)',
        border: '1px solid rgba(245, 158, 11, 0.4)',
        iconColor: 'var(--warning-light)',
        icon: <FiAlertTriangle size={20} />,
      },
      grace_period: {
        background: 'rgba(239, 68, 68, 0.15)',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        iconColor: 'var(--danger-light)',
        icon: <FiAlertTriangle size={20} />,
      },
      demoted: {
        background: 'rgba(239, 68, 68, 0.2)',
        border: '1px solid rgba(239, 68, 68, 0.5)',
        iconColor: 'var(--danger-light)',
        icon: <FiAlertTriangle size={20} />,
      },
      error: {
        background: 'rgba(239, 68, 68, 0.1)',
        border: '1px solid rgba(239, 68, 68, 0.3)',
        iconColor: 'var(--danger-light)',
        icon: <FiAlertTriangle size={20} />,
      },
      gps_error: {
        background: 'rgba(245, 158, 11, 0.1)',
        border: '1px solid rgba(245, 158, 11, 0.3)',
        iconColor: 'var(--warning-light)',
        icon: <FiAlertTriangle size={20} />,
      },
      not_configured: {
        background: 'rgba(99, 102, 241, 0.1)',
        border: '1px solid rgba(99, 102, 241, 0.3)',
        iconColor: 'var(--primary-light)',
        icon: <FiMapPin size={20} />,
      },
      not_tracking: {
        background: 'rgba(100, 116, 139, 0.1)',
        border: '1px solid rgba(100, 116, 139, 0.3)',
        iconColor: 'var(--text-muted)',
        icon: <FiMapPin size={20} />,
      },
    };

    const style = statusStyles[gpsStatus] || statusStyles.error;

    return (
      <div
        className="glass-card gps-status-card"
        style={{
          marginTop: '1.5rem',
          padding: '1.25rem',
          background: style.background,
          border: style.border,
          animation: gpsStatus === 'grace_period' ? 'gps-blink 1s ease-in-out infinite' : undefined,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <div
            style={{
              width: 40,
              height: 40,
              borderRadius: 'var(--radius-md)',
              background: style.background,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: style.iconColor,
              flexShrink: 0,
            }}
          >
            {style.icon}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{
              fontSize: '0.8rem',
              fontWeight: 700,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              color: style.iconColor,
              marginBottom: '0.25rem',
            }}>
              {gpsStatus === 'within_range' && '📍 Within Range'}
              {gpsStatus === 'warned' && '⚠️ Moving Away'}
              {gpsStatus === 'grace_period' && '🚨 Return Now!'}
              {gpsStatus === 'demoted' && '❌ Token Moved'}
              {gpsStatus === 'initializing' && '📡 Connecting GPS...'}
              {gpsStatus === 'error' && '❌ GPS Error'}
              {gpsStatus === 'gps_error' && '📡 Signal Lost'}
              {gpsStatus === 'not_configured' && '⚙️ Not Configured'}
              {gpsStatus === 'not_tracking' && '⏸️ Not Tracking'}
            </div>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
              {gpsMessage}
            </p>
            {gpsStatus === 'grace_period' && (
              <div style={{
                marginTop: '0.5rem',
                fontSize: '1.5rem',
                fontWeight: 800,
                color: 'var(--danger-light)',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {graceSeconds}s remaining
              </div>
            )}
          </div>
          {distance > 0 && (
            <div style={{
              textAlign: 'center',
              padding: '0.5rem 0.75rem',
              background: 'rgba(0,0,0,0.2)',
              borderRadius: 'var(--radius-sm)',
              flexShrink: 0,
            }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 700, color: style.iconColor }}>
                {distance}m
              </div>
              <div style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>distance</div>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="loading-spinner"><div className="spinner"></div></div>
        </div>
      </>
    );
  }

  if (!appointment) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="container">
            <div className="empty-state">
              <h3>Appointment Not Found</h3>
              <button className="btn btn-primary" onClick={() => navigate('/patient')}>Go Back</button>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container" style={{ maxWidth: '600px' }}>
          
          <button 
            className="btn btn-secondary btn-sm" 
            style={{ marginBottom: '1.5rem', background: 'transparent', border: 'none', paddingLeft: 0 }}
            onClick={() => navigate('/patient')}
          >
            <FiArrowLeft style={{ marginRight: 8 }} /> Back to Departments
          </button>

          {appointment.status === 'waiting' && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem' }}>
              <div style={{ marginBottom: '2rem' }}>
                <span className="badge badge-waiting" style={{ padding: '0.5rem 1rem', fontSize: '1rem', marginBottom: '1rem' }}>
                  🟡 Waiting in Queue
                </span>
                <h1 style={{ fontSize: '2rem', marginTop: '1rem' }}>Token: #{appointment.queue_number}</h1>
                <p style={{ color: 'var(--text-secondary)' }}>You are currently waiting to see the doctor.</p>
              </div>

              <div className="queue-position" style={{ margin: '0 auto 2rem', width: '200px', height: '200px', border: '4px solid var(--primary)' }}>
                <div className="queue-number" style={{ fontSize: '4rem' }}>{appointment.position}</div>
                <div className="queue-label">Position in Queue</div>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', color: 'var(--warning-light)', marginTop: '0.5rem' }}>
                  <FiClock /> ~{appointment.estimatedWait} min wait
                </div>
              </div>

              {/* Demotion notice */}
              {wasDemoted && demotionInfo && (
                <div style={{
                  marginTop: '1rem',
                  padding: '1rem 1.25rem',
                  background: 'rgba(239, 68, 68, 0.1)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  borderRadius: 'var(--radius-md)',
                  textAlign: 'center',
                }}>
                  <FiAlertTriangle style={{ color: 'var(--danger-light)', marginBottom: '0.25rem' }} size={18} />
                  <p style={{ fontSize: '0.85rem', color: 'var(--danger-light)' }}>
                    Your token was moved from <strong>#{demotionInfo.oldPosition}</strong> to{' '}
                    <strong>#{demotionInfo.newPosition}</strong> because you left the hospital area.
                  </p>
                </div>
              )}
            </div>
          )}

          {appointment.status === 'in-progress' && (
            <div className="glass-card" style={{ textAlign: 'center', padding: '3rem 2rem', borderColor: 'var(--primary)', boxShadow: 'var(--shadow-glow)' }}>
              <div style={{ 
                  width: '100px', height: '100px', margin: '0 auto 1.5rem', 
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center' 
              }}>
                <FiActivity size={48} color="white" />
              </div>
              <h1 style={{ fontSize: '2rem', color: 'var(--primary-light)', marginBottom: '0.5rem' }}>The doctor is ready!</h1>
              <p style={{ fontSize: '1.1rem', color: 'var(--text-secondary)' }}>
                Please proceed to the doctor's cabin immediately.
              </p>
            </div>
          )}

          {appointment.status === 'completed' && (
            <div className="glass-card receipt-card">
              <div style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <FiCheckCircle size={64} color="var(--success)" style={{ marginBottom: '1rem' }} />
                <h1 style={{ fontSize: '1.8rem', color: 'var(--success)' }}>Appointment Complete</h1>
                <p style={{ color: 'var(--text-secondary)' }}>Thank you for visiting MediQueue Hospital.</p>
              </div>
              
              <div style={{ background: 'var(--bg-primary)', padding: '1.5rem', borderRadius: 'var(--radius-md)', border: '1px dashed var(--border)' }}>
                <h3 style={{ fontSize: '1.2rem', marginBottom: '1.5rem', textAlign: 'center' }}>Visit Receipt</h3>
                
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Ticket Number</span>
                  <strong>#{appointment.queue_number}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Date & Time</span>
                  <strong>{new Date(appointment.completed_at || appointment.updated_at).toLocaleString()}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1rem', paddingBottom: '1rem', borderBottom: '1px solid var(--border)' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Department</span>
                  <strong>{appointment.department?.icon} {appointment.department?.name}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Doctor</span>
                  <strong>Dr. {appointment.doctor?.profile?.name}</strong>
                </div>
                
                {appointment.doctor_notes && (
                  <div style={{ marginTop: '1rem', padding: '1rem', background: 'rgba(99, 102, 241, 0.1)', borderRadius: 'var(--radius-sm)' }}>
                    <strong style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--primary-light)' }}>Doctor's Note:</strong>
                    <p style={{ fontSize: '0.9rem', fontStyle: 'italic' }}>"{appointment.doctor_notes}"</p>
                  </div>
                )}
              </div>
              
              <button className="btn btn-primary" style={{ width: '100%', marginTop: '2rem' }} onClick={() => navigate('/patient/history')}>
                View My History
              </button>
            </div>
          )}

          {/* GPS Status Card — only shows when waiting */}
          {getGpsStatusCard()}

          {/* Info Card Always show at bottom */}
          {appointment.status !== 'completed' && (
            <div className="glass-card" style={{ marginTop: '2rem', padding: '1.5rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'var(--bg-card)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <FiUser size={24} color="var(--primary-light)" />
                </div>
                <div>
                  <h3 style={{ fontSize: '1.1rem', fontWeight: 600 }}>Dr. {appointment.doctor?.profile?.name}</h3>
                  <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {appointment.department?.name} • {appointment.doctor?.specialization}
                  </p>
                </div>
              </div>
            </div>
          )}

        </div>
      </div>
    </>
  );
}
