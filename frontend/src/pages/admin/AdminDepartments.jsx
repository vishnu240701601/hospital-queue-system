import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import Navbar from '../../components/Navbar';
import { QRCodeSVG } from 'qrcode.react';
import { FiPlus, FiEdit2, FiTrash2, FiX, FiDownload, FiPrinter } from 'react-icons/fi';

const DEPARTMENT_ICONS = ['🏥', '❤️', '🧠', '🦴', '👁️', '👶', '🦷', '💉', '🔬', '🫁', '🩺', '🧬'];

export default function AdminDepartments() {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState({ name: '', description: '', icon: '🏥' });
  const [formError, setFormError] = useState('');
  const [qrDept, setQrDept] = useState(null);

  useEffect(() => {
    fetchDepartments();
  }, []);

  async function fetchDepartments() {
    try {
      const { data, error } = await supabase
        .from('departments')
        .select('*')
        .order('name');
      if (error) throw error;
      setDepartments(data || []);
    } catch (err) {
      console.error('Error:', err);
    } finally {
      setLoading(false);
    }
  }

  function openModal(dept = null) {
    if (dept) {
      setEditing(dept);
      setFormData({ name: dept.name, description: dept.description || '', icon: dept.icon || '🏥' });
    } else {
      setEditing(null);
      setFormData({ name: '', description: '', icon: '🏥' });
    }
    setFormError('');
    setModalOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Department name is required');
      return;
    }

    try {
      if (editing) {
        const { error } = await supabase
          .from('departments')
          .update({
            name: formData.name.trim(),
            description: formData.description.trim(),
            icon: formData.icon,
          })
          .eq('id', editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('departments')
          .insert({
            name: formData.name.trim(),
            description: formData.description.trim(),
            icon: formData.icon,
          });
        if (error) throw error;
      }
      setModalOpen(false);
      fetchDepartments();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!confirm('Are you sure you want to delete this department? This will also remove associated doctors and appointments.')) return;
    try {
      const { error } = await supabase.from('departments').delete().eq('id', id);
      if (error) throw error;
      fetchDepartments();
    } catch (err) {
      alert('Error deleting: ' + err.message);
    }
  }

  function downloadQR() {
    if (!qrDept) return;
    const svg = document.getElementById(`qr-code-${qrDept.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      canvas.width = img.width + 40;
      canvas.height = img.height + 40;
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 20, 20);
      const pngFile = canvas.toDataURL("image/png");
      const downloadLink = document.createElement("a");
      downloadLink.download = `${qrDept.name.replace(/\s+/g, '_')}_QR.png`;
      downloadLink.href = `${pngFile}`;
      downloadLink.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  }

  function printQR() {
    if (!qrDept) return;
    const svg = document.getElementById(`qr-code-${qrDept.id}`);
    if (!svg) return;
    const printWindow = window.open('', '_blank');
    printWindow.document.write(`
      <html>
        <head><title>Print QR - ${qrDept.name}</title></head>
        <body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;">
          <div style="text-align:center;font-family:sans-serif;">
            ${svg.outerHTML}
            <h1 style="margin-top:20px;">${qrDept.icon} ${qrDept.name}</h1>
            <p>Scan this to book an appointment</p>
          </div>
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  }

  return (
    <>
      <Navbar />
      <div className="page">
        <div className="container">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '2rem', flexWrap: 'wrap', gap: '1rem' }}>
            <div className="page-header" style={{ marginBottom: 0 }}>
              <h1>Manage Departments</h1>
              <p>Add, edit, and manage hospital departments</p>
            </div>
            <button className="btn btn-primary" onClick={() => openModal()}>
              <FiPlus /> Add Department
            </button>
          </div>

          {loading ? (
            <div className="loading-spinner"><div className="spinner"></div></div>
          ) : departments.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">🏥</div>
              <h3>No Departments</h3>
              <p>Click "Add Department" to create your first department.</p>
            </div>
          ) : (
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Icon</th>
                    <th>Name</th>
                    <th>Description</th>
                    <th>QR Code</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {departments.map((dept) => (
                    <tr key={dept.id}>
                      <td style={{ fontSize: '1.5rem' }}>{dept.icon}</td>
                      <td style={{ fontWeight: 600 }}>{dept.name}</td>
                      <td style={{ color: 'var(--text-secondary)', maxWidth: '300px' }}>
                        {dept.description || '—'}
                      </td>
                      <td>
                        <button
                          className="btn btn-secondary btn-sm"
                          onClick={() => setQrDept(qrDept?.id === dept.id ? null : dept)}
                        >
                          {qrDept?.id === dept.id ? 'Hide QR' : 'Show QR'}
                        </button>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button className="btn btn-icon btn-secondary" onClick={() => openModal(dept)} title="Edit">
                            <FiEdit2 size={16} />
                          </button>
                          <button className="btn btn-icon btn-danger" onClick={() => handleDelete(dept.id)} title="Delete">
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

          {/* QR Code Display */}
          {qrDept && (
            <div style={{ marginTop: '2rem', textAlign: 'center' }}>
              <h3 style={{ marginBottom: '1rem' }}>{qrDept.icon} {qrDept.name} — Department QR Code</h3>
              <div className="qr-container" style={{ margin: '0 auto' }}>
                <QRCodeSVG
                  id={`qr-code-${qrDept.id}`}
                  value={`MEDIQUEUE_DEPT_${qrDept.id}`}
                  size={200}
                  bgColor="#ffffff"
                  fgColor="#1a1a2e"
                  level="H"
                  includeMargin
                />
                <div className="qr-label">Scan to visit {qrDept.name}</div>
              </div>
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginTop: '1.5rem' }}>
                <button className="btn btn-secondary" onClick={downloadQR}>
                  <FiDownload /> Download PNG
                </button>
                <button className="btn btn-primary" onClick={printQR}>
                  <FiPrinter /> Print QR
                </button>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Print this QR code and display it at the department entrance. Patients can scan it to view doctors and book appointments.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Add/Edit Modal */}
      {modalOpen && (
        <div className="modal-overlay" onClick={() => setModalOpen(false)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{editing ? 'Edit Department' : 'Add Department'}</h2>
              <button className="modal-close" onClick={() => setModalOpen(false)}><FiX /></button>
            </div>

            {formError && <div className="auth-error">{formError}</div>}

            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label className="form-label">Department Name</label>
                <input
                  className="form-input"
                  placeholder="e.g., Cardiology"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label className="form-label">Description</label>
                <input
                  className="form-input"
                  placeholder="Brief description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Icon</label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
                  {DEPARTMENT_ICONS.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormData({ ...formData, icon })}
                      style={{
                        width: 40, height: 40, fontSize: '1.2rem',
                        border: formData.icon === icon ? '2px solid var(--primary)' : '1px solid var(--border)',
                        borderRadius: 'var(--radius-sm)',
                        background: formData.icon === icon ? 'rgba(99, 102, 241, 0.15)' : 'var(--bg-card)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" className="btn btn-secondary" onClick={() => setModalOpen(false)}>Cancel</button>
                <button type="submit" className="btn btn-primary">
                  {editing ? 'Save Changes' : 'Create Department'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
