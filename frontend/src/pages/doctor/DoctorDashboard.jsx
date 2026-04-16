import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import { FiUser, FiCheck, FiPlay, FiClock, FiActivity, FiUsers } from 'react-icons/fi';
import { getDeptIcon } from '../../utils/iconMap';

export default function DoctorDashboard() {
  const { profile } = useAuth();
  const [doctorRecord, setDoctorRecord] = useState(null);
  const [queue, setQueue] = useState([]);
  const [todayCompleted, setTodayCompleted] = useState(0);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [doctorNotes, setDoctorNotes] = useState('');

  useEffect(() => {
    fetchDoctorData();
  }, [profile]);

  useEffect(() => {
    if (!doctorRecord) return;

    // Subscribe to real-time appointment updates
    const channel = supabase
      .channel('doctor-queue')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'appointments',
          filter: `doctor_id=eq.${doctorRecord.id}`,
        },
        () => {
          fetchQueue(doctorRecord.id);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [doctorRecord]);

  async function fetchDoctorData() {
    try {
      // Get doctor record for this profile
      const { data: doc, error } = await supabase
        .from('doctors')
        .select('*, department:departments(name, icon)')
        .eq('profile_id', profile.id)
        .single();

      if (error) throw error;
      setDoctorRecord(doc);
      await fetchQueue(doc.id);
    } catch (err) {
      console.error('Error fetching doctor data:', err);
    } finally {
      setLoading(false);
    }
  }

  async function fetchQueue(doctorId) {
    const today = new Date().toISOString().split('T')[0];

    // Fetch waiting and in-progress appointments
    const { data: queueData } = await supabase
      .from('appointments')
      .select(`
        *,
        patient:profiles!appointments_patient_id_fkey(name, email)
      `)
      .eq('doctor_id', doctorId)
      .in('status', ['waiting', 'in-progress'])
      .gte('created_at', today)
      .order('queue_number', { ascending: true });

    setQueue(queueData || []);

    // Fetch today's completed count
    const { count } = await supabase
      .from('appointments')
      .select('id', { count: 'exact', head: true })
      .eq('doctor_id', doctorId)
      .eq('status', 'completed')
      .gte('created_at', today);

    setTodayCompleted(count || 0);
  }

  async function handleAttendNext() {
    setActionLoading(true);
    try {
      const currentInProgress = queue.find(a => a.status === 'in-progress');
      const nextWaiting = queue.find(a => a.status === 'waiting');

      const promises = [];

      if (currentInProgress) {
        promises.push(
          supabase.from('appointments')
            .update({ 
              status: 'completed', 
              updated_at: new Date().toISOString(),
              completed_at: new Date().toISOString(),
              doctor_notes: doctorNotes
            })
            .eq('id', currentInProgress.id)
        );
      }

      if (nextWaiting) {
        promises.push(
          supabase.from('appointments')
            .update({ status: 'in-progress', updated_at: new Date().toISOString() })
            .eq('id', nextWaiting.id)
        );
      }

      if (promises.length > 0) {
        const results = await Promise.all(promises);
        results.forEach(res => { if (res.error) throw res.error; });
      }

      setDoctorNotes('');
      await fetchQueue(doctorRecord.id);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCompletePatient(appointmentId) {
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('appointments')
        .update({ 
          status: 'completed', 
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
          doctor_notes: doctorNotes
        })
        .eq('id', appointmentId);

      if (error) throw error;
      setDoctorNotes('');
      await fetchQueue(doctorRecord.id);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setActionLoading(false);
    }
  }

  async function toggleAvailability() {
    try {
      const newStatus = !doctorRecord.is_available;
      await supabase
        .from('doctors')
        .update({ is_available: newStatus })
        .eq('id', doctorRecord.id);
      setDoctorRecord({ ...doctorRecord, is_available: newStatus });
    } catch (err) {
      console.error('Error:', err);
    }
  }

  const currentPatient = queue.find(a => a.status === 'in-progress');
  const waitingPatients = queue.filter(a => a.status === 'waiting');

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

  if (!doctorRecord) {
    return (
      <>
        <Navbar />
        <div className="page">
          <div className="container">
            <div className="empty-state">
              <div className="empty-icon">⚠️</div>
              <h3>Doctor Profile Not Found</h3>
              <p>Your account hasn't been set up as a doctor yet. Please contact the admin.</p>
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
        <div className="container">
          <div className="page-header">
            <h1>Doctor Dashboard</h1>
            <p style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: 'var(--text-secondary)' }}>
              <span style={{ color: 'var(--primary)', display: 'flex' }}>
                {getDeptIcon(doctorRecord.department?.name, 20)}
              </span>
              {doctorRecord.department?.name} — {doctorRecord.specialization || 'General'}
            </p>
          </div>

          {/* Stats */}
          <div className="stats-grid">
            <div className="stat-card">
              <div className="stat-icon purple"><FiUsers /></div>
              <div className="stat-info">
                <h3>{waitingPatients.length}</h3>
                <p>Patients Waiting</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon cyan"><FiActivity /></div>
              <div className="stat-info">
                <h3>{currentPatient ? '1' : '0'}</h3>
                <p>Currently Attending</p>
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-icon green"><FiCheck /></div>
              <div className="stat-info">
                <h3>{todayCompleted}</h3>
                <p>Completed Today</p>
              </div>
            </div>
            <div className="stat-card" onClick={toggleAvailability} style={{ cursor: 'pointer' }}>
              <div className={`stat-icon ${doctorRecord.is_available ? 'green' : 'amber'}`}>
                {doctorRecord.is_available ? '🟢' : '🔴'}
              </div>
              <div className="stat-info">
                <h3>{doctorRecord.is_available ? 'On Duty' : 'Off Duty'}</h3>
                <p>Click to toggle</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <div style={{ marginBottom: '2rem' }}>
            <button
              className="btn btn-success btn-lg"
              onClick={handleAttendNext}
              disabled={actionLoading || (waitingPatients.length === 0 && !currentPatient)}
              style={{ width: '100%', maxWidth: '400px' }}
            >
              <FiPlay />
              {currentPatient
                ? 'Complete Current & Attend Next'
                : waitingPatients.length > 0
                  ? 'Attend Next Patient'
                  : 'No Patients in Queue'
              }
            </button>
          </div>

          {/* Current Patient */}
          {currentPatient && (
            <div style={{ marginBottom: '2rem' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
                Currently Attending
              </h2>
              <div className="glass-card" style={{ borderColor: 'var(--primary)', boxShadow: 'var(--shadow-glow)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                    <div className="queue-num" style={{
                      width: 48, height: 48, fontSize: '1.1rem',
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      color: 'white'
                    }}>
                      {currentPatient.queue_number}
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{currentPatient.patient?.name}</h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{currentPatient.patient?.email}</p>
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: '1.5rem', paddingTop: '1.5rem', borderTop: '1px solid var(--border)' }}>
                  <label style={{ display: 'block', marginBottom: '0.5rem', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                    Add Notes / Prescription (optional, patient can view on receipt)
                  </label>
                  <textarea
                    className="form-input"
                    rows={3}
                    placeholder="e.g. Prescribed Paracetamol 500mg, rest for 2 days"
                    value={doctorNotes}
                    onChange={(e) => setDoctorNotes(e.target.value)}
                    style={{ marginBottom: '1rem' }}
                  ></textarea>

                  <button
                    className="btn btn-success"
                    onClick={() => handleCompletePatient(currentPatient.id)}
                    disabled={actionLoading}
                    style={{ width: '100%' }}
                  >
                    <FiCheck /> Mark as Completed
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Waiting Queue */}
          <div>
            <h2 style={{ fontSize: '1.1rem', fontWeight: 600, marginBottom: '1rem', color: 'var(--text-secondary)' }}>
              Waiting Queue ({waitingPatients.length})
            </h2>
            {waitingPatients.length === 0 ? (
              <div className="empty-state" style={{ padding: '2rem' }}>
                <p>No patients waiting in queue.</p>
              </div>
            ) : (
              waitingPatients.map((appt, idx) => (
                <div key={appt.id} className={`queue-item ${idx === 0 ? 'current' : ''}`}>
                  <div className="patient-info">
                    <div className="queue-num">{appt.queue_number}</div>
                    <div>
                      <div style={{ fontWeight: 500 }}>{appt.patient?.name}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {new Date(appt.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <span className="badge badge-waiting">
                    {idx === 0 ? 'Next Up' : `#${idx + 1}`}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </>
  );
}
