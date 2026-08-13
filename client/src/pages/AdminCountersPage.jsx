import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api from '../services/api';
import socket from '../services/socket';
import { FiMonitor, FiPlus, FiEdit2, FiTrash2, FiPower, FiKey } from 'react-icons/fi';

const emptyForm = { name: '', counterId: '', email: '', password: '', description: '' };

export default function AdminCountersPage() {
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const fetchCounters = async () => {
    try {
      const { data } = await api.get('/counters');
      setCounters(data);
    } catch (err) {
      toast.error('Failed to load counters');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCounters();
    socket.on('countersUpdated', fetchCounters);
    return () => socket.off('countersUpdated', fetchCounters);
  }, []);

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormData(emptyForm);
  };

  const openEdit = (counter) => {
    setEditing(counter._id);
    setFormData({
      name: counter.name || '',
      counterId: counter.counterId || '',
      email: counter.userId?.email || '',
      password: '',
      description: counter.description || ''
    });
    setModalOpen(true);
  };

  const saveCounter = async (e) => {
    e.preventDefault();
    try {
      if (editing) {
        await api.put(`/counters/${editing}`, formData);
        toast.success('Counter updated');
      } else {
        await api.post('/counters', formData);
        toast.success('Counter created');
      }
      closeModal();
      fetchCounters();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Counter save failed');
    }
  };

  const setStatus = async (counter, isActive) => {
    const result = await Swal.fire({
      title: `${isActive ? 'Enable' : 'Disable'} ${counter.name}?`,
      input: isActive ? undefined : 'datetime-local',
      inputLabel: isActive ? undefined : 'Disable until (optional)',
      showCancelButton: true,
      confirmButtonText: isActive ? 'Enable' : 'Disable',
      icon: 'warning'
    });
    if (!result.isConfirmed) return;
    await api.put(`/counters/${counter._id}/status`, {
      isActive,
      disabledUntil: isActive ? null : result.value || null
    });
    toast.success(`Counter ${isActive ? 'enabled' : 'disabled'}`);
    fetchCounters();
  };

  const resetPassword = async (counter) => {
    const result = await Swal.fire({
      title: `Reset password for ${counter.name}`,
      input: 'password',
      inputPlaceholder: 'New password',
      showCancelButton: true,
      confirmButtonText: 'Reset'
    });
    if (!result.isConfirmed || !result.value) return;
    await api.put(`/counters/${counter._id}/reset-password`, { newPassword: result.value });
    toast.success('Password reset');
  };

  const deleteCounter = async (counter) => {
    const result = await Swal.fire({
      title: `Delete ${counter.name}?`,
      text: 'This also removes the counter login account.',
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete'
    });
    if (!result.isConfirmed) return;
    await api.delete(`/counters/${counter._id}`);
    toast.success('Counter deleted');
    fetchCounters();
  };

  if (loading) return <div className="h-[70vh] flex items-center justify-center text-slate-500">Loading counters...</div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">Counter Management</h1>
          <p className="text-slate-500 mt-1">Manage counter login accounts and availability.</p>
        </div>
        <button onClick={() => setModalOpen(true)} className="h-11 px-4 rounded-xl bg-indigo-600 text-white font-semibold flex items-center justify-center gap-2">
          <FiPlus /> Add Counter
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
        {counters.map((counter) => (
          <div key={counter._id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl p-4 shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center">
                  <FiMonitor />
                </div>
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">{counter.name}</h2>
                  <p className="text-sm text-slate-500">{counter.counterId}</p>
                </div>
              </div>
              <span className={`px-2 py-1 rounded-lg text-xs font-semibold ${counter.isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'}`}>
                {counter.isActive ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            <div className="mt-4 text-sm text-slate-600 dark:text-slate-300 space-y-1">
              <p>{counter.userId?.email || 'No login account'}</p>
              {counter.disabledUntil && <p>Disabled until {new Date(counter.disabledUntil).toLocaleString()}</p>}
            </div>
            <div className="mt-4 grid grid-cols-4 gap-2">
              <button onClick={() => openEdit(counter)} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FiEdit2 /></button>
              <button onClick={() => resetPassword(counter)} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FiKey /></button>
              <button onClick={() => setStatus(counter, !counter.isActive)} className="h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center"><FiPower /></button>
              <button onClick={() => deleteCounter(counter)} className="h-10 rounded-lg bg-red-50 text-red-600 flex items-center justify-center"><FiTrash2 /></button>
            </div>
          </div>
        ))}
      </div>

      {modalOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <form onSubmit={saveCounter} className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-xl p-5 space-y-4">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">{editing ? 'Edit Counter' : 'Add Counter'}</h2>
            {['name', 'counterId', 'email', 'password', 'description'].map((field) => (
              <input
                key={field}
                type={field === 'password' ? 'password' : 'text'}
                disabled={editing && field === 'counterId'}
                placeholder={field === 'counterId' ? 'counter-1' : field[0].toUpperCase() + field.slice(1)}
                value={formData[field]}
                onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
                className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60"
              />
            ))}
            <div className="flex justify-end gap-3">
              <button type="button" onClick={closeModal} className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800">Cancel</button>
              <button className="h-10 px-4 rounded-lg bg-indigo-600 text-white font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}