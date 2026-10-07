import { useEffect, useState, useMemo } from 'react';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import api from '../services/api';
import socket from '../services/socket';
import {
  FiMonitor,
  FiPlus,
  FiEdit2,
  FiTrash2,
  FiPower,
  FiKey,
  FiMail,
  FiChevronLeft,
  FiChevronRight,
  FiCheckCircle,
  FiXCircle,
  FiClock,
  FiSearch,
  FiX,
  FiUser,
  FiActivity
} from 'react-icons/fi';

const emptyForm = {
  name: '',
  email: '',
  password: '',
  description: ''
};

// ✅ Relative time (past)
function formatRelativeTime(date) {
  if (!date) return 'Never';
  const diff = Date.now() - new Date(date).getTime();
  const sec = Math.floor(diff / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return 'Just now';
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr ago`;
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// ✅ Relative time (future) — for "disabled until"
function formatUntilTime(date) {
  if (!date) return '—';
  const diffMs = new Date(date).getTime() - Date.now();
  if (diffMs <= 0) return 'Expired';

  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return `in ${sec}s`;
  if (min < 60) return `in ${min} min`;
  if (hr < 24) return `in ${hr} hr`;
  if (day < 7) return `in ${day} day${day > 1 ? 's' : ''}`;
  return new Date(date).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

function formatFullDate(date) {
  if (!date) return '—';
  return new Date(date).toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Kolkata'
  });
}

// ✅ Get real-time counter status: DISABLED -> OFFLINE -> ONLINE
const getCounterStatus = (counter) => {
  const isCounterDisabled = !counter?.isActive || (counter?.disabledUntil && new Date(counter.disabledUntil) > new Date());
  const isUserDisabled = counter?.userId && (!counter.userId.isActive || (counter.userId.disabledUntil && new Date(counter.userId.disabledUntil) > new Date()));
  if (isCounterDisabled || isUserDisabled) return 'DISABLED';
  if (!counter?.userId?.isOnline) return 'OFFLINE';
  return 'ONLINE';
};

const getStatusDotColor = (status) => {
  switch (status) {
    case 'ONLINE': return 'bg-emerald-500';
    case 'DISABLED': return 'bg-rose-500';
    case 'OFFLINE': default: return 'bg-gray-400';
  }
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function AdminCountersPage() {
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [passwordModal, setPasswordModal] = useState({
    open: false,
    counterId: null,
    counterName: ''
  });
  const [newPassword, setNewPassword] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all'); // 'all' | 'online' | 'offline' | 'disabled'
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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
    socket.on('usersUpdated', fetchCounters);
    return () => {
      socket.off('countersUpdated', fetchCounters);
      socket.off('usersUpdated', fetchCounters);
    };
  }, []);

  /* ---------- STATS (4-State Realtime Presence) ---------- */
  const stats = useMemo(() => {
    const total = counters.length;
    let online = 0;
    let onBreak = 0;
    let offline = 0;
    let disabled = 0;

    counters.forEach((c) => {
      const st = getCounterStatus(c);
      if (st === 'ONLINE') online++;
      else if (st === 'DISABLED') disabled++;
      else offline++;
    });

    return { total, online, offline, disabled };
  }, [counters]);

  /* ---------- SEARCH + STATUS FILTER ---------- */
  const filteredCounters = useMemo(() => {
    let list = counters;

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.description?.toLowerCase().includes(term) ||
          c.userId?.email?.toLowerCase().includes(term)
      );
    }

    if (statusFilter === 'online') {
      list = list.filter(c => getCounterStatus(c) === 'ONLINE');
    } else if (statusFilter === 'offline') {
      list = list.filter(c => getCounterStatus(c) === 'OFFLINE');
    } else if (statusFilter === 'disabled') {
      list = list.filter(c => getCounterStatus(c) === 'DISABLED');
    }

    return list;
  }, [counters, search, statusFilter]);

  /* ---------- PAGINATION ---------- */
  const totalItems = filteredCounters.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedCounters = useMemo(
    () => filteredCounters.slice(startIndex, startIndex + pageSize),
    [filteredCounters, startIndex, pageSize]
  );

  /* ---------- HANDLERS ---------- */
  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormData(emptyForm);
  };

  const openEdit = (counter) => {
    setEditing(counter._id);
    setFormData({
      name: counter.name || '',
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
        const { password, ...updateData } = formData;
        await api.put(`/counters/${editing}`, updateData);
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

  const openResetPassword = (counter) => {
    setPasswordModal({
      open: true,
      counterId: counter._id,
      counterName: counter.name
    });
    setNewPassword('');
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    try {
      await api.put(`/counters/${passwordModal.counterId}/reset-password`, {
        newPassword
      });
      toast.success('Password reset successfully');
      setPasswordModal({ open: false, counterId: null, counterName: '' });
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to reset password');
    }
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

  if (loading) {
    return (
      <div className="h-[70vh] flex items-center justify-center text-slate-500">
        Loading counters...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ---------- HEADER ---------- */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-slate-900 dark:text-white">
            Counter Management
          </h1>
          <p className="text-slate-500 mt-1">
            Manage counter login accounts and availability.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="h-11 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold flex items-center justify-center gap-2 shadow-lg shadow-indigo-500/20"
        >
          <FiPlus /> Add Counter
        </button>
      </div>

      {/* ---------- STATS CARDS (Realtime Presence Cards) ---------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-2">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-2xl p-4 text-white shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-xs font-medium uppercase tracking-wider">
                Total Counters
              </p>
              <p className="text-2xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiMonitor className="text-xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-2xl p-4 text-white shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white animate-pulse" />
                Online
              </p>
              <p className="text-2xl font-bold mt-1">{stats.online}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiActivity className="text-xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-slate-500 to-slate-600 rounded-2xl p-4 text-white shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-slate-200 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-slate-300" />
                Offline
              </p>
              <p className="text-2xl font-bold mt-1">{stats.offline}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiMonitor className="text-xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-2xl p-4 text-white shadow-md hover:-translate-y-0.5 transition-all duration-200">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-rose-100 text-xs font-medium uppercase tracking-wider flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-white" />
                Disabled
              </p>
              <p className="text-2xl font-bold mt-1">{stats.disabled}</p>
            </div>
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center">
              <FiXCircle className="text-xl text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- SEARCH + STATUS FILTER ---------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by counter name or login email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 pl-11 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <FiX />
              </button>
            )}
          </div>

          {/* Filter Tabs */}
          <div className="flex flex-wrap bg-slate-100 dark:bg-slate-800 p-1 rounded-xl gap-1">
            <button
              onClick={() => {
                setStatusFilter('all');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                statusFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => {
                setStatusFilter('online');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'online'
                  ? 'bg-white dark:bg-slate-700 shadow text-emerald-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Online ({stats.online})
            </button>
            <button
              onClick={() => {
                setStatusFilter('offline');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'offline'
                  ? 'bg-white dark:bg-slate-700 shadow text-slate-700 dark:text-slate-300'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Offline ({stats.offline})
            </button>
            <button
              onClick={() => {
                setStatusFilter('disabled');
                setPage(1);
              }}
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                statusFilter === 'disabled'
                  ? 'bg-white dark:bg-slate-700 shadow text-rose-600'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              Disabled ({stats.disabled})
            </button>
          </div>
        </div>
      </div>

      {/* ---------- LIST / TABLE ---------- */}
      {filteredCounters.length === 0 ? (
        <div className="bg-white dark:bg-slate-900 border border-dashed border-slate-300 dark:border-slate-700 rounded-2xl py-16 text-center">
          <FiMonitor className="mx-auto text-5xl text-slate-300 mb-4" />
          <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-200">
            No Counters Found
          </h2>
          <p className="text-slate-500 mt-1 text-sm">
            {search
              ? 'Try a different search term.'
              : statusFilter !== 'all'
                ? `No ${statusFilter} counters found.`
                : 'Add your first counter to get started.'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-slate-50 dark:bg-slate-800/60">
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500 dark:text-slate-400 font-semibold">
                  <th className="px-5 py-3">Counter</th>
                  <th className="px-5 py-3">Login Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3">Last Seen</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedCounters.map((counter) => {
                  const status = getCounterStatus(counter);
                  const dotColor = getStatusDotColor(status);
                  const lastLogin = counter.userId?.lastLogin || null;
                  const lastSeen = counter.userId?.lastSeen || lastLogin;

                  return (
                    <tr
                      key={counter._id}
                      className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-300 flex items-center justify-center shrink-0">
                              <FiMonitor />
                            </div>
                            <span className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full ${dotColor} border-2 border-white dark:border-slate-900 ${status === 'ONLINE' ? 'animate-pulse' : ''}`} />
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              {counter.name}
                            </span>
                            {counter.description && (
                              <span className="text-xs text-slate-500 dark:text-slate-400">
                                {counter.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <FiMail className="text-slate-400 text-xs" />
                          {counter.userId?.email || (
                            <span className="text-slate-400 italic">
                              No login account
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Realtime Status */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col items-start gap-1">
                          {status === 'ONLINE' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-700/50">
                              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                              ONLINE
                            </span>
                          )}
                          {status === 'OFFLINE' && (
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-300 dark:border-slate-700">
                              <span className="w-2 h-2 rounded-full bg-slate-400" />
                              OFFLINE
                            </span>
                          )}
                          {status === 'DISABLED' && (
                            <div className="flex flex-col">
                              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-rose-100 dark:bg-rose-900/30 text-rose-700 dark:text-rose-400 border border-rose-300 dark:border-rose-700/50">
                                <span className="w-2 h-2 rounded-full bg-rose-500" />
                                DISABLED
                              </span>
                              {(counter.disabledUntil || counter.userId?.disabledUntil) && (
                                <span className="text-[10px] text-rose-500 mt-0.5">
                                  Until {formatUntilTime(counter.disabledUntil || counter.userId?.disabledUntil)}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Last Login */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {formatRelativeTime(lastLogin)}
                          </span>
                          {lastLogin && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {formatFullDate(lastLogin)}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Last Seen */}
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {formatRelativeTime(lastSeen)}
                          </span>
                          {lastSeen && (
                            <span className="text-[10px] text-slate-400 mt-0.5">
                              {formatFullDate(lastSeen)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEdit(counter)}
                            title="Edit"
                            className="w-9 h-9 rounded-lg bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition"
                          >
                            <FiEdit2 className="text-sm" />
                          </button>
                          <button
                            onClick={() => openResetPassword(counter)}
                            title="Reset password"
                            className="w-9 h-9 rounded-lg bg-yellow-100 hover:bg-yellow-200 text-yellow-600 flex items-center justify-center transition"
                          >
                            <FiKey className="text-sm" />
                          </button>
                          <button
                            onClick={() =>
                              setStatus(counter, !counter.isActive)
                            }
                            title={counter.isActive ? 'Disable' : 'Enable'}
                            className="w-9 h-9 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                          >
                            <FiPower className="text-sm" />
                          </button>
                          <button
                            onClick={() => deleteCounter(counter)}
                            title="Delete"
                            className="w-9 h-9 rounded-lg bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition"
                          >
                            <FiTrash2 className="text-sm" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* ✅ PAGINATION FOOTER — Rows per page moved here */}
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 border-t border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40">
            <p className="text-sm text-slate-500">
              Showing{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-slate-700 dark:text-slate-200">
                {totalItems}
              </span>{' '}
              counters
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {/* ✅ Rows per page */}
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-slate-500 whitespace-nowrap">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={(e) => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAGE_SIZE_OPTIONS.map((n) => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                <FiChevronLeft /> Prev
              </button>

              <div className="flex items-center gap-1">
                {(() => {
                  const pages = [];
                  const maxShown = 5;
                  let startPage = Math.max(
                    1,
                    page - Math.floor(maxShown / 2)
                  );
                  let endPage = Math.min(
                    totalPages,
                    startPage + maxShown - 1
                  );
                  if (endPage - startPage < maxShown - 1) {
                    startPage = Math.max(1, endPage - maxShown + 1);
                  }
                  for (let i = startPage; i <= endPage; i++) pages.push(i);

                  return (
                    <>
                      {startPage > 1 && (
                        <>
                          <button
                            onClick={() => setPage(1)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === 1
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            1
                          </button>
                          {startPage > 2 && (
                            <span className="px-1 text-slate-400">…</span>
                          )}
                        </>
                      )}
                      {pages.map((n) => (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`h-9 w-9 rounded-lg text-sm font-medium ${
                            n === page
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && (
                            <span className="px-1 text-slate-400">…</span>
                          )}
                          <button
                            onClick={() => setPage(totalPages)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === totalPages
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300'
                            }`}
                          >
                            {totalPages}
                          </button>
                        </>
                      )}
                    </>
                  );
                })()}
              </div>

              <button
                onClick={() =>
                  setPage((p) => Math.min(totalPages, p + 1))
                }
                disabled={page === totalPages}
                className="h-9 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                Next <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ---------- MODAL ---------- */}
      {modalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <form
            onSubmit={saveCounter}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4 shadow-2xl border border-slate-200 dark:border-slate-800"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {editing ? 'Edit Counter' : 'Add Counter'}
            </h2>

            {(editing ? ['name', 'email', 'description'] : ['name', 'email', 'password', 'description']).map(
              (field) => (
                <div key={field}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                    {field === 'description' ? 'Description (optional)' : field}
                  </label>
                  <input
                    type={field === 'password' ? 'password' : 'text'}
                    placeholder={
                      field[0].toUpperCase() + field.slice(1)
                    }
                    value={formData[field]}
                    onChange={(e) =>
                      setFormData({ ...formData, [field]: e.target.value })
                    }
                    className="w-full h-11 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white disabled:opacity-60 outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              )
            )}

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className="h-10 px-4 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
              <button className="h-10 px-4 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold">
                Save
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ---------- RESET PASSWORD MODAL ---------- */}
      {passwordModal.open && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-white dark:bg-slate-900 rounded-2xl p-6 shadow-2xl border border-slate-200 dark:border-slate-800">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  Reset Password
                </h2>
                <p className="text-sm text-slate-500 mt-1">
                  {passwordModal.counterName}
                </p>
              </div>
              <button
                type="button"
                onClick={() =>
                  setPasswordModal({ open: false, counterId: null, counterName: '' })
                }
                className="w-10 h-10 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center text-slate-500"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleResetPassword}>
              <div className="relative mb-5">
                <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="password"
                  placeholder="Enter new password (min 6 chars)"
                  className="w-full pl-11 pr-4 py-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-yellow-500 text-sm"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  minLength={6}
                  required
                  autoFocus
                />
              </div>

              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setPasswordModal({ open: false, counterId: null, counterName: '' })
                  }
                  className="h-10 px-4 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 font-medium text-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="h-10 px-5 rounded-xl bg-yellow-500 hover:bg-yellow-600 text-white font-semibold shadow-lg shadow-yellow-500/20 text-sm"
                >
                  Reset Password
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}