import { useState, useEffect, useRef, useMemo } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import Swal from 'sweetalert2';
import {
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiKey,
  FiActivity,
  FiMail,
  FiUser,
  FiShield,
  FiSearch,
  FiX,
  FiPower,
  FiUpload,
  FiImage,
  FiClock,
  FiLogIn,
  FiCheckCircle,
  FiXCircle,
  FiCalendar,
  FiChevronLeft,
  FiChevronRight
} from 'react-icons/fi';

// ✅ Human-friendly relative time
function formatRelativeTime(date) {
  if (!date) return 'Never';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return 'Just now';
  if (min < 60) return `${min} min ago`;
  if (hr < 24) return `${hr} hr ago`;
  if (day < 7) return `${day} day${day > 1 ? 's' : ''} ago`;
  return then.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
}

// ✅ Relative time for future dates (for "disabled until")
function formatUntilTime(date) {
  if (!date) return '—';
  const now = new Date();
  const then = new Date(date);
  const diffMs = then - now;

  if (diffMs <= 0) return 'Expired';

  const sec = Math.floor(diffMs / 1000);
  const min = Math.floor(sec / 60);
  const hr = Math.floor(min / 60);
  const day = Math.floor(hr / 24);

  if (sec < 60) return `in ${sec}s`;
  if (min < 60) return `in ${min} min`;
  if (hr < 24) return `in ${hr} hr`;
  if (day < 7) return `in ${day} day${day > 1 ? 's' : ''}`;
  return then.toLocaleDateString('en-IN', {
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

// ✅ Sort helper — oldest → newest
const sortByOldest = (list) =>
  [...list].sort(
    (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
  );

// ✅ Online check (< 5 min since lastLogin)
const isMemberOnline = (member) => {
  if (!member?.lastLogin) return false;
  return Date.now() - new Date(member.lastLogin).getTime() < 5 * 60 * 1000;
};

const PAGE_SIZE_OPTIONS = [5, 10, 20, 50, 100];

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [onlineFilter, setOnlineFilter] = useState('all');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [imageFile, setImageFile] = useState(null);
  const [imagePreview, setImagePreview] = useState('');
  const fileInputRef = useRef(null);

  const [passwordModal, setPasswordModal] = useState({
    open: false,
    staffId: null,
    staffName: ''
  });

  const [newPassword, setNewPassword] = useState('');

  // ✅ PAGINATION STATE
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  useEffect(() => {
    fetchStaff();
  }, []);

  // ✅ SEARCH + ONLINE FILTER
  useEffect(() => {
    let list = staff;

    if (search.trim()) {
      const term = search.toLowerCase();
      list = list.filter(
        member =>
          member.name.toLowerCase().includes(term) ||
          member.email.toLowerCase().includes(term)
      );
    }

    if (onlineFilter === 'online') {
      list = list.filter(isMemberOnline);
    } else if (onlineFilter === 'offline') {
      list = list.filter(m => !isMemberOnline(m));
    }

    setFilteredStaff(sortByOldest(list));
    setPage(1);
  }, [search, staff, onlineFilter]);

  const fetchStaff = async () => {
    try {
      const { data } = await api.get('/users/staff');
      const sorted = sortByOldest(data);
      setStaff(sorted);
      setFilteredStaff(sorted);
    } catch (err) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
  };

  // ✅ Stats
  const stats = useMemo(() => {
    const total = staff.length;
    const active = staff.filter(s => s.isActive).length;
    const disabled = staff.filter(s => !s.isActive).length;
    const online = staff.filter(isMemberOnline).length;
    return { total, active, disabled, online };
  }, [staff]);

  // ✅ PAGINATION
  const totalItems = filteredStaff.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  useEffect(() => {
    if (page > totalPages) setPage(1);
  }, [totalPages, page]);

  const startIndex = (page - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, totalItems);
  const pagedStaff = useMemo(
    () => filteredStaff.slice(startIndex, startIndex + pageSize),
    [filteredStaff, startIndex, pageSize]
  );

  const handleImageChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('Please select an image file');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Image must be under 5MB');
      return;
    }

    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const clearImage = () => {
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleSubmit = async e => {
    e.preventDefault();

    if (!formData.name || !formData.email) {
      toast.error('Name and email are required');
      return;
    }

    if (!editing && !formData.password) {
      toast.error('Password is required');
      return;
    }

    try {
      const fd = new FormData();
      fd.append('name', formData.name);
      fd.append('email', formData.email);
      if (!editing) fd.append('password', formData.password);
      if (imageFile) fd.append('image', imageFile);

      if (editing) {
        await api.put(`/users/staff/${editing}`, fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Staff updated');
      } else {
        await api.post('/users/staff', fd, {
          headers: { 'Content-Type': 'multipart/form-data' }
        });
        toast.success('Staff created');
      }

      fetchStaff();
      closeModal();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Operation failed');
    }
  };

  const handleDelete = async (id, name) => {
    const result = await Swal.fire({
      title: `Delete staff "${name}"?`,
      icon: 'warning',
      showCancelButton: true,
      confirmButtonColor: '#dc2626',
      confirmButtonText: 'Delete'
    });
    if (!result.isConfirmed) return;

    try {
      await api.delete(`/users/staff/${id}`);
      toast.success('Staff deleted');
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleStatus = async member => {
    const nextActive = !member.isActive;
    const result = await Swal.fire({
      title: `${nextActive ? 'Enable' : 'Disable'} ${member.name}?`,
      input: nextActive ? undefined : 'datetime-local',
      inputLabel: nextActive ? undefined : 'Disable until (optional)',
      showCancelButton: true,
      confirmButtonText: nextActive ? 'Enable' : 'Disable',
      icon: 'warning'
    });
    if (!result.isConfirmed) return;

    try {
      await api.put(`/users/staff/${member._id}/status`, {
        isActive: nextActive,
        disabledUntil: nextActive ? null : result.value || null
      });
      toast.success(`Staff ${nextActive ? 'enabled' : 'disabled'}`);
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Status update failed');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await api.put(`/users/staff/${passwordModal.staffId}/reset-password`, {
        newPassword
      });

      toast.success(`Password reset for ${passwordModal.staffName}`);

      setPasswordModal({ open: false, staffId: null, staffName: '' });
      setNewPassword('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Reset failed');
    }
  };

  const openEditModal = member => {
    setEditing(member._id);
    setFormData({
      name: member.name,
      email: member.email,
      password: ''
    });
    setImageFile(null);
    setImagePreview(member.image || '');
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditing(null);
    setFormData({ name: '', email: '', password: '' });
    setImageFile(null);
    setImagePreview('');
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditing(null);
    setFormData({ name: '', email: '', password: '' });
    setImageFile(null);
    setImagePreview('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <div className="w-14 h-14 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-800 dark:text-white">
            Staff Management
          </h1>
          <p className="text-gray-500 mt-1">
            Manage staff accounts, credentials and access
          </p>
        </div>

        <button
          onClick={openCreateModal}
          className="flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-5 py-3 rounded-2xl shadow-lg shadow-indigo-500/20 transition-all duration-200 hover:scale-[1.02]"
        >
          <FiUserPlus size={18} />
          Add Staff
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300">
          <div className="flex justify-between items-start">
            <div>
              <p className="text-indigo-100 text-sm font-medium">Total Staff</p>
              <p className="text-3xl font-bold mt-1">{stats.total}</p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
              <FiUser className="text-2xl text-white" />
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

      {/* Search + Online Filter (Rows per page moved to footer) */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-col md:flex-row md:items-center gap-3 justify-between">
          <div className="relative flex-1">
            <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />
            <input
              type="text"
              placeholder="Search by staff name or email..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* ✅ Online / Offline / All filter */}
          <div className="flex bg-gray-100 dark:bg-gray-900 p-1 rounded-2xl">
            <button
              onClick={() => setOnlineFilter('all')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all ${
                onlineFilter === 'all'
                  ? 'bg-white dark:bg-gray-700 shadow text-indigo-600 dark:text-indigo-400'
                  : 'text-gray-500'
              }`}
            >
              All ({stats.total})
            </button>
            <button
              onClick={() => setOnlineFilter('online')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                onlineFilter === 'online'
                  ? 'bg-white dark:bg-gray-700 shadow text-emerald-600'
                  : 'text-gray-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              Online ({stats.online})
            </button>
            <button
              onClick={() => setOnlineFilter('offline')}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-1.5 ${
                onlineFilter === 'offline'
                  ? 'bg-white dark:bg-gray-700 shadow text-gray-700 dark:text-gray-300'
                  : 'text-gray-500'
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-gray-400" />
              Offline ({stats.total - stats.online})
            </button>
          </div>
        </div>
      </div>

      {/* Staff list (table) */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-700">
          <FiUser className="mx-auto text-5xl text-gray-300 mb-4" />
          <h2 className="text-xl font-semibold mb-2">No Staff Found</h2>
          <p className="text-gray-500">
            {onlineFilter !== 'all'
              ? `No ${onlineFilter} staff found`
              : 'Try changing your search or add new staff members'}
          </p>
        </div>
      ) : (
        <div className="bg-white dark:bg-gray-800 rounded-3xl shadow-sm border border-gray-100 dark:border-gray-700 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 dark:bg-gray-900/60">
                <tr className="text-left text-[11px] uppercase tracking-wider text-gray-500 dark:text-gray-400 font-semibold">
                  <th className="px-5 py-3">Staff</th>
                  <th className="px-5 py-3">Contact</th>
                  <th className="px-5 py-3">Role</th>
                  <th className="px-5 py-3">Status</th>
                  <th className="px-5 py-3">Disabled Until</th>
                  <th className="px-5 py-3">Last Login</th>
                  <th className="px-5 py-3">Joined</th>
                  <th className="px-5 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                {pagedStaff.map(member => {
                  const isOnline = isMemberOnline(member);

                  return (
                    <tr
                      key={member._id}
                      className="hover:bg-gray-50 dark:hover:bg-gray-900/40 transition"
                    >
                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-11 h-11 rounded-2xl overflow-hidden bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0">
                              {member.image ? (
                                <img
                                  src={member.image}
                                  alt={member.name}
                                  className="w-full h-full object-cover"
                                />
                              ) : (
                                <FiUser className="text-indigo-600 text-lg" />
                              )}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full bg-emerald-500 border-2 border-white dark:border-gray-800" />
                            )}
                          </div>
                          <div className="flex flex-col">
                            <span className="font-bold text-gray-800 dark:text-white text-sm">
                              {member.name}
                            </span>
                            <span className="text-xs text-gray-400 font-mono">
                              #{member._id.slice(-6)}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                          <FiMail className="text-gray-400" />
                          {member.email}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                          Staff
                        </span>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <span
                          className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-semibold ${
                            member.isActive
                              ? 'bg-emerald-100 text-emerald-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {member.isActive ? (
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
                        {!member.isActive && member.disabledUntil ? (
                          <div className="flex flex-col">
                            <span className="inline-flex items-center gap-1.5 text-sm font-medium text-amber-600 dark:text-amber-400">
                              <FiClock className="text-xs" />
                              {formatUntilTime(member.disabledUntil)}
                            </span>
                            <span className="text-[11px] text-gray-400 mt-0.5">
                              {formatFullDate(member.disabledUntil)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span
                            className={`inline-flex items-center gap-1.5 text-sm font-medium ${
                              member.lastLogin
                                ? isOnline
                                  ? 'text-emerald-600'
                                  : 'text-gray-700 dark:text-gray-300'
                                : 'text-gray-400'
                            }`}
                          >
                            <FiLogIn className="text-xs" />
                            {formatRelativeTime(member.lastLogin)}
                          </span>
                          {member.lastLogin && (
                            <span className="text-[11px] text-gray-400 mt-0.5">
                              {formatFullDate(member.lastLogin)}
                            </span>
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400">
                          <FiCalendar className="text-xs" />
                          {new Date(member.createdAt).toLocaleDateString(
                            'en-IN',
                            {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric'
                            }
                          )}
                        </div>
                      </td>

                      <td className="px-5 py-4 whitespace-nowrap text-right">
                        <div className="inline-flex items-center gap-2">
                          <button
                            onClick={() => openEditModal(member)}
                            title="Edit"
                            className="w-9 h-9 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition"
                          >
                            <FiEdit2 className="text-sm" />
                          </button>

                          <button
                            onClick={() =>
                              setPasswordModal({
                                open: true,
                                staffId: member._id,
                                staffName: member.name
                              })
                            }
                            title="Reset password"
                            className="w-9 h-9 rounded-xl bg-yellow-100 hover:bg-yellow-200 text-yellow-600 flex items-center justify-center transition"
                          >
                            <FiKey className="text-sm" />
                          </button>

                          <button
                            onClick={() => handleStatus(member)}
                            title={member.isActive ? 'Disable' : 'Enable'}
                            className="w-9 h-9 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center transition"
                          >
                            <FiPower className="text-sm" />
                          </button>

                          <button
                            onClick={() =>
                              handleDelete(member._id, member.name)
                            }
                            title="Delete"
                            className="w-9 h-9 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition"
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
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 px-5 py-4 border-t border-gray-100 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/40">
            <p className="text-sm text-gray-500">
              Showing{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {totalItems === 0 ? 0 : startIndex + 1}–{endIndex}
              </span>{' '}
              of{' '}
              <span className="font-semibold text-gray-700 dark:text-gray-200">
                {totalItems}
              </span>{' '}
              staff
            </p>

            <div className="flex items-center gap-2 flex-wrap">
              {/* ✅ Rows per page */}
              <div className="flex items-center gap-2 mr-2">
                <span className="text-sm text-gray-500 whitespace-nowrap">
                  Rows per page:
                </span>
                <select
                  value={pageSize}
                  onChange={e => {
                    setPageSize(Number(e.target.value));
                    setPage(1);
                  }}
                  className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-900 dark:text-white outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {PAGE_SIZE_OPTIONS.map(n => (
                    <option key={n} value={n}>
                      {n}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
                className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 flex items-center gap-1 text-sm"
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
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
                            }`}
                          >
                            1
                          </button>
                          {startPage > 2 && (
                            <span className="px-1 text-gray-400">…</span>
                          )}
                        </>
                      )}
                      {pages.map(n => (
                        <button
                          key={n}
                          onClick={() => setPage(n)}
                          className={`h-9 w-9 rounded-lg text-sm font-medium ${
                            n === page
                              ? 'bg-indigo-600 text-white'
                              : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                          }`}
                        >
                          {n}
                        </button>
                      ))}
                      {endPage < totalPages && (
                        <>
                          {endPage < totalPages - 1 && (
                            <span className="px-1 text-gray-400">…</span>
                          )}
                          <button
                            onClick={() => setPage(totalPages)}
                            className={`h-9 w-9 rounded-lg text-sm ${
                              page === totalPages
                                ? 'bg-indigo-600 text-white'
                                : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300'
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
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="h-9 px-3 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 disabled:opacity-40 flex items-center gap-1 text-sm"
              >
                Next <FiChevronRight />
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create / Edit modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-2xl font-bold">
                  {editing ? 'Edit Staff' : 'Add New Staff'}
                </h2>
                <p className="text-sm text-gray-500 mt-1">
                  Fill all required details
                </p>
              </div>

              <button
                onClick={closeModal}
                className="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
              >
                <FiX />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Image upload */}
              <div>
                <label className="text-sm font-medium mb-2 block">
                  Profile Image
                </label>

                <div className="flex items-center gap-4">
                  <div className="w-20 h-20 rounded-2xl overflow-hidden bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center shrink-0 border border-gray-200 dark:border-gray-700">
                    {imagePreview ? (
                      <img
                        src={imagePreview}
                        alt="preview"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <FiImage className="text-indigo-500 text-2xl" />
                    )}
                  </div>

                  <div className="flex flex-col gap-2">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageChange}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-indigo-50 hover:bg-indigo-100 text-indigo-600 text-sm font-medium transition"
                    >
                      <FiUpload />
                      {imagePreview ? 'Change Image' : 'Upload Image'}
                    </button>

                    {imageFile && (
                      <button
                        type="button"
                        onClick={clearImage}
                        className="text-xs text-red-500 hover:underline self-start"
                      >
                        Remove selected
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-400 mt-2">
                  JPG / PNG, max 5MB
                </p>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Full Name
                </label>
                <div className="relative">
                  <FiUser className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    value={formData.name}
                    onChange={e =>
                      setFormData({ ...formData, name: e.target.value })
                    }
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter full name"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="text-sm font-medium mb-2 block">
                  Email Address
                </label>
                <div className="relative">
                  <FiMail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                  <input
                    type="email"
                    value={formData.email}
                    onChange={e =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="Enter email"
                    required
                  />
                </div>
              </div>

              {!editing && (
                <div>
                  <label className="text-sm font-medium mb-2 block">
                    Password
                  </label>
                  <div className="relative">
                    <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
                    <input
                      type="password"
                      value={formData.password}
                      onChange={e =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Minimum 6 characters"
                      minLength={6}
                      required
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-5 py-3 rounded-2xl border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-3 rounded-2xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg shadow-indigo-500/20"
                >
                  {editing ? 'Update Staff' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reset password modal */}
      {passwordModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">Reset Password</h2>
                <p className="text-sm text-gray-500 mt-1">
                  {passwordModal.staffName}
                </p>
              </div>
              <button
                onClick={() =>
                  setPasswordModal({ open: false, staffId: null, staffName: '' })
                }
                className="w-10 h-10 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-700 flex items-center justify-center"
              >
                <FiX />
              </button>
            </div>

            <div className="relative mb-5">
              <FiKey className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="password"
                placeholder="Enter new password"
                className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-yellow-500"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() =>
                  setPasswordModal({ open: false, staffId: null, staffName: '' })
                }
                className="px-5 py-3 rounded-2xl border border-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
              >
                Cancel
              </button>
              <button
                onClick={handleResetPassword}
                className="px-5 py-3 rounded-2xl bg-yellow-500 hover:bg-yellow-600 text-white shadow-lg shadow-yellow-500/20"
              >
                Reset Password
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}