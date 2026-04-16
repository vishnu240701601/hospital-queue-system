import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiUser } from 'react-icons/fi';

export default function AdminDoctors() {
  const [doctors, setDoctors] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({
    profile_email: '',
    department_id: '',
    specialization: '',
    is_available: true,
  });
  const [formError, setFormError] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      const [docsRes, deptsRes] = await Promise.all([
        supabase
          .from('doctors')
          .select(`
            *,
            profile:profiles(name, email),
            department:departments(name, icon)
          `)
          .order('created_at', { ascending: false }),
        supabase.from('departments').select('id, name').order('name'),
      ]);

      setDoctors(docsRes.data || []);
      setDepartments(deptsRes.data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  function openModal(doc = null) {
    if (doc) {
      setEditing(doc);
      setFormData({
        profile_email: doc.profile?.email || '',
        department_id: doc.department_id,
        specialization: doc.specialization || '',
        is_available: doc.is_available,
      });
    } else {
      setEditing(null);
      setFormData({
        profile_email: '',
        department_id: departments[0]?.id || '',
        specialization: '',
        is_available: true,
      });
    }
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    try {
      if (editing) {
        const { error } = await supabase
          .from('doctors')
          .update({
            department_id: formData.department_id,
            specialization: formData.specialization.trim(),
            is_available: formData.is_available,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        // Find user profile by email
        const { data: profile, error: profileErr } = await supabase
          .from('profiles')
          .select('id, role')
          .eq('email', formData.profile_email.trim())
          .single();

        if (profileErr || !profile) {
          setFormError('No user found with that email. The user must register first.');
          return;
        }

        if (profile.role !== 'doctor') {
          // Update role to doctor
          await supabase
            .from('profiles')
            .update({ role: 'doctor' })
            .eq('id', profile.id);
        }

        const { error } = await supabase
          .from('doctors')
          .insert({
            profile_id: profile.id,
            department_id: formData.department_id,
            specialization: formData.specialization.trim(),
            is_available: formData.is_available,
          });
        if (error) throw error;
      }
      setModalOpen(false);
      fetchData();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to remove this doctor?')) return;
    try {
      const { error } = await supabase.from('doctors').delete().eq('id', id);
      if (error) throw error;
      fetchData();
    } catch (err) {
      alert('Error: ' + err.message);
    }
  }

  async function toggleAvailability(doc) {
    try {
      await supabase
        .from('doctors')
        .update({ is_available: !doc.is_available })
        .eq('id', doc.id);
      fetchData();
    } catch (err) {
      console.error('Error:', err);
    }
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="page-header" style={{ marginBottom: 0 }}>
              <h1>Manage Doctors</h1>
              <p>Add doctors and assign them to departments</p>
            </div>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <FiPlus /> Add Doctor
            </button>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : doctors.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">👨‍⚕️</div>
              <h3>No Doctors</h3>
              <p>Click "Add Doctor" to assign a registered user as a doctor.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Doctor</th>
                    <th>Email</th>
                    <th>Department</th>
                    <th>Specialization</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {doctors.map((doc) => (
                    <tr key={doc.id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <div style={{
                            width: 32, height: 32, borderRadius: 'var(--radius-sm)',
                            background: 'linear-gradient(135deg, var(--primary), var(--accent))',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                          }}>
                            <FiUser size={14} color="white" />
                          </div>
                          <span style={{ fontWeight: 600 }}>Dr. {doc.profile?.name || 'Unknown'}</span>
                        </div>
                      </td>
                      <td style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                        {doc.profile?.email}
                      </td>
                      <td>{doc.department?.icon} {doc.department?.name}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{doc.specialization || '—'}</td>
                      <td>
                        <button
                          className={`badge ${doc.is_available ? 'badge-available' : 'badge-unavailable'}`}
                          onClick={() => toggleAvailability(doc)}
                          style={{ cursor: 'pointer', border: 'none' }}
                        >
                          {doc.is_available ? '🟢 Available' : '🔴 Unavailable'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-icon btn-secondary" onClick={() => openModal(doc)} title="Edit">
                            <FiEdit2 size={16} />
                          </button>
                          <button className="btn btn-icon btn-danger" onClick={() => handleDelete(doc.id)} title="Delete">
                            <FiTrash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Doctor' : 'Add Doctor'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}><FiX /></button>
            </div>

            {formError && <div className="auth-error">{formError}</div>}

            <form onSubmit={handleSubmit}>
              {!editing && (
                <div className="form-group">
                  <label className="form-label">User Email</label>
                  <input
                    className="form-input"
                    type="email"
                    placeholder="doctor@example.com"
                    value={formData.profile_email}
                    onChange={(e) => setFormData({ ...formData, profile_email: e.target.value })}
                    required
                  />
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                    The user must have registered first. Their role will be updated to "doctor".
                  </span>
                </div>
              )}

              <div className="form-group">
                <label className="form-label">Department</label>
                <select
                  className="form-select"
                  value={formData.department_id}
                  onChange={(e) => setFormData({ ...formData, department_id: e.target.value })}
                  required
                >
                  <option value="">Select Department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>{dept.name}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label className="form-label">Specialization</label>
                <input
                  className="form-input"
                  placeholder="e.g., Heart Surgery"
                  value={formData.specialization}
                  onChange={(e) => setFormData({ ...formData, specialization: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Availability</label>
                <select
                  className="form-select"
                  value={formData.is_available ? 'true' : 'false'}
                  onChange={(e) => setFormData({ ...formData, is_available: e.target.value === 'true' })}
                >
                  <option value="true">Available (On Duty)</option>
                  <option value="false">Unavailable (Off Duty)</option>
                </select>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Add Doctor'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
