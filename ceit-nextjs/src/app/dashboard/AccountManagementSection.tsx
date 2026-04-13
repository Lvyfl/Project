'use client';

import { useCallback, useEffect, useState } from 'react';
import { useTheme } from '@/contexts/ThemeContext';
import { useAuth } from '@/contexts/AuthContext';
import { api } from '@/lib/api';

type AdminUser = {
  id: string;
  name: string;
  email: string;
  isMasterAdmin: boolean;
  createdAt: string;
  departmentName: string | null;
};

type Department = {
  id: string;
  name: string;
};

function formatDate(dateStr: string) {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function getInitials(name: string) {
  return (name || '?').split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export default function AccountManagementSection() {
  const { theme } = useTheme();
  const { token } = useAuth();
  const d = theme === 'dark';

  const [admins, setAdmins] = useState<AdminUser[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [loading, setLoading] = useState(true);
  const [notice, setNotice] = useState<{ msg: string; kind: 'success' | 'error' } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<AdminUser | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPasswords, setShowPasswords] = useState(false);
  const [form, setForm] = useState({ name: '', email: '', password: '', confirmPassword: '', departmentName: '' });
  const [formErrors, setFormErrors] = useState<Partial<typeof form>>({});

  const [editTarget, setEditTarget] = useState<AdminUser | null>(null);
  const [editForm, setEditForm] = useState({ name: '', email: '', password: '', confirmPassword: '', departmentName: '' });
  const [editErrors, setEditErrors] = useState<Partial<typeof editForm>>({});
  const [saving, setSaving] = useState(false);
  const [showEditPasswords, setShowEditPasswords] = useState(false);

  const showNotice = (msg: string, kind: 'success' | 'error') => {
    setNotice({ msg, kind });
    setTimeout(() => setNotice(null), 4000);
  };

  const loadAdmins = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get('/auth/admins', { headers: { Authorization: `Bearer ${token}` } });
      setAdmins(res.data);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      showNotice(e?.response?.data?.error || 'Failed to load admin accounts', 'error');
    } finally {
      setLoading(false);
    }
  }, [token]);

  const loadDepartments = useCallback(async () => {
    try {
      const res = await api.get('/auth/departments');
      setDepartments(res.data);
    } catch { /* silent */ }
  }, []);

  useEffect(() => {
    loadAdmins();
    loadDepartments();
  }, [loadAdmins, loadDepartments]);

  const validateForm = () => {
    const errors: Partial<typeof form> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim() || !/\S+@\S+\.\S+/.test(form.email)) errors.email = 'Valid email is required';
    if (!form.password || form.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (form.password !== form.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (!form.departmentName) errors.departmentName = 'Department is required';
    return errors;
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    const errors = validateForm();
    if (Object.keys(errors).length > 0) { setFormErrors(errors); return; }
    setFormErrors({});
    setCreating(true);
    try {
      await api.post('/auth/register', {
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
        departmentName: form.departmentName,
      }, { headers: { Authorization: `Bearer ${token}` } });
      showNotice(`Admin account for ${form.name} created successfully.`, 'success');
      setForm({ name: '', email: '', password: '', confirmPassword: '', departmentName: '' });
      setShowCreateForm(false);
      loadAdmins();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      showNotice(e?.response?.data?.error || 'Failed to create admin account', 'error');
    } finally {
      setCreating(false);
    }
  };

  const openEdit = (admin: AdminUser) => {
    setEditTarget(admin);
    setEditForm({ name: admin.name, email: admin.email, password: '', confirmPassword: '', departmentName: admin.departmentName || '' });
    setEditErrors({});
    setShowEditPasswords(false);
  };

  const validateEditForm = () => {
    const errors: Partial<typeof editForm> = {};
    if (!editForm.name.trim()) errors.name = 'Name is required';
    if (!editForm.email.trim() || !/\S+@\S+\.\S+/.test(editForm.email)) errors.email = 'Valid email is required';
    if (editForm.password && editForm.password.length < 6) errors.password = 'Password must be at least 6 characters';
    if (editForm.password && editForm.password !== editForm.confirmPassword) errors.confirmPassword = 'Passwords do not match';
    if (!editForm.departmentName) errors.departmentName = 'Department is required';
    return errors;
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTarget) return;
    const errors = validateEditForm();
    if (Object.keys(errors).length > 0) { setEditErrors(errors); return; }
    setEditErrors({});
    setSaving(true);
    try {
      await api.patch(`/auth/admins/${editTarget.id}`, {
        name: editForm.name.trim(),
        email: editForm.email.trim().toLowerCase(),
        password: editForm.password || undefined,
        departmentName: editForm.departmentName,
      }, { headers: { Authorization: `Bearer ${token}` } });
      showNotice(`${editForm.name}'s account has been updated.`, 'success');
      setEditTarget(null);
      loadAdmins();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      showNotice(e?.response?.data?.error || 'Failed to update account', 'error');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    setDeletingId(deleteTarget.id);
    try {
      await api.delete(`/auth/admins/${deleteTarget.id}`, { headers: { Authorization: `Bearer ${token}` } });
      showNotice(`${deleteTarget.name}'s account has been removed.`, 'success');
      setAdmins(prev => prev.filter(a => a.id !== deleteTarget.id));
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      showNotice(e?.response?.data?.error || 'Failed to delete account', 'error');
    } finally {
      setDeletingId(null);
      setDeleteTarget(null);
    }
  };

  // colour helpers
  const card = d ? 'bg-zinc-900/70 border border-orange-500/20' : 'bg-white border border-orange-200 shadow-sm';
  const label = d ? 'text-orange-200/80 text-xs font-semibold uppercase tracking-wider' : 'text-orange-700 text-xs font-semibold uppercase tracking-wider';
  const inputCls = d
    ? 'w-full rounded-xl bg-zinc-900/60 border border-orange-500/30 text-white placeholder-orange-200/50 focus:border-orange-400 focus:ring-2 focus:ring-orange-400/20 outline-none px-4 py-2.5 text-sm transition-all'
    : 'w-full rounded-xl bg-white border border-orange-200 text-black placeholder-orange-400/60 focus:border-orange-500 focus:ring-2 focus:ring-orange-500/15 outline-none px-4 py-2.5 text-sm transition-all';
  const errCls = 'text-red-400 text-xs mt-1';

  return (
    <div className="p-8 space-y-8 max-w-4xl">
      {/* Notice */}
      {notice && (
        <div className={`px-5 py-3 rounded-xl text-sm font-medium ${
          notice.kind === 'success'
            ? d ? 'bg-green-500/15 border border-green-500/30 text-green-300' : 'bg-green-50 border border-green-300 text-green-800'
            : d ? 'bg-red-500/15 border border-red-500/30 text-red-300' : 'bg-red-50 border border-red-300 text-red-700'
        }`}>
          {notice.msg}
        </div>
      )}

      {/* Header row */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className={`text-lg font-bold ${d ? 'text-white' : 'text-black'}`}>Admin Accounts</h3>
          <p className={`text-sm mt-0.5 ${d ? 'text-orange-200/70' : 'text-orange-700'}`}>
            Only you (master admin) can create or remove admin accounts.
          </p>
        </div>
        <button
          onClick={() => { setShowCreateForm(v => !v); setFormErrors({}); }}
          className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${
            showCreateForm
              ? d ? 'bg-zinc-800 border border-orange-500/30 text-orange-200' : 'bg-orange-50 border border-orange-300 text-orange-800'
              : 'bg-orange-600 hover:bg-orange-500 text-white shadow-lg shadow-orange-900/30'
          }`}
        >
          {showCreateForm ? '✕ Cancel' : '+ New Admin'}
        </button>
      </div>

      {/* Create form */}
      {showCreateForm && (
        <div className={`rounded-2xl p-6 ${card}`}>
          <p className={`text-sm font-semibold mb-5 ${d ? 'text-white' : 'text-black'}`}>Create New Admin Account</p>
          <form onSubmit={handleCreate} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
            {/* Name */}
            <div>
              <label className={label}>Full Name</label>
              <input className={`${inputCls} mt-1.5`} placeholder="e.g. Juan Dela Cruz"
                value={form.name} onChange={e => setForm(p => ({ ...p, name: e.target.value }))} />
              {formErrors.name && <p className={errCls}>{formErrors.name}</p>}
            </div>
            {/* Email */}
            <div>
              <label className={label}>Email Address</label>
              <input type="email" className={`${inputCls} mt-1.5`} placeholder="admin@email.com"
                value={form.email} onChange={e => setForm(p => ({ ...p, email: e.target.value }))} />
              {formErrors.email && <p className={errCls}>{formErrors.email}</p>}
            </div>
            {/* Department */}
            <div>
              <label className={label}>Department</label>
              <select className={`${inputCls} mt-1.5`}
                value={form.departmentName} onChange={e => setForm(p => ({ ...p, departmentName: e.target.value }))}>
                <option value="">Select department…</option>
                {departments.map(dep => (
                  <option key={dep.id} value={dep.name}>{dep.name}</option>
                ))}
              </select>
              {formErrors.departmentName && <p className={errCls}>{formErrors.departmentName}</p>}
            </div>
            {/* Password */}
            <div>
              <label className={label}>Password</label>
              <div className="relative mt-1.5">
                <input type={showPasswords ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="Min. 6 characters"
                  value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))} />
                <button type="button" tabIndex={-1} onClick={() => setShowPasswords(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-orange-400 hover:text-orange-600 transition-colors">
                  {showPasswords ? '🙈' : '👁️'}
                </button>
              </div>
              {formErrors.password && <p className={errCls}>{formErrors.password}</p>}
            </div>
            {/* Confirm password */}
            <div className="sm:col-span-2">
              <label className={label}>Confirm Password</label>
              <div className="relative mt-1.5 sm:max-w-xs">
                <input type={showPasswords ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="Re-enter password"
                  value={form.confirmPassword} onChange={e => setForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                <button type="button" tabIndex={-1} onClick={() => setShowPasswords(v => !v)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-orange-400 hover:text-orange-600 transition-colors">
                  {showPasswords ? '🙈' : '👁️'}
                </button>
              </div>
              {formErrors.confirmPassword && <p className={errCls}>{formErrors.confirmPassword}</p>}
            </div>
            {/* Submit */}
            <div className="sm:col-span-2 flex justify-end">
              <button type="submit" disabled={creating}
                className="px-7 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-900/30">
                {creating ? 'Creating…' : 'Create Account'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Accounts list */}
      <div className={`rounded-2xl overflow-hidden ${card}`}>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-8 h-8 rounded-full border-2 border-orange-500/30 border-t-orange-500 animate-spin" />
          </div>
        ) : admins.length === 0 ? (
          <p className={`text-center py-14 text-sm ${d ? 'text-orange-200/60' : 'text-orange-600/70'}`}>No admin accounts found.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className={`border-b ${d ? 'border-orange-500/20' : 'border-orange-100'}`}>
                {['Admin', 'Department', 'Email', 'Created', ''].map(col => (
                  <th key={col} className={`px-5 py-4 text-left font-semibold ${d ? 'text-orange-200/70' : 'text-orange-700'} text-xs uppercase tracking-wider`}>{col}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {admins.map((admin, i) => (
                <tr key={admin.id}
                  className={`border-b last:border-0 transition-colors ${
                    d
                      ? `${i % 2 === 0 ? 'bg-transparent' : 'bg-orange-500/5'} border-orange-500/10 hover:bg-orange-500/10`
                      : `${i % 2 === 0 ? 'bg-transparent' : 'bg-orange-50/50'} border-orange-100 hover:bg-orange-50`
                  }`}>
                  {/* Avatar + name */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gradient-to-br from-orange-500 to-orange-700 flex items-center justify-center text-white font-bold text-xs flex-shrink-0">
                        {getInitials(admin.name)}
                      </div>
                      <div>
                        <p className={`font-semibold leading-tight ${d ? 'text-white' : 'text-black'}`}>{admin.name}</p>
                        {admin.isMasterAdmin && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-orange-500/20 text-orange-400 border border-orange-500/30">
                            Master Admin
                          </span>
                        )}
                      </div>
                    </div>
                  </td>
                  {/* Dept */}
                  <td className="px-5 py-4">
                    <span className={`px-2.5 py-1 rounded-lg text-xs font-medium ${d ? 'bg-orange-500/15 text-orange-200 border border-orange-500/25' : 'bg-orange-100 text-orange-800 border border-orange-200'}`}>
                      {admin.departmentName || '—'}
                    </span>
                  </td>
                  {/* Email */}
                  <td className={`px-5 py-4 ${d ? 'text-orange-100/80' : 'text-orange-900'}`}>{admin.email}</td>
                  {/* Date */}
                  <td className={`px-5 py-4 ${d ? 'text-orange-200/60' : 'text-orange-600'}`}>{formatDate(admin.createdAt)}</td>
                  {/* Actions */}
                  <td className="px-5 py-4 text-right">
                    {!admin.isMasterAdmin && (
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => openEdit(admin)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            d
                              ? 'bg-orange-500/10 border border-orange-500/20 text-orange-300 hover:bg-orange-500/25 hover:border-orange-500/40'
                              : 'bg-orange-50 border border-orange-200 text-orange-700 hover:bg-orange-100'
                          }`}
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setDeleteTarget(admin)}
                          disabled={deletingId === admin.id}
                          className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                            d
                              ? 'bg-red-500/10 border border-red-500/20 text-red-400 hover:bg-red-500/25 hover:border-red-500/40'
                              : 'bg-red-50 border border-red-200 text-red-600 hover:bg-red-100'
                          } disabled:opacity-40`}
                        >
                          {deletingId === admin.id ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Edit modal */}
      {editTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setEditTarget(null)}>
          <div className={`w-full max-w-lg rounded-2xl p-7 shadow-2xl ${d ? 'bg-zinc-900 border border-orange-500/25' : 'bg-white border border-orange-200'}`}
            onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h4 className={`font-bold text-lg ${d ? 'text-white' : 'text-black'}`}>Edit Admin Account</h4>
              <button onClick={() => setEditTarget(null)}
                className={`text-sm px-3 py-1 rounded-lg transition-colors ${d ? 'text-orange-200/70 hover:text-orange-200 hover:bg-orange-500/10' : 'text-orange-700 hover:bg-orange-50'}`}>
                ✕
              </button>
            </div>
            <form onSubmit={handleUpdate} className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <div>
                <label className={label}>Full Name</label>
                <input className={`${inputCls} mt-1.5`} placeholder="Full name"
                  value={editForm.name} onChange={e => setEditForm(p => ({ ...p, name: e.target.value }))} />
                {editErrors.name && <p className={errCls}>{editErrors.name}</p>}
              </div>
              <div>
                <label className={label}>Email Address</label>
                <input type="email" className={`${inputCls} mt-1.5`} placeholder="admin@email.com"
                  value={editForm.email} onChange={e => setEditForm(p => ({ ...p, email: e.target.value }))} />
                {editErrors.email && <p className={errCls}>{editErrors.email}</p>}
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Department</label>
                <select className={`${inputCls} mt-1.5`}
                  value={editForm.departmentName} onChange={e => setEditForm(p => ({ ...p, departmentName: e.target.value }))}>
                  <option value="">Select department…</option>
                  {departments.map(dep => (
                    <option key={dep.id} value={dep.name}>{dep.name}</option>
                  ))}
                </select>
                {editErrors.departmentName && <p className={errCls}>{editErrors.departmentName}</p>}
              </div>
              <div>
                <label className={label}>New Password <span className={`normal-case font-normal ${d ? 'text-orange-200/40' : 'text-orange-500/60'}`}>(leave blank to keep)</span></label>
                <div className="relative mt-1.5">
                  <input type={showEditPasswords ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="Min. 6 characters"
                    value={editForm.password} onChange={e => setEditForm(p => ({ ...p, password: e.target.value }))} />
                  <button type="button" tabIndex={-1} onClick={() => setShowEditPasswords(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-orange-400 hover:text-orange-600 transition-colors">
                    {showEditPasswords ? '🙈' : '👁️'}
                  </button>
                </div>
                {editErrors.password && <p className={errCls}>{editErrors.password}</p>}
              </div>
              <div>
                <label className={label}>Confirm Password</label>
                <div className="relative mt-1.5">
                  <input type={showEditPasswords ? 'text' : 'password'} className={`${inputCls} pr-10`} placeholder="Re-enter password"
                    value={editForm.confirmPassword} onChange={e => setEditForm(p => ({ ...p, confirmPassword: e.target.value }))} />
                  <button type="button" tabIndex={-1} onClick={() => setShowEditPasswords(v => !v)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-sm text-orange-400 hover:text-orange-600 transition-colors">
                    {showEditPasswords ? '🙈' : '👁️'}
                  </button>
                </div>
                {editErrors.confirmPassword && <p className={errCls}>{editErrors.confirmPassword}</p>}
              </div>
              <div className="sm:col-span-2 flex justify-end gap-3 pt-1">
                <button type="button" onClick={() => setEditTarget(null)}
                  className={`px-5 py-2.5 rounded-xl text-sm font-semibold transition-all ${d ? 'bg-zinc-800 border border-orange-500/20 text-orange-200 hover:bg-zinc-700' : 'bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100'}`}>
                  Cancel
                </button>
                <button type="submit" disabled={saving}
                  className="px-7 py-2.5 rounded-xl bg-orange-600 hover:bg-orange-500 disabled:opacity-50 text-white font-semibold text-sm transition-all shadow-lg shadow-orange-900/30">
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete confirmation modal */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4"
          onClick={() => setDeleteTarget(null)}>
          <div className={`w-full max-w-sm rounded-2xl p-7 shadow-2xl ${d ? 'bg-zinc-900 border border-orange-500/25' : 'bg-white border border-orange-200'}`}
            onClick={e => e.stopPropagation()}>
            <div className="w-12 h-12 rounded-full bg-red-500/15 border border-red-500/30 flex items-center justify-center text-2xl mx-auto mb-5">⚠️</div>
            <h4 className={`text-center font-bold text-lg mb-2 ${d ? 'text-white' : 'text-black'}`}>Remove Admin Account?</h4>
            <p className={`text-center text-sm mb-6 ${d ? 'text-orange-200/70' : 'text-orange-700'}`}>
              <span className="font-semibold">{deleteTarget.name}</span> ({deleteTarget.email}) will lose dashboard access immediately.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setDeleteTarget(null)}
                className={`flex-1 py-2.5 rounded-xl text-sm font-semibold transition-all ${d ? 'bg-zinc-800 border border-orange-500/20 text-orange-200 hover:bg-zinc-700' : 'bg-orange-50 border border-orange-200 text-orange-800 hover:bg-orange-100'}`}>
                Cancel
              </button>
              <button onClick={handleDelete} disabled={!!deletingId}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-red-600 hover:bg-red-500 text-white transition-all disabled:opacity-50">
                {deletingId ? 'Removing…' : 'Yes, Remove'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
