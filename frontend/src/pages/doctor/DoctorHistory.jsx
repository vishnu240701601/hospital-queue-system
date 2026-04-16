import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import { FiCheckCircle, FiClock } from 'react-icons/fi';

export default function DoctorHistory() {
  const { profile } = useAuth();
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, [profile]);

  async function fetchHistory() {
    try {
      const { data: doc } = await supabase
        .from('doctors')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (!doc) return;

      const { data, error } = await supabase
        .from('appointments')
        .select(`
          *,
          patient:profiles!appointments_patient_id_fkey(name, email),
          department:departments(name, icon)
        `)
        .eq('doctor_id', doc.id)
        .eq('status', 'completed')
        .order('updated_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error fetching history:', err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div className="page-header">
            <h1>Patient History</h1>
            <p>View your recently completed appointments</p>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No History Yet</h3>
              <p>Completed appointments will appear here.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id}>
                      <td>
                        <span style={{
                          background: 'rgba(16, 185, 129, 0.15)', color: 'var(--success-light)',
                          padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)',
                          fontWeight: 600, fontSize: '0.85rem'
                        }}>
                          #{appt.queue_number}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{appt.patient?.name}</td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>{appt.patient?.email}</td>
                      <td>{appt.department?.icon} {appt.department?.name}</td>
                      <td><span className="badge badge-completed"><FiCheckCircle size={12} /> Completed</span></td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                        <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {new Date(appt.updated_at).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
