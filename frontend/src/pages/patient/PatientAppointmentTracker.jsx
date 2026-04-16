import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { FiClock, FiCheckCircle, FiActivity, FiUser, FiCalendar, FiArrowLeft } from 'react-icons/fi';

export default function PatientAppointmentTracker() {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const [appointment, setAppointment] = useState(null);
  const [loading, setLoading] = useState(true);

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

      setAppointment(data);
    } catch (err) {
      console.error('Error fetching appointment:', err);
    } finally {
      setLoading(false);
    }
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
