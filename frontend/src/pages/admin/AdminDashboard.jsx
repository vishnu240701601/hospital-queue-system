import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { FiUsers, FiActivity, FiCheckCircle, FiLayers } from 'react-icons/fi';

export default function AdminDashboard() {
  const [stats, setStats] = useState({
    totalDoctorsOnDuty: 0,
    totalPatientsToday: 0,
    totalWaiting: 0,
    totalCompleted: 0,
  });
  const [deptQueues, setDeptQueues] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 15000); // Refresh every 15s
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const today = new Date().toISOString().split('T')[0];

      // Doctors on duty
      const { count: doctorsOnDuty } = await supabase
        .from('doctors')
        .select('id', { count: 'exact', head: true })
        .eq('is_available', true);

      // Today's appointments
      const { count: totalToday } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', today);

      // Waiting
      const { count: totalWaiting } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'waiting')
        .gte('created_at', today);

      // Completed
      const { count: totalCompleted } = await supabase
        .from('appointments')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'completed')
        .gte('created_at', today);

      setStats({
        totalDoctorsOnDuty: doctorsOnDuty || 0,
        totalPatientsToday: totalToday || 0,
        totalWaiting: totalWaiting || 0,
        totalCompleted: totalCompleted || 0,
      });

      // Department-wise queue stats
      const { data: departments } = await supabase
        .from('departments')
        .select('id, name, icon');

      if (departments) {
        const deptStats = await Promise.all(
          departments.map(async (dept) => {
            const { count: waiting } = await supabase
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('department_id', dept.id)
              .eq('status', 'waiting')
              .gte('created_at', today);

            const { count: inProgress } = await supabase
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('department_id', dept.id)
              .eq('status', 'in-progress')
              .gte('created_at', today);

            const { count: completed } = await supabase
              .from('appointments')
              .select('id', { count: 'exact', head: true })
              .eq('department_id', dept.id)
              .eq('status', 'completed')
              .gte('created_at', today);

            return {
              ...dept,
              waiting: waiting || 0,
              inProgress: inProgress || 0,
              completed: completed || 0,
            };
          })
        );
        setDeptQueues(deptStats);
      }
    } catch (err) {
      console.error('Error fetching stats:', err);
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
            <h1>Admin Dashboard</h1>
            <p>Overview of hospital queue operations</p>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : (
            <>
              {/* Top Stats */}
              <div className="stats-grid">
                <div className="stat-card">
                  <div className="stat-icon purple"><FiUsers /></div>
                  <div className="stat-info">
                    <h3>{stats.totalDoctorsOnDuty}</h3>
                    <p>Doctors On Duty</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon cyan"><FiLayers /></div>
                  <div className="stat-info">
                    <h3>{stats.totalPatientsToday}</h3>
                    <p>Total Patients Today</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon amber"><FiActivity /></div>
                  <div className="stat-info">
                    <h3>{stats.totalWaiting}</h3>
                    <p>Currently Waiting</p>
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-icon green"><FiCheckCircle /></div>
                  <div className="stat-info">
                    <h3>{stats.totalCompleted}</h3>
                    <p>Completed Today</p>
                  </div>
                </div>
              </div>

              {/* Department Queue Status */}
              <h2 style={{ fontSize: '1.2rem', fontWeight: 700, marginBottom: '1rem' }}>
                Queue Status by Department
              </h2>

              {deptQueues.length === 0 ? (
                <div className="empty-state" style={{ padding: '2rem' }}>
                  <p>No departments created yet. Go to Departments to add some.</p>
                </div>
              ) : (
                <div className="dept-grid">
                  {deptQueues.map((dept) => (
                    <div key={dept.id} className="glass-card">
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '1rem' }}>
                        <span style={{ fontSize: '1.5rem' }}>{dept.icon}</span>
                        <h3 style={{ fontSize: '1rem', fontWeight: 600 }}>{dept.name}</h3>
                      </div>

                      <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                        <div style={{
                          flex: 1, minWidth: '80px', textAlign: 'center',
                          padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(245, 158, 11, 0.1)',
                        }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--warning-light)' }}>
                            {dept.waiting}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Waiting
                          </div>
                        </div>
                        <div style={{
                          flex: 1, minWidth: '80px', textAlign: 'center',
                          padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(99, 102, 241, 0.1)',
                        }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--primary-light)' }}>
                            {dept.inProgress}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            In Progress
                          </div>
                        </div>
                        <div style={{
                          flex: 1, minWidth: '80px', textAlign: 'center',
                          padding: '0.75rem', borderRadius: 'var(--radius-sm)',
                          background: 'rgba(16, 185, 129, 0.1)',
                        }}>
                          <div style={{ fontSize: '1.3rem', fontWeight: 700, color: 'var(--success-light)' }}>
                            {dept.completed}
                          </div>
                          <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.2rem' }}>
                            Completed
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </>
  );
}
