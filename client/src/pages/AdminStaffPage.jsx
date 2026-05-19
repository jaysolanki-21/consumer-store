import { useState, useEffect } from 'react';
import api from '../services/api';
import toast from 'react-hot-toast';
import {
  FiUserPlus,
  FiEdit2,
  FiTrash2,
  FiKey,
  FiMail,
  FiUser,
  FiShield,
  FiSearch,
  FiX
} from 'react-icons/fi';

export default function AdminStaffPage() {
  const [staff, setStaff] = useState([]);
  const [filteredStaff, setFilteredStaff] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);

  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: ''
  });

  const [passwordModal, setPasswordModal] = useState({
    open: false,
    staffId: null,
    staffName: ''
  });

  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    fetchStaff();
  }, []);

  useEffect(() => {
    if (!search.trim()) {
      setFilteredStaff(staff);
    } else {
      setFilteredStaff(
        staff.filter(
          member =>
            member.name.toLowerCase().includes(search.toLowerCase()) ||
            member.email.toLowerCase().includes(search.toLowerCase())
        )
      );
    }
  }, [search, staff]);

  const fetchStaff = async () => {
    try {
      const { data } = await api.get('/users/staff');
      setStaff(data);
      setFilteredStaff(data);
    } catch (err) {
      toast.error('Failed to load staff');
    } finally {
      setLoading(false);
    }
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
      if (editing) {
        await api.put(`/users/staff/${editing}`, {
          name: formData.name,
          email: formData.email
        });

        toast.success('Staff updated');
      } else {
        await api.post('/users/staff', {
          name: formData.name,
          email: formData.email,
          password: formData.password
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
    if (!window.confirm(`Delete staff "${name}"?`)) return;

    try {
      await api.delete(`/users/staff/${id}`);
      toast.success('Staff deleted');
      fetchStaff();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Delete failed');
    }
  };

  const handleResetPassword = async () => {
    if (!newPassword || newPassword.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    try {
      await api.put(
        `/users/staff/${passwordModal.staffId}/reset-password`,
        {
          newPassword
        }
      );

      toast.success(`Password reset for ${passwordModal.staffName}`);

      setPasswordModal({
        open: false,
        staffId: null,
        staffName: ''
      });

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

    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditing(null);

    setFormData({
      name: '',
      email: '',
      password: ''
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);

    setEditing(null);

    setFormData({
      name: '',
      email: '',
      password: ''
    });
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

      {/* Top Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
  {/* Total Staff Card */}
  <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-indigo-100 text-sm font-medium">Total Staff</p>
        <p className="text-3xl font-bold mt-1">{staff.length}</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
        <FiUser className="text-2xl text-white" />
      </div>
    </div>
   
  </div>

  {/* Admin Controlled Card */}
  <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-emerald-100 text-sm font-medium">Admin Controlled</p>
        <p className="text-3xl font-bold mt-1">100%</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
        <FiShield className="text-2xl text-white" />
      </div>
    </div>
   
  </div>

  {/* Search Staff Card */}
  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
    <div className="flex justify-between items-start">
      <div>
        <p className="text-amber-100 text-sm font-medium">Search Staff</p>
        <p className="text-lg font-semibold mt-1">Fast Access</p>
      </div>
      <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
        <FiSearch className="text-2xl text-white" />
      </div>
    </div>
   
  </div>
</div>

      {/* Search */}
      <div className="bg-white dark:bg-gray-800 rounded-3xl p-4 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="relative">
          <FiSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg" />

          <input
            type="text"
            placeholder="Search by staff name or email..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-12 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>
      </div>

      {/* Staff Cards */}
      {filteredStaff.length === 0 ? (
        <div className="bg-white dark:bg-gray-800 rounded-3xl p-10 text-center shadow-sm border border-gray-100 dark:border-gray-700">
          <FiUser className="mx-auto text-5xl text-gray-300 mb-4" />

          <h2 className="text-xl font-semibold mb-2">
            No Staff Found
          </h2>

          <p className="text-gray-500">
            Try changing your search or add new staff members
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
          {filteredStaff.map(member => (
            <div
              key={member._id}
              className="bg-white dark:bg-gray-800 rounded-3xl p-5 shadow-sm border border-gray-100 dark:border-gray-700 hover:shadow-xl transition-all duration-300"
            >
              <div className="flex items-start justify-between gap-4">
                {/* Left */}
                <div className="flex items-start gap-4">
                  <div className="w-16 h-16 rounded-2xl bg-indigo-100 dark:bg-indigo-500/20 flex items-center justify-center">
                    <FiUser className="text-indigo-600 text-2xl" />
                  </div>

                  <div>
                    <h2 className="text-lg font-bold text-gray-800 dark:text-white">
                      {member.name}
                    </h2>

                    <div className="flex items-center gap-2 text-gray-500 mt-1 text-sm">
                      <FiMail />
                      {member.email}
                    </div>

                    <div className="mt-3 flex items-center gap-2">
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-green-100 text-green-700">
                        Staff
                      </span>

                      <span className="text-xs text-gray-400">
                        Joined{' '}
                        {new Date(member.createdAt).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => openEditModal(member)}
                    className="w-10 h-10 rounded-xl bg-blue-100 hover:bg-blue-200 text-blue-600 flex items-center justify-center transition"
                  >
                    <FiEdit2 />
                  </button>

                  <button
                    onClick={() =>
                      setPasswordModal({
                        open: true,
                        staffId: member._id,
                        staffName: member.name
                      })
                    }
                    className="w-10 h-10 rounded-xl bg-yellow-100 hover:bg-yellow-200 text-yellow-600 flex items-center justify-center transition"
                  >
                    <FiKey />
                  </button>

                  <button
                    onClick={() =>
                      handleDelete(member._id, member.name)
                    }
                    className="w-10 h-10 rounded-xl bg-red-100 hover:bg-red-200 text-red-600 flex items-center justify-center transition"
                  >
                    <FiTrash2 />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create/Edit Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl animate-in fade-in zoom-in-95">
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
                      setFormData({
                        ...formData,
                        name: e.target.value
                      })
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
                      setFormData({
                        ...formData,
                        email: e.target.value
                      })
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
                        setFormData({
                          ...formData,
                          password: e.target.value
                        })
                      }
                      className="w-full pl-11 pr-4 py-3 rounded-2xl border border-gray-200 dark:border-gray-700 dark:bg-gray-900 outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Minimum 6 characters"
                      minLength="6"
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

      {/* Reset Password Modal */}
      {passwordModal.open && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white dark:bg-gray-800 rounded-3xl w-full max-w-md p-6 shadow-2xl">
            <div className="flex items-center justify-between mb-5">
              <div>
                <h2 className="text-2xl font-bold">
                  Reset Password
                </h2>

                <p className="text-sm text-gray-500 mt-1">
                  {passwordModal.staffName}
                </p>
              </div>

              <button
                onClick={() =>
                  setPasswordModal({
                    open: false,
                    staffId: null,
                    staffName: ''
                  })
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
                  setPasswordModal({
                    open: false,
                    staffId: null,
                    staffName: ''
                  })
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