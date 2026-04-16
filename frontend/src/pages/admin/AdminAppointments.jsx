import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { FiClock, FiFilter } from 'react-icons/fi';

export default function AdminAppointments() {
  const [appointments, setAppointments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('today'); // today, all

  useEffect(() => {
    fetchAppointments();
  }, [filter]);

  async function fetchAppointments() {
    setLoading(true);
    try {
      let query = supabase
        .from('appointments')
        .select(`
          *,
          patient:profiles!appointments_patient_id_fkey(name, email),
          doctor:doctors(
            specialization,
            profile:profiles(name)
          ),
          department:departments(name, icon)
        `)
        .order('created_at', { ascending: false })
        .limit(100);

      if (filter === 'today') {
        const today = new Date().toISOString().split('T')[0];
        query = query.gte('created_at', today);
      }

      const { data, error } = await query;
      if (error) throw error;
      setAppointments(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  const statusBadge = (status) => {
    const map = {
      waiting: 'badge-waiting',
      'in-progress': 'badge-in-progress',
      completed: 'badge-completed',
    };
    const labels = {
      waiting: '🟡 Waiting',
      'in-progress': '🔵 In Progress',
      completed: '✅ Completed',
    };
    return <span className={`badge ${map[status]}`}>{labels[status]}</span>;
  };

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="page-header" style={{ marginBottom: 0 }}>
              <h1>All Appointments</h1>
              <p>View patient appointments across all departments</p>
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button
                className={`btn ${filter === 'today' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setFilter('today')}
              >
                <FiFilter size={14} /> Today
              </button>
              <button
                className={`btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm`}
                onClick={() => setFilter('all')}
              >
                <FiFilter size={14} /> All History
              </button>
            </div>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : appointments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📋</div>
              <h3>No Appointments</h3>
              <p>{filter === 'today' ? 'No appointments for today yet.' : 'No appointment history found.'}</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Token</th>
                    <th>Patient</th>
                    <th>Doctor</th>
                    <th>Department</th>
                    <th>Status</th>
                    <th>Time</th>
                  </tr>
                </thead>
                <tbody>
                  {appointments.map((appt) => (
                    <tr key={appt.id}>
                      <td>
                        <span style={{
                          background: 'rgba(99, 102, 241, 0.15)', color: 'var(--primary-light)',
                          padding: '0.2rem 0.6rem', borderRadius: 'var(--radius-sm)',
                          fontWeight: 700, fontSize: '0.85rem'
                        }}>
                          #{appt.queue_number}
                        </span>
                      </td>
                      <td style={{ fontWeight: 500 }}>{appt.patient?.name || '—'}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>
                        Dr. {appt.doctor?.profile?.name || '—'}
                      </td>
                      <td>{appt.department?.icon} {appt.department?.name}</td>
                      <td>{statusBadge(appt.status)}</td>
                      <td style={{ fontSize: '0.85rem', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        <FiClock size={12} style={{ verticalAlign: 'middle', marginRight: 4 }} />
                        {new Date(appt.created_at).toLocaleString()}
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
