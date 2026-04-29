import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { requestLocation } from '../../lib/gps';
import Navbar from '../../components/Navbar';
import { FiCheck, FiClock, FiUser, FiUsers, FiX, FiMapPin } from 'react-icons/fi';

export default function DoctorSelection() {
  const { departmentId } = useParams();
  const { profile } = useAuth();
  const navigate = useNavigate();
  const [department, setDepartment] = useState(null);
  const [doctors, setDoctors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [confirmDoctor, setConfirmDoctor] = useState(null);
  const [bookingLoading, setBookingLoading] = useState(false);
  const [bookingError, setBookingError] = useState('');
  const [locationDenied, setLocationDenied] = useState(false);

  useEffect(() => {
    fetchDepartmentAndDoctors();

    // Unique channel name per department for live queue counts
    const channel = supabase
      .channel(`doctor-queue-counts-${departmentId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'appointments' },
        () => {
          // Re-fetch queue counts live when any appointment changes
          fetchDepartmentAndDoctors(false);
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'doctors', filter: `department_id=eq.${departmentId}` },
        () => {
          fetchDepartmentAndDoctors(false);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [departmentId]);

  async function fetchDepartmentAndDoctors(showLoading = true) {
    if (showLoading) setLoading(true);
    try {
      // Fetch department
      const { data: dept } = await supabase
        .from('departments')
        .select('*')
        .eq('id', departmentId)
        .single();
      setDepartment(dept);

      // Fetch doctors with profiles
      const { data: docs, error } = await supabase
        .from('doctors')
        .select(`
          *,
          profile:profiles(name, email)
        `)
        .eq('department_id', departmentId)
        .eq('is_available', true);

      if (error) throw error;
      
      // Fetch patient's active appointments
      const today = new Date().toISOString().split('T')[0];
      const { data: myAppts } = await supabase
        .from('appointments')
        .select('*')
        .eq('patient_id', profile.id)
        .in('status', ['waiting', 'in-progress'])
        .gte('created_at', today);

      const docsWithCounts = await Promise.all((docs || []).map(async (doc) => {
        const { data: allAppts } = await supabase
          .from('appointments')
          .select('id, queue_number, status')
          .eq('doctor_id', doc.id)
          .in('status', ['waiting', 'in-progress'])
          .gte('created_at', today)
          .order('queue_number', { ascending: true });

        const myAppt = myAppts?.find(a => a.doctor_id === doc.id);
        const inProgress = allAppts?.find(a => a.status === 'in-progress');
        
        // Find current serving (moving token)
        const currentServing = inProgress ? inProgress.queue_number : (allAppts?.length > 0 ? allAppts[0].queue_number : '--');
        
        // Find next token they would get
        const { data: nextQueue } = await supabase.rpc('get_next_queue_number', { p_doctor_id: doc.id });

        return { 
          ...doc, 
          queueCount: allAppts?.filter(a => a.status === 'waiting').length || 0,
          currentServing,
          nextQueue: nextQueue || 1,
          myAppointment: myAppt
        };
      }));

      setDoctors(docsWithCounts);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      if (showLoading) setLoading(false);
    }
  }

  async function initiateBooking(doctor) {
    // Check if patient already has a waiting appointment with this doctor today
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await supabase
      .from('appointments')
      .select('id, queue_number')
      .eq('patient_id', profile.id)
      .eq('doctor_id', doctor.id)
      .in('status', ['waiting', 'in-progress'])
      .gte('created_at', today)
      .limit(1);

    if (existing && existing.length > 0) {
      // Instantly redirect to their existing token tracker
      navigate(`/patient/queue/${existing[0].id}`);
      return;
    }

    setConfirmDoctor(doctor);
    setBookingError('');
  }

  async function handleConfirmBooking() {
    if (!confirmDoctor) return;
    setBookingLoading(true);
    setBookingError('');
    try {
      // Request GPS location before booking
      let patientLocation = null;
      try {
        patientLocation = await requestLocation();
      } catch (locErr) {
        setLocationDenied(true);
        setBookingLoading(false);
        return;
      }

      const doctor = confirmDoctor;

      // Create appointment atomically with GPS coordinates
      const { data, error } = await supabase
        .rpc('book_appointment', {
          p_patient_id: profile.id,
          p_doctor_id: doctor.id,
          p_department_id: departmentId,
          p_patient_lat: patientLocation.lat,
          p_patient_lng: patientLocation.lng,
          p_location_tracking: true
        });

      if (error) throw error;

      navigate(`/patient/queue/${data[0].id}`);
    } catch (err) {
      setBookingError(err.message || 'Failed to book appointment');
      console.error('Booking error:', err);
    } finally {
      setBookingLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div className="page-header">
            <h1>{department?.icon} {department?.name || 'Department'}</h1>
            <p>Select a doctor to book your appointment</p>
          </div>

          {bookingError && (
            <div className="auth-error" style={{ marginBottom: '1rem' }}>{bookingError}</div>
          )}

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : doctors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍⚕️</div>
              <h3>No Doctors Available</h3>
              <p>No doctors are currently on duty in this department. Please check back later.</p>
            </div>
          ) : (
            <div className="dept-grid">
              {doctors.map((doctor) => (
                <div key={doctor.id} className="glass-card" style={{ position: 'relative' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
                    <div style={{
                      width: 48, height: 48, borderRadius: 'var(--radius-md)',
                      background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '1.4rem', flexShrink: 0
                    }}>
                      <FiUser color="white" />
                    </div>
                    <div>
                      <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>
                        Dr. {doctor.profile?.name || 'Unknown'}
                      </h3>
                      <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                        {doctor.specialization || 'General'}
                      </p>
                    </div>
                  </div>

                  <div style={{
                    display: 'flex', alignItems: 'center', gap: '0.5rem',
                    marginBottom: '1rem', fontSize: '0.85rem', flexWrap: 'wrap'
                  }}>
                    <span className="badge badge-available">
                      <FiCheck size={12} style={{ marginRight: 4 }} /> Available
                    </span>
                    <span style={{ color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '0.2rem' }}>
                      <FiUsers size={12} /> {doctor.queueCount} in queue
                    </span>
                    <span style={{ color: 'var(--primary-light)', display: 'flex', alignItems: 'center', gap: '0.2rem', paddingLeft: '0.2rem', borderLeft: '1px solid var(--border)' }}>
                      ▶️ Serving: #{doctor.currentServing}
                    </span>
                  </div>

                  {doctor.myAppointment ? (
                    <div style={{ padding: '0.75rem', background: 'rgba(99,102,241,0.1)', border: '1px solid rgba(99,102,241,0.3)', borderRadius: 'var(--radius-sm)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Your Token</span>
                        <strong style={{ fontSize: '1.2rem', color: 'var(--primary-light)' }}>#{doctor.myAppointment.queue_number}</strong>
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                         <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>📍 GPS Tracking</span>
                         <span style={{ fontSize: '0.75rem', padding: '0.1rem 0.4rem', borderRadius: '4px', background: 'rgba(16,185,129,0.15)', color: 'var(--success)', fontWeight: 600 }}>Active</span>
                      </div>
                      <button className="btn btn-primary" style={{ width: '100%', marginTop: '0.75rem', padding: '0.5rem', fontSize: '0.85rem' }} onClick={() => navigate(`/patient/queue/${doctor.myAppointment.id}`)}>
                        View Live Tracker
                      </button>
                    </div>
                  ) : (
                    <button
                      className="btn btn-primary"
                      style={{ width: '100%' }}
                      onClick={() => initiateBooking(doctor)}
                    >
                      <FiClock size={16} />
                      Get Token #{doctor.nextQueue}
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {confirmDoctor && (
        <div className="modal-overlay" onClick={() => !bookingLoading && setConfirmDoctor(null)}>
          <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 450 }}>
            <div className="modal-header">
              <h2>Confirm Booking</h2>
              <button disabled={bookingLoading} className="modal-close" onClick={() => setConfirmDoctor(null)}><FiX /></button>
            </div>
            
            <div style={{ margin: '1.5rem 0', padding: '1rem', background: 'var(--bg-card)', borderRadius: 'var(--radius-md)' }}>
              <p style={{ marginBottom: '0.5rem' }}>You are booking an appointment with:</p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 'var(--radius-md)',
                  background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.2rem', color: 'white', flexShrink: 0
                }}>
                  <FiUser />
                </div>
                <div>
                  <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>Dr. {confirmDoctor.profile?.name}</h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>
                    Current Queue: <strong>{confirmDoctor.queueCount}</strong> patients waiting
                  </p>
                </div>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                Estimated wait time: ~{confirmDoctor.queueCount * 10} minutes. 
                After booking, you will be redirected to the live queue tracker.
              </p>
            </div>

            <div className="modal-actions">
              <button disabled={bookingLoading} className="btn btn-secondary" onClick={() => setConfirmDoctor(null)}>Cancel</button>
              <button disabled={bookingLoading} className="btn btn-primary" onClick={handleConfirmBooking}>
                {bookingLoading ? 'Booking...' : 'Confirm Appointment'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Location denied overlay */}
      {locationDenied && (
        <div className="modal-overlay" style={{ zIndex: 2000 }}>
          <div className="modal" style={{ maxWidth: 420, textAlign: 'center' }}>
            <div style={{
              width: 80, height: 80, borderRadius: '50%', margin: '0 auto 1.5rem',
              background: 'rgba(239, 68, 68, 0.15)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <FiMapPin size={36} color="var(--danger-light)" />
            </div>
            <h2 style={{ fontSize: '1.3rem', marginBottom: '0.75rem' }}>Location Access Required</h2>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', lineHeight: 1.6, marginBottom: '1.5rem' }}>
              Location access is required for smart queue management. Your GPS position is tracked to ensure you stay near the hospital during your appointment. Please enable GPS in your browser settings and try again.
            </p>
            <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'center' }}>
              <button className="btn btn-secondary" onClick={() => setLocationDenied(false)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => { setLocationDenied(false); handleConfirmBooking(); }}>Try Again</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
