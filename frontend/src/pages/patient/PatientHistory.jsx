import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import Navbar from '../../components/Navbar';
import { FiCheckCircle, FiCalendar } from 'react-icons/fi';

export default function PatientHistory() {
  const { profile } = useAuth();
  const [receipts, setReceipts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchHistory();
  }, []);

  async function fetchHistory() {
    try {
      const { data, error } = await supabase
        .from('patient_receipts')
        .select('*')
        .eq('patient_id', profile.id)
        .order('completed_at', { ascending: false });

      if (error) {
        // If the view doesn't exist yet, fallback to fetching raw appointments
        if (error.code === '42P01') {
          console.warn('View patient_receipts not found. Falling back to appointments table.');
          const { data: rawData, error: rawError } = await supabase
            .from('appointments')
            .select(`
              id,
              queue_number,
              created_at,
              updated_at,
              doctor_notes,
              completed_at,
              doctor:doctors(profile:profiles(name)),
              department:departments(name)
            `)
            .eq('patient_id', profile.id)
            .eq('status', 'completed')
            .order('updated_at', { ascending: false });
            
            if (rawError) throw rawError;
            
            const mapped = (rawData || []).map(r => ({
              id: r.id,
              queue_number: r.queue_number,
              completed_at: r.completed_at || r.updated_at,
              doctor_name: r.doctor?.profile?.name,
              department_name: r.department?.name,
              doctor_notes: r.doctor_notes
            }));
            setReceipts(mapped);
        } else {
          throw error;
        }
      } else {
        setReceipts(data || []);
      }
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
        <div className="container" style={{ maxWidth: '800px' }}>
          <div className="page-header">
            <h1>My Appointment History</h1>
            <p>View your past visits and receipts</p>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : receipts.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📁</div>
              <h3>No Visit History</h3>
              <p>You have no completed appointments yet.</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
              {receipts.map((receipt) => (
                <div key={receipt.id} className="glass-card" style={{ display: 'flex', flexWrap: 'wrap', gap: '1.5rem', alignItems: 'center' }}>
                  <div style={{ padding: '1rem', background: 'rgba(16, 185, 129, 0.1)', borderRadius: 'var(--radius-md)', color: 'var(--success)' }}>
                    <FiCheckCircle size={32} />
                  </div>
                  
                  <div style={{ flex: 1, minWidth: 'min-content' }}>
                    <h3 style={{ fontSize: '1.1rem', marginBottom: '0.2rem' }}>{receipt.department_name}</h3>
                    <p style={{ color: 'var(--text-secondary)' }}>Dr. {receipt.doctor_name}</p>
                    
                    {receipt.doctor_notes && (
                      <div style={{ marginTop: '0.5rem', fontSize: '0.85rem', fontStyle: 'italic', color: 'var(--text-muted)' }}>
                        "{receipt.doctor_notes}"
                      </div>
                    )}
                  </div>
                  
                  <div style={{ textAlign: 'right' }}>
                    <div className="badge badge-completed" style={{ marginBottom: '0.5rem' }}>Token #{receipt.queue_number}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                      <FiCalendar />
                      {new Date(receipt.completed_at).toLocaleDateString()} at {new Date(receipt.completed_at).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  );
}
