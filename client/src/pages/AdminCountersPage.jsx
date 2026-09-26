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
  counterId: '',
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

// ✅ Online check — same 5-min rule as staff page
const isCounterOnline = (counter) => {
  const last = counter?.userId?.lastLogin;
  if (!last) return false;
  return Date.now() - new Date(last).getTime() < 5 * 60 * 1000;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function AdminCountersPage() {
  const [counters, setCounters] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [formData, setFormData] = useState(emptyForm);

  const [search, setSearch] = useState('');
  const [onlineFilter, setOnlineFilter] = useState('all'); // 'all' | 'online' | 'offline'
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
    return () => socket.off('countersUpdated', fetchCounters);
  }, []);

  /* ---------- STATS ---------- */
  const stats = useMemo(() => {
    const total = counters.length;
    const active = counters.filter((c) => c.isActive).length;
    const disabled = counters.filter((c) => !c.isActive).length;
    const online = counters.filter(isCounterOnline).length;
    return { total, active, disabled, online };
  }, [counters]);

  /* ---------- SEARCH + ONLINE FILTER ---------- */
  const filteredCounters = useMemo(() => {
    let list = counters;

    if (search.trim()) {
      const term = search.toLowerCase().trim();
      list = list.filter(
        (c) =>
          c.name?.toLowerCase().includes(term) ||
          c.counterId?.toLowerCase().includes(term) ||
          c.userId?.email?.toLowerCase().includes(term)
      );
    }

    if (onlineFilter === 'online') {
      list = list.filter(isCounterOnline);
    } else if (onlineFilter === 'offline') {
      list = list.filter((c) => !isCounterOnline(c));
    }

    return list;
  }, [counters, search, onlineFilter]);

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
    await api.put(`/counters/${counter._id}/reset-password`, {
      newPassword: result.value
    });
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

      {/* ---------- STATS CARDS ---------- */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-2">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-sm font-medium">
                Total Counters
              </p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiMonitor className="text-2xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-emerald-100 text-sm font-medium">Active</p>
              <p className="text-3xl font-bold mt-1">{stats.active}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiCheckCircle className="text-2xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-rose-100 text-sm font-medium">Disabled</p>
              <p className="text-3xl font-bold mt-1">{stats.disabled}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiXCircle className="text-2xl text-white" />
            </div>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-amber-100 text-sm font-medium">Online now</p>
              <p className="text-3xl font-bold mt-1">{stats.online}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiActivity className="text-2xl text-white" />
            </div>
          </div>
        </div>
      </div>

      {/* ---------- SEARCH + ONLINE FILTER ---------- */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-4 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              placeholder="Search by name, counter ID or email..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setPage(1);
              }}
              className="w-full h-11 pl-11 pr-10 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
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

          {/* ✅ Online / Offline / All filter */}
          <div className="flex bg-slate-100 dark:bg-slate-800 p-1 rounded-xl">
            <button
              onClick={() => {
                setOnlineFilter('all');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                onlineFilter === 'all'
                  ? 'bg-white dark:bg-slate-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-slate-500'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => {
                setOnlineFilter('online');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                onlineFilter === 'online'
                  ? 'bg-white dark:bg-slate-700 shadow text-emerald-600'
                  : 'text-slate-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Online ({stats.online})
            </button>
            <button
              onClick={() => {
                setOnlineFilter('offline');
                setPage(1);
              }}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-1.5 ${
                onlineFilter === 'offline'
                  ? 'bg-white dark:bg-slate-700 shadow text-slate-700 dark:text-slate-300'
                  : 'text-slate-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              Offline ({stats.total - stats.online})
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
              : onlineFilter !== 'all'
                ? `No ${onlineFilter} counters found.`
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
                  <th className="px-5 py-3">Counter ID</th>
                  <th className="px-5 py-3">Login Email</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Disabled Until</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {pagedCounters.map((counter) => {
                  const lastLogin = counter.userId?.lastLogin || null;
                  const isOnline = isCounterOnline(counter);

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
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full bg-emerald-500 border-2 border-white dark:border-slate-900" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-900 dark:text-white text-sm">
                              {counter.name}
                            </span>
                            {counter.description && (
                              <span className="text-xs text-slate-400">
                                {counter.description}
                              </span>
                            )}
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="font-mono text-xs font-semibold px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300">
                          {counter.counterId}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300">
                          <FiMail className="text-slate-400" />
                          {counter.userId?.email || (
                            <span className="text-slate-400 italic">
                              No login account
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            counter.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {counter.isActive ? (
                            <>
                              <FiCheckCircle className="text-xs" />
                              Enabled
                            </>
                          ) : (
                            <>
                              <FiXCircle className="text-xs" />
                              Disabled
                            </>
                          )}
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        {!counter.isActive && counter.disabledUntil ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                              <FiClock className="text-xs" />
                              {formatUntilTime(counter.disabledUntil)}
                            </span>
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {formatFullDate(counter.disabledUntil)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-slate-400 text-sm">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`text-sm font-medium ${
                              lastLogin
                                ? isOnline
                                  ? 'text-emerald-600'
                                  : 'text-slate-700 dark:text-slate-300'
                                : 'text-slate-400'
                            }`}
                          >
                            {formatRelativeTime(lastLogin)}
                          </span>
                          {lastLogin && (
                            <span className="text-[11px] text-slate-400 mt-0.5">
                              {formatFullDate(lastLogin)}
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
                            onClick={() => resetPassword(counter)}
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
        <div className="fixed inset-0 z-[60] bg-black/50 flex items-center justify-center p-4">
          <form
            onSubmit={saveCounter}
            className="w-full max-w-lg bg-white dark:bg-slate-900 rounded-2xl p-5 space-y-4 shadow-2xl"
          >
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">
              {editing ? 'Edit Counter' : 'Add Counter'}
            </h2>

            {['name', 'counterId', 'email', 'password', 'description'].map(
              (field) => (
                <div key={field}>
                  <label className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 mb-1 block">
                    {field === 'counterId' ? 'Counter ID' : field}
                  </label>
                  <input
                    type={field === 'password' ? 'password' : 'text'}
                    disabled={editing && field === 'counterId'}
                    placeholder={
                      field === 'counterId'
                        ? 'counter-1'
                        : field[0].toUpperCase() + field.slice(1)
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
    </div>
  );
}