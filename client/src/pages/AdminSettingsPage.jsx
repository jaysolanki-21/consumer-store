import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import {
  FiSettings,
  FiShield,
  FiCheckCircle,
  FiAlertTriangle,
  FiRefreshCw,
  FiClock,
  FiUser,
  FiEye,
  FiSave,
  FiX,
  FiLock,
  FiSliders,
} from 'react-icons/fi';

import api from '../services/api';
import socket from '../services/socket';
import { setMaintenanceMode } from '../redux/slices/settingsSlice';
import MaintenanceAnimation from '../components/MaintenanceAnimation';

export default function AdminSettingsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const maintenance = useSelector((state) => state.settings?.maintenanceMode);

  // Local state for editing title and message
  const [title, setTitle] = useState(maintenance?.title || 'System Under Maintenance');
  const [message, setMessage] = useState(
    maintenance?.message ||
      "We're temporarily performing system maintenance to improve your experience. Please try again after some time."
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Confirmation Modal state: 'enable' | 'disable' | null
  const [confirmModal, setConfirmModal] = useState(null);

  // Live preview modal state
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  // Sync redux state to local inputs when maintenance changes
  useEffect(() => {
    if (maintenance) {
      setTitle(maintenance.title || 'System Under Maintenance');
      setMessage(
        maintenance.message ||
          "We're temporarily performing system maintenance to improve your experience. Please try again after some time."
      );
    }
  }, [maintenance]);

  // Fetch latest maintenance status on mount
  const fetchStatus = useCallback(async () => {
    try {
      setIsRefreshing(true);
      const { data } = await api.get('/settings/maintenance');
      if (data?.maintenanceMode) {
        dispatch(setMaintenanceMode(data.maintenanceMode));
      }
    } catch (err) {
      console.error('Failed to fetch maintenance status:', err);
      toast.error('Unable to fetch maintenance status. Please refresh.');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  useEffect(() => {
    fetchStatus();

    // Listen to realtime changes from other tabs or admins
    const handleSocketUpdate = (data) => {
      if (data) {
        dispatch(setMaintenanceMode(data));
      }
    };

    socket.on('maintenanceModeChanged', handleSocketUpdate);
    return () => {
      socket.off('maintenanceModeChanged', handleSocketUpdate);
    };
  }, [fetchStatus, dispatch]);

  // Toggle Maintenance Mode handler
  const handleToggleMode = async (targetEnabled) => {
    if (isLoading) return;
    setIsLoading(true);

    try {
      const { data } = await api.put('/settings/maintenance', {
        enabled: targetEnabled,
        title: title.trim(),
        message: message.trim(),
      });

      if (data?.maintenanceMode) {
        dispatch(setMaintenanceMode(data.maintenanceMode));
      }

      toast.success(
        targetEnabled
          ? 'Maintenance mode enabled successfully'
          : 'Maintenance mode disabled successfully',
        {
          id: 'maintenance-toggle-toast',
          duration: 3000,
        }
      );
      setConfirmModal(null);
    } catch (err) {
      console.error('Failed to toggle maintenance mode:', err);
      toast.error(
        err.response?.data?.message || 'Unable to update maintenance status. Please try again.',
        { id: 'maintenance-err-toast' }
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Save text changes without changing active/inactive status
  const handleSaveTextConfig = async (e) => {
    e.preventDefault();
    if (isSavingText) return;
    setIsSavingText(true);

    try {
      const { data } = await api.put('/settings/maintenance', {
        enabled: maintenance?.enabled || false,
        title: title.trim(),
        message: message.trim(),
      });

      if (data?.maintenanceMode) {
        dispatch(setMaintenanceMode(data.maintenanceMode));
      }

      toast.success('Maintenance message updated successfully', {
        id: 'maintenance-text-toast',
      });
    } catch (err) {
      console.error('Failed to save maintenance text:', err);
      toast.error(err.response?.data?.message || 'Failed to save maintenance details');
    } finally {
      setIsSavingText(false);
    }
  };

  const isEnabled = !!maintenance?.enabled;
  const lastUpdated = maintenance?.updatedAt
    ? new Date(maintenance.updatedAt).toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
      })
    : 'Not recorded';
  const updatedBy = maintenance?.updatedByName || 'Administrator';

  return (
    <div className="min-h-screen p-4 sm:p-6 lg:p-8 space-y-8 max-w-7xl mx-auto">
      {/* PAGE HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-indigo-600/10 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 flex items-center justify-center text-xl font-bold">
              <FiSettings />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                System Settings
              </h1>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
                Configure system-wide settings, access policies and maintenance controls
              </p>
            </div>
          </div>
        </div>

        {/* Refresh button */}
        <div className="flex items-center gap-3">
          <button
            onClick={fetchStatus}
            disabled={isRefreshing}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 text-sm font-medium hover:bg-slate-50 dark:hover:bg-slate-750 transition shadow-sm disabled:opacity-50"
            title="Refresh settings"
          >
            <FiRefreshCw className={`text-base ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>
      </div>

      {/* TABS HEADER */}
      <div className="border-b border-slate-200 dark:border-slate-800 flex gap-4">
        <button className="flex items-center gap-2 pb-3.5 px-2 border-b-2 border-indigo-600 text-indigo-600 dark:text-indigo-400 font-semibold text-sm transition">
          <FiShield className="text-base" />
          <span>Maintenance Mode</span>
        </button>
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        {/* LEFT COLUMN: Main Maintenance Status Card */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 pb-6 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <FiSliders className="text-indigo-600 dark:text-indigo-400" />
                  <span>System Maintenance</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1 max-w-xl">
                  When enabled, Staff and Counter users will temporarily be unable to access the POS system. Administrators can continue using the system normally.
                </p>
              </div>

              {/* Status Badge */}
              <div className="flex-shrink-0">
                {isEnabled ? (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                    <span>● Maintenance mode is active</span>
                  </div>
                ) : (
                  <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-bold">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span>● System is currently operational</span>
                  </div>
                )}
              </div>
            </div>

            {/* ACTION CARD */}
            <div
              className={`p-6 rounded-2xl border transition-all duration-200 ${
                isEnabled
                  ? 'bg-amber-500/5 dark:bg-amber-500/10 border-amber-500/30'
                  : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700/60'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">
                    System State
                  </p>
                  <p className="text-base font-bold text-slate-900 dark:text-white">
                    {isEnabled ? 'Maintenance Mode Active' : 'System Operational (Normal)'}
                  </p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    {isEnabled
                      ? 'Staff and Counter access is currently restricted.'
                      : 'Staff and Counter users have full POS access.'}
                  </p>
                </div>

                {/* Main Action Button */}
                <button
                  onClick={() => setConfirmModal(isEnabled ? 'disable' : 'enable')}
                  disabled={isLoading}
                  className={`px-6 py-3 rounded-xl font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer ${
                    isEnabled
                      ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                  } disabled:opacity-50`}
                >
                  {isLoading ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>{isEnabled ? 'Disabling...' : 'Enabling...'}</span>
                    </>
                  ) : isEnabled ? (
                    <>
                      <FiCheckCircle className="text-base" />
                      <span>Disable Maintenance Mode</span>
                    </>
                  ) : (
                    <>
                      <FiShield className="text-base" />
                      <span>Enable Maintenance Mode</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* CUSTOM MESSAGE CONFIGURATION */}
            <form onSubmit={handleSaveTextConfig} className="space-y-4 pt-4 border-t border-slate-100 dark:border-slate-800">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                    Custom Maintenance Notice
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400">
                    Customize the announcement shown to Staff and Counter users
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPreviewModal(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  <FiEye className="text-xs" />
                  <span>Preview Page</span>
                </button>
              </div>

              {/* Title input */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notice Title
                  </label>
                  <span className="text-[10px] text-slate-400">{title.length}/100</span>
                </div>
                <input
                  type="text"
                  maxLength={100}
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. System Under Maintenance"
                  className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition"
                />
              </div>

              {/* Message textarea */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                    Notice Message
                  </label>
                  <span className="text-[10px] text-slate-400">{message.length}/500</span>
                </div>
                <textarea
                  rows={3}
                  maxLength={500}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="e.g. We are performing scheduled maintenance. Please try again shortly."
                  className="w-full p-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition resize-none"
                />
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={isSavingText}
                  className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  <FiSave className="text-sm" />
                  <span>{isSavingText ? 'Saving Notice...' : 'Save Custom Message'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>

        {/* RIGHT COLUMN: Audit Information & Security Details */}
        <div className="space-y-6">
          {/* Audit Info Card */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiClock className="text-indigo-600 dark:text-indigo-400" />
              <span>Audit Trail</span>
            </h3>

            <div className="space-y-3 divide-y divide-slate-100 dark:divide-slate-800 text-xs">
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Last Modified</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {lastUpdated}
                </span>
              </div>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Updated By</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
                  <FiUser className="text-xs text-indigo-500" />
                  {updatedBy}
                </span>
              </div>
              <div className="pt-2 flex items-center justify-between">
                <span className="text-slate-500 dark:text-slate-400">Current Status</span>
                <span
                  className={`font-bold px-2 py-0.5 rounded-md ${
                    isEnabled
                      ? 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400'
                  }`}
                >
                  {isEnabled ? 'MAINTENANCE ACTIVE' : 'OPERATIONAL'}
                </span>
              </div>
            </div>
          </div>

          {/* Role Behavior Reference Card */}
          <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3">
            <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
              <FiLock className="text-indigo-500" />
              <span>Role Permissions During Maintenance</span>
            </h3>
            <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2">
              <li className="flex items-start gap-2">
                <span className="text-emerald-500 font-bold">✓</span>
                <span>
                  <strong>Administrator:</strong> Unrestricted access at all times. Cannot be locked out.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">✕</span>
                <span>
                  <strong>Staff Users:</strong> Redirected to Maintenance Page with live status checker.
                </span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-amber-500 font-bold">✕</span>
                <span>
                  <strong>Counter / POS:</strong> Redirected to Maintenance Page. POS ordering paused.
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>

      {/* CONFIRMATION MODAL */}
      <AnimatePresence>
        {confirmModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Subtle Overlay Backdrop - background remains recognizable and lightly dimmed */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => !isLoading && setConfirmModal(null)}
              className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
              }}
              aria-hidden="true"
            />

            {/* Modal Dialog Content - Sharp, Centered, and Unaffected by Overlay Filters */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 ${
                    confirmModal === 'enable'
                      ? 'bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400'
                      : 'bg-emerald-100 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-400'
                  }`}
                >
                  <FiAlertTriangle />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    {confirmModal === 'enable'
                      ? 'Enable Maintenance Mode?'
                      : 'Disable Maintenance Mode?'}
                  </h3>
                  <p className="text-xs text-slate-400 dark:text-slate-500">Confirmation Required</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                {confirmModal === 'enable'
                  ? 'Staff and Counter users will be unable to access the POS until maintenance mode is disabled.'
                  : 'Staff and Counter users will regain access to the POS.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setConfirmModal(null)}
                  disabled={isLoading}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleMode(confirmModal === 'enable')}
                  disabled={isLoading}
                  className={`px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2 cursor-pointer ${
                    confirmModal === 'enable'
                      ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
                      : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-emerald-500/20'
                  } disabled:opacity-50`}
                >
                  {isLoading && (
                    <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  )}
                  <span>
                    {confirmModal === 'enable' ? 'Enable Maintenance' : 'Disable Maintenance'}
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* LIVE PREVIEW MODAL */}
      <AnimatePresence>
        {showPreviewModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Subtle Overlay Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowPreviewModal(false)}
              className="fixed inset-0 bg-black/50 backdrop-blur-[2px]"
              style={{
                backgroundColor: 'rgba(0, 0, 0, 0.5)',
                backdropFilter: 'blur(2px)',
                WebkitBackdropFilter: 'blur(2px)',
              }}
              aria-hidden="true"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 bg-slate-900 border border-slate-800 rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl space-y-6 text-center text-white"
            >
              <button
                onClick={() => setShowPreviewModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center transition"
              >
                <FiX />
              </button>

              <div className="text-xs uppercase tracking-widest text-amber-400 font-bold">
                Preview Mode
              </div>

              <MaintenanceAnimation />

              <div className="space-y-2">
                <h3 className="text-xl sm:text-2xl font-extrabold text-white">
                  {title || 'System Under Maintenance'}
                </h3>
                <p className="text-sm text-slate-300 max-w-sm mx-auto">
                  {message ||
                    "We're temporarily performing system maintenance to improve your experience. Please try again after some time."}
                </p>
              </div>

              <div className="pt-2">
                <div className="inline-block px-6 py-2.5 rounded-xl bg-amber-500 text-slate-950 font-bold text-xs opacity-90 cursor-not-allowed">
                  Try Again (Preview)
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
