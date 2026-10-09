import { useState, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { Link } from 'react-router-dom';
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
  FiEyeOff,
  FiSave,
  FiX,
  FiLock,
  FiSliders,
  FiActivity,
  FiKey,
  FiUserPlus,
  FiUsers,
  FiMail,
  FiCheck,
  FiAlertCircle,
  FiDownload,
  FiUpload,
  FiDatabase,
  FiFileText,
  FiArchive,
  FiLayers,
} from 'react-icons/fi';

import api from '../services/api';
import socket from '../services/socket';
import { setMaintenanceMode } from '../redux/slices/settingsSlice';
import MaintenanceAnimation from '../components/MaintenanceAnimation';

export default function AdminSettingsPage() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const maintenance = useSelector((state) => state.settings?.maintenanceMode);

  // Active Settings Tab: 'maintenance' | 'security' | 'admins'
  const [activeTab, setActiveTab] = useState('maintenance');

  // Change Password Form State
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmNewPassword: '',
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isChangingPassword, setIsChangingPassword] = useState(false);
  const [passwordErrors, setPasswordErrors] = useState({});

  // Manage Admins State
  const [adminList, setAdminList] = useState([]);
  const [isLoadingAdmins, setIsLoadingAdmins] = useState(false);
  const [adminForm, setAdminForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
  });
  const [showAdminPassword, setShowAdminPassword] = useState(false);
  const [showAdminConfirmPassword, setShowAdminConfirmPassword] = useState(false);
  const [isCreatingAdmin, setIsCreatingAdmin] = useState(false);
  const [adminErrors, setAdminErrors] = useState({});

  // Local state for editing title and message
  const [title, setTitle] = useState(maintenance?.title || 'System Under Maintenance');
  const [message, setMessage] = useState(
    maintenance?.message ||
      "We're temporarily performing system maintenance to improve your experience. Please try again after some time."
  );

  const [isLoading, setIsLoading] = useState(false);
  const [isSavingText, setIsSavingText] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Retention Policy State
  const [retentionPolicy, setRetentionPolicy] = useState('forever');
  const [retentionLoading, setRetentionLoading] = useState(false);

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
      const [maintRes, retRes] = await Promise.allSettled([
        api.get('/settings/maintenance'),
        api.get('/audit-logs/retention/policy'),
      ]);

      if (maintRes.status === 'fulfilled' && maintRes.value?.data?.maintenanceMode) {
        dispatch(setMaintenanceMode(maintRes.value.data.maintenanceMode));
      }
      if (retRes.status === 'fulfilled' && retRes.value?.data?.policy) {
        setRetentionPolicy(retRes.value.data.policy);
      }
    } catch (err) {
      console.error('Failed to fetch settings status:', err);
      toast.error('Unable to fetch settings status. Please refresh.');
    } finally {
      setIsRefreshing(false);
    }
  }, [dispatch]);

  const handleSaveRetention = async () => {
    try {
      setRetentionLoading(true);
      await api.put('/audit-logs/retention/policy', { policy: retentionPolicy });
      toast.success(`Audit Retention updated to ${retentionPolicy === 'forever' ? 'Forever' : retentionPolicy + ' Days'}`);
    } catch (err) {
      toast.error('Failed to update retention policy');
    } finally {
      setRetentionLoading(false);
    }
  };

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

  // Fetch Admin Accounts list
  const fetchAdmins = useCallback(async () => {
    try {
      setIsLoadingAdmins(true);
      const res = await api.get('/auth/admins');
      if (res.data?.admins) {
        setAdminList(res.data.admins);
      }
    } catch (err) {
      console.error('Failed to load admin accounts:', err);
    } finally {
      setIsLoadingAdmins(false);
    }
  }, []);

  // Fetch admins when admins tab is chosen
  useEffect(() => {
    if (activeTab === 'admins') {
      fetchAdmins();
    }
  }, [activeTab, fetchAdmins]);

  // Password validation helper
  const validatePasswordForm = () => {
    const errors = {};
    if (!passwordForm.currentPassword) {
      errors.currentPassword = 'Enter your current password';
    }
    if (!passwordForm.newPassword) {
      errors.newPassword = 'Enter your new password';
    } else if (passwordForm.newPassword.length < 6) {
      errors.newPassword = 'Password must be at least 6 characters';
    }
    if (!passwordForm.confirmNewPassword) {
      errors.confirmNewPassword = 'Confirm your new password';
    } else if (passwordForm.newPassword !== passwordForm.confirmNewPassword) {
      errors.confirmNewPassword = 'New passwords do not match';
    } else if (passwordForm.currentPassword && passwordForm.currentPassword === passwordForm.newPassword) {
      errors.newPassword = 'New password cannot match current password';
    }
    setPasswordErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (!validatePasswordForm()) return;
    setIsChangingPassword(true);

    try {
      const res = await api.put('/auth/change-password', {
        currentPassword: passwordForm.currentPassword,
        newPassword: passwordForm.newPassword,
        confirmNewPassword: passwordForm.confirmNewPassword,
      });

      toast.success(res.data?.message || 'Password changed successfully!');
      setPasswordForm({
        currentPassword: '',
        newPassword: '',
        confirmNewPassword: '',
      });
      setPasswordErrors({});
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to change password. Please verify current password.';
      toast.error(errorMsg);
      if (errorMsg.toLowerCase().includes('current password')) {
        setPasswordErrors((prev) => ({ ...prev, currentPassword: errorMsg }));
      }
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Create Admin validation helper
  const validateAdminForm = () => {
    const errors = {};
    if (!adminForm.name.trim()) {
      errors.name = 'Full name is required';
    }
    if (!adminForm.email.trim()) {
      errors.email = 'Email address is required';
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(adminForm.email.trim())) {
        errors.email = 'Enter a valid email address';
      }
    }
    if (!adminForm.password) {
      errors.password = 'Password is required';
    } else if (adminForm.password.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }
    if (!adminForm.confirmPassword) {
      errors.confirmPassword = 'Confirm password';
    } else if (adminForm.password !== adminForm.confirmPassword) {
      errors.confirmPassword = 'Passwords do not match';
    }
    setAdminErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleCreateAdmin = async (e) => {
    e.preventDefault();
    if (!validateAdminForm()) return;
    setIsCreatingAdmin(true);

    try {
      const res = await api.post('/auth/admins', {
        name: adminForm.name.trim(),
        email: adminForm.email.trim().toLowerCase(),
        password: adminForm.password,
        confirmPassword: adminForm.confirmPassword,
      });

      toast.success(res.data?.message || 'Administrator account created successfully!');
      setAdminForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
      });
      setAdminErrors({});
      fetchAdmins();
    } catch (err) {
      const errorMsg = err.response?.data?.message || 'Failed to create admin account.';
      toast.error(errorMsg);
      if (errorMsg.toLowerCase().includes('email')) {
        setAdminErrors((prev) => ({ ...prev, email: errorMsg }));
      }
    } finally {
      setIsCreatingAdmin(false);
    }
  };

  // Export & Import / Backup & Restore State
  const [exportModuleSelect, setExportModuleSelect] = useState('products');
  const [exportFormat, setExportFormat] = useState('json');
  const [exportStartDate, setExportStartDate] = useState('');
  const [exportEndDate, setExportEndDate] = useState('');
  const [exportStatusFilter, setExportStatusFilter] = useState('');
  const [isExporting, setIsExporting] = useState(false);

  // Import State
  const [importModuleSelect, setImportModuleSelect] = useState('products');
  const [importFile, setImportFile] = useState(null);
  const [importStrategy, setImportStrategy] = useState('insert');
  const [isValidatingImport, setIsValidatingImport] = useState(false);
  const [isCommittingImport, setIsCommittingImport] = useState(false);
  const [importPreviewData, setImportPreviewData] = useState(null);

  // Full Backup & Restore State
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [restoreFile, setRestoreFile] = useState(null);
  const [isValidatingRestore, setIsValidatingRestore] = useState(false);
  const [isCommittingRestore, setIsCommittingRestore] = useState(false);
  const [restorePreviewData, setRestorePreviewData] = useState(null);
  const [restoreMode, setRestoreMode] = useState('merge');
  const [confirmRestoreModal, setConfirmRestoreModal] = useState(false);

  // Backup History State
  const [backupHistory, setBackupHistory] = useState([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);

  // Fetch Backup History
  const fetchBackupHistory = useCallback(async () => {
    try {
      setIsLoadingHistory(true);
      const res = await api.get('/backup/history');
      if (res.data?.history) {
        setBackupHistory(res.data.history);
      }
    } catch (err) {
      console.error('Failed to fetch backup history:', err);
    } finally {
      setIsLoadingHistory(false);
    }
  }, []);

  useEffect(() => {
    if (activeTab === 'backup') {
      fetchBackupHistory();
    }
  }, [activeTab, fetchBackupHistory]);

  // Handler: Export Module
  const handleExportModule = async () => {
    try {
      setIsExporting(true);
      const params = new URLSearchParams({ format: exportFormat });
      if (exportStartDate) params.append('startDate', exportStartDate);
      if (exportEndDate) params.append('endDate', exportEndDate);
      if (exportStatusFilter) params.append('status', exportStatusFilter);

      const response = await api.get(`/backup/export/${exportModuleSelect}?${params.toString()}`, {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], {
        type: exportFormat === 'csv' ? 'text/csv' : 'application/json',
      });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `APC_${exportModuleSelect}_export_${timestamp}.${exportFormat}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success(`Successfully exported ${exportModuleSelect} (${exportFormat.toUpperCase()})`);
      fetchBackupHistory();
    } catch (err) {
      console.error('Export failed:', err);
      toast.error('Failed to export data. Please try again.');
    } finally {
      setIsExporting(false);
    }
  };

  // Handler: Validate Import File
  const handleValidateImport = async (e) => {
    e.preventDefault();
    if (!importFile) {
      toast.error('Please select a file to import (.json or .csv)');
      return;
    }

    try {
      setIsValidatingImport(true);
      const formData = new FormData();
      formData.append('file', importFile);

      const res = await api.post(`/backup/import/${importModuleSelect}/preview`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setImportPreviewData(res.data);
      toast.success(`Validated ${res.data.totalRecords} records. Review preview below.`);
    } catch (err) {
      console.error('Import validation failed:', err);
      toast.error(err.response?.data?.message || 'File validation failed.');
    } finally {
      setIsValidatingImport(false);
    }
  };

  // Handler: Commit Import Data
  const handleCommitImport = async () => {
    if (!importPreviewData?.rawRecords?.length) {
      toast.error('No validated records available to import.');
      return;
    }

    try {
      setIsCommittingImport(true);
      const res = await api.post(`/backup/import/${importModuleSelect}/commit`, {
        records: importPreviewData.rawRecords,
        strategy: importStrategy,
      });

      toast.success(res.data?.message || 'Import completed successfully!');
      setImportPreviewData(null);
      setImportFile(null);
      fetchBackupHistory();
    } catch (err) {
      console.error('Commit import failed:', err);
      toast.error(err.response?.data?.message || 'Failed to commit import.');
    } finally {
      setIsCommittingImport(false);
    }
  };

  // Handler: Download Error Report CSV
  const handleDownloadErrorReport = () => {
    if (!importPreviewData?.errors?.length) return;
    const errorCsvRows = [
      'Row,Identifier,Errors',
      ...importPreviewData.errors.map(
        (e) => `"${e.row}","${e.identifier}","${(e.errors || []).join('; ')}"`
      ),
    ].join('\r\n');

    const blob = new Blob([errorCsvRows], { type: 'text/csv' });
    const downloadUrl = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = downloadUrl;
    a.download = `Import_Errors_${importModuleSelect}_${Date.now()}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(downloadUrl);
  };

  // Handler: Full System Backup ZIP
  const handleCreateFullBackup = async () => {
    try {
      setIsCreatingBackup(true);
      const response = await api.get('/backup/full/backup', {
        responseType: 'blob',
      });

      const blob = new Blob([response.data], { type: 'application/zip' });
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      a.download = `APC_Store_Full_Backup_${timestamp}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(downloadUrl);

      toast.success('Full system backup archive generated and downloaded!');
      fetchBackupHistory();
    } catch (err) {
      console.error('Full backup error:', err);
      toast.error('Failed to create full system backup.');
    } finally {
      setIsCreatingBackup(false);
    }
  };

  // Handler: Validate Restore Backup ZIP
  const handleValidateRestore = async (e) => {
    e.preventDefault();
    if (!restoreFile) {
      toast.error('Please upload a valid backup ZIP archive.');
      return;
    }

    try {
      setIsValidatingRestore(true);
      const formData = new FormData();
      formData.append('file', restoreFile);

      const res = await api.post('/backup/full/restore/preview', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });

      setRestorePreviewData(res.data);
      toast.success('Backup package verified successfully! Review summary before restore.');
    } catch (err) {
      console.error('Restore validation error:', err);
      toast.error(err.response?.data?.message || 'Invalid backup package.');
    } finally {
      setIsValidatingRestore(false);
    }
  };

  // Handler: Commit Restore
  const handleCommitRestore = async () => {
    if (!restorePreviewData) return;

    try {
      setIsCommittingRestore(true);
      const res = await api.post('/backup/full/restore/commit', {
        backupPayload: restorePreviewData.availableModules || {},
        restoreMode,
      });

      toast.success(res.data?.message || 'System restore completed successfully!');
      setRestorePreviewData(null);
      setRestoreFile(null);
      setConfirmRestoreModal(false);
      fetchBackupHistory();
    } catch (err) {
      console.error('Commit restore error:', err);
      toast.error(err.response?.data?.message || 'System restore encountered an error.');
    } finally {
      setIsCommittingRestore(false);
    }
  };

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
      <div className="border-b border-slate-200 dark:border-slate-800 flex flex-wrap gap-2 sm:gap-6">
        <button
          type="button"
          onClick={() => setActiveTab('maintenance')}
          className={`flex items-center gap-2 pb-3.5 px-3 border-b-2 font-semibold text-sm transition cursor-pointer ${
            activeTab === 'maintenance'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FiShield className="text-base" />
          <span>Maintenance Mode</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('security')}
          className={`flex items-center gap-2 pb-3.5 px-3 border-b-2 font-semibold text-sm transition cursor-pointer ${
            activeTab === 'security'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FiKey className="text-base" />
          <span>Change Password</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('admins')}
          className={`flex items-center gap-2 pb-3.5 px-3 border-b-2 font-semibold text-sm transition cursor-pointer ${
            activeTab === 'admins'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FiUsers className="text-base" />
          <span>Manage Admin Accounts</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('backup')}
          className={`flex items-center gap-2 pb-3.5 px-3 border-b-2 font-semibold text-sm transition cursor-pointer ${
            activeTab === 'backup'
              ? 'border-indigo-600 text-indigo-600 dark:text-indigo-400'
              : 'border-transparent text-slate-500 dark:text-slate-400 hover:text-slate-700 dark:hover:text-slate-200'
          }`}
        >
          <FiDatabase className="text-base" />
          <span>Export & Import (Backup & Restore)</span>
        </button>
      </div>

      {/* TAB 1: MAINTENANCE MODE */}
      {activeTab === 'maintenance' && (
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
                        : 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
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

            {/* Audit Logs & Governance Card */}
            <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiActivity className="text-indigo-500" />
                  <span>Audit & System Governance</span>
                </h3>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Active
                </span>
              </div>

              <p className="text-xs text-slate-500 dark:text-slate-400">
                Automated 360° activity logging is enabled for all transactions, user logins, inventory movements, and settings changes.
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-slate-700 dark:text-slate-300">
                  Audit Log Retention Policy:
                </label>
                <div className="flex gap-2">
                  <select
                    value={retentionPolicy}
                    onChange={(e) => setRetentionPolicy(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl text-slate-800 dark:text-slate-200"
                  >
                    <option value="forever">Forever (Indefinite)</option>
                    <option value="30">30 Days</option>
                    <option value="90">90 Days</option>
                    <option value="180">180 Days (6 Months)</option>
                    <option value="365">1 Year (365 Days)</option>
                  </select>
                  <button
                    onClick={handleSaveRetention}
                    disabled={retentionLoading}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-medium text-xs rounded-xl transition shadow-xs disabled:opacity-50"
                  >
                    {retentionLoading ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200/80 dark:border-slate-800">
                <Link
                  to="/admin/audit"
                  className="w-full py-2.5 px-4 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 hover:border-indigo-400 text-indigo-600 dark:text-indigo-400 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition shadow-xs"
                >
                  <FiShield />
                  <span>Open 360° Audit & Activity Logs</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: CHANGE MY PASSWORD */}
      {activeTab === 'security' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
          {/* Main Password Change Form */}
          <div className="lg:col-span-2">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <FiKey className="text-indigo-600 dark:text-indigo-400" />
                  <span>Change Password</span>
                </h2>
                <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                  Update your administrator account password. Your current password is required before saving new credentials.
                </p>
              </div>

              <form onSubmit={handleChangePassword} className="space-y-5">
                {/* Current Password Field */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Current Password <span className="text-rose-500">*</span>
                  </label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                      <FiLock className="text-sm" />
                    </div>
                    <input
                      type={showCurrentPassword ? 'text' : 'password'}
                      value={passwordForm.currentPassword}
                      onChange={(e) => {
                        setPasswordForm({ ...passwordForm, currentPassword: e.target.value });
                        if (passwordErrors.currentPassword) {
                          setPasswordErrors({ ...passwordErrors, currentPassword: null });
                        }
                      }}
                      placeholder="Enter your current password"
                      className={`w-full h-11 pl-10 pr-11 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                        passwordErrors.currentPassword
                          ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                          : 'border-slate-200 dark:border-slate-700'
                      }`}
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                      title={showCurrentPassword ? 'Hide password' : 'Show password'}
                    >
                      {showCurrentPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                    </button>
                  </div>
                  {passwordErrors.currentPassword && (
                    <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                      <FiAlertCircle className="text-xs" /> {passwordErrors.currentPassword}
                    </p>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiKey className="text-sm" />
                      </div>
                      <input
                        type={showNewPassword ? 'text' : 'password'}
                        value={passwordForm.newPassword}
                        onChange={(e) => {
                          setPasswordForm({ ...passwordForm, newPassword: e.target.value });
                          if (passwordErrors.newPassword) {
                            setPasswordErrors({ ...passwordErrors, newPassword: null });
                          }
                        }}
                        placeholder="At least 6 characters"
                        className={`w-full h-11 pl-10 pr-11 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                          passwordErrors.newPassword
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        title={showNewPassword ? 'Hide password' : 'Show password'}
                      >
                        {showNewPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                      </button>
                    </div>
                    {passwordErrors.newPassword && (
                      <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                        <FiAlertCircle className="text-xs" /> {passwordErrors.newPassword}
                      </p>
                    )}
                  </div>

                  {/* Confirm New Password Field */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                      Confirm New Password <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                        <FiCheck className="text-sm" />
                      </div>
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={passwordForm.confirmNewPassword}
                        onChange={(e) => {
                          setPasswordForm({ ...passwordForm, confirmNewPassword: e.target.value });
                          if (passwordErrors.confirmNewPassword) {
                            setPasswordErrors({ ...passwordErrors, confirmNewPassword: null });
                          }
                        }}
                        placeholder="Re-type new password"
                        className={`w-full h-11 pl-10 pr-11 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                          passwordErrors.confirmNewPassword
                            ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                            : 'border-slate-200 dark:border-slate-700'
                        }`}
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                        title={showConfirmPassword ? 'Hide password' : 'Show password'}
                      >
                        {showConfirmPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                      </button>
                    </div>
                    {passwordErrors.confirmNewPassword && (
                      <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                        <FiAlertCircle className="text-xs" /> {passwordErrors.confirmNewPassword}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
                  <button
                    type="button"
                    onClick={() => {
                      setPasswordForm({ currentPassword: '', newPassword: '', confirmNewPassword: '' });
                      setPasswordErrors({});
                    }}
                    disabled={isChangingPassword}
                    className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Reset Form
                  </button>
                  <button
                    type="submit"
                    disabled={isChangingPassword}
                    className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                  >
                    {isChangingPassword ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Updating Password...</span>
                      </>
                    ) : (
                      <>
                        <FiSave className="text-sm" />
                        <span>Update Password</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* Side Security Info Card */}
          <div className="space-y-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiShield className="text-indigo-600 dark:text-indigo-400" />
                <span>Password Requirements</span>
              </h3>
              <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>At least 6 characters in length</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Must differ from your current password</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Current password verification is strictly required</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-emerald-500 font-bold">✓</span>
                  <span>Passwords are hashed with bcrypt (salt rounds: 10)</span>
                </li>
              </ul>
            </div>

            <div className="bg-slate-50 dark:bg-slate-900/70 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 space-y-3">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiUser className="text-indigo-500" />
                <span>Logged In Account</span>
              </h3>
              <div className="space-y-1.5 text-xs text-slate-600 dark:text-slate-400">
                <p>
                  <strong>Admin Name:</strong> {user?.name || 'Administrator'}
                </p>
                <p>
                  <strong>Email:</strong> {user?.email || 'admin@store.com'}
                </p>
                <p>
                  <strong>Role:</strong>{' '}
                  <span className="font-semibold text-indigo-600 dark:text-indigo-400 uppercase">
                    {user?.role || 'admin'}
                  </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: MANAGE ADMIN ACCOUNTS */}
      {activeTab === 'admins' && (
        <div className="space-y-8">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
            {/* Create Admin Form Card */}
            <div className="lg:col-span-2">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
                <div className="pb-5 border-b border-slate-100 dark:border-slate-800">
                  <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                    <FiUserPlus className="text-indigo-600 dark:text-indigo-400" />
                    <span>Create Administrator Account</span>
                  </h2>
                  <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
                    Grant full administrator privileges to a new team member. The account will have unrestricted access to all admin sections.
                  </p>
                </div>

                <form onSubmit={handleCreateAdmin} className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Full Name */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Full Name <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiUser className="text-sm" />
                        </div>
                        <input
                          type="text"
                          value={adminForm.name}
                          onChange={(e) => {
                            setAdminForm({ ...adminForm, name: e.target.value });
                            if (adminErrors.name) setAdminErrors({ ...adminErrors, name: null });
                          }}
                          placeholder="e.g. John Doe"
                          className={`w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                            adminErrors.name
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                      </div>
                      {adminErrors.name && (
                        <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="text-xs" /> {adminErrors.name}
                        </p>
                      )}
                    </div>

                    {/* Email */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Email Address <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiMail className="text-sm" />
                        </div>
                        <input
                          type="email"
                          value={adminForm.email}
                          onChange={(e) => {
                            setAdminForm({ ...adminForm, email: e.target.value });
                            if (adminErrors.email) setAdminErrors({ ...adminErrors, email: null });
                          }}
                          placeholder="admin.partner@store.com"
                          className={`w-full h-11 pl-10 pr-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                            adminErrors.email
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                      </div>
                      {adminErrors.email && (
                        <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="text-xs" /> {adminErrors.email}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {/* Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiLock className="text-sm" />
                        </div>
                        <input
                          type={showAdminPassword ? 'text' : 'password'}
                          value={adminForm.password}
                          onChange={(e) => {
                            setAdminForm({ ...adminForm, password: e.target.value });
                            if (adminErrors.password) setAdminErrors({ ...adminErrors, password: null });
                          }}
                          placeholder="Min. 6 characters"
                          className={`w-full h-11 pl-10 pr-11 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                            adminErrors.password
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminPassword(!showAdminPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                          title={showAdminPassword ? 'Hide password' : 'Show password'}
                        >
                          {showAdminPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                        </button>
                      </div>
                      {adminErrors.password && (
                        <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="text-xs" /> {adminErrors.password}
                        </p>
                      )}
                    </div>

                    {/* Confirm Password */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                        Confirm Password <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none text-slate-400">
                          <FiCheck className="text-sm" />
                        </div>
                        <input
                          type={showAdminConfirmPassword ? 'text' : 'password'}
                          value={adminForm.confirmPassword}
                          onChange={(e) => {
                            setAdminForm({ ...adminForm, confirmPassword: e.target.value });
                            if (adminErrors.confirmPassword) {
                              setAdminErrors({ ...adminErrors, confirmPassword: null });
                            }
                          }}
                          placeholder="Re-type password"
                          className={`w-full h-11 pl-10 pr-11 rounded-xl bg-slate-50 dark:bg-slate-800 border text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 transition ${
                            adminErrors.confirmPassword
                              ? 'border-rose-400 dark:border-rose-500 focus:ring-rose-500'
                              : 'border-slate-200 dark:border-slate-700'
                          }`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowAdminConfirmPassword(!showAdminConfirmPassword)}
                          className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition"
                          title={showAdminConfirmPassword ? 'Hide password' : 'Show password'}
                        >
                          {showAdminConfirmPassword ? <FiEyeOff className="text-base" /> : <FiEye className="text-base" />}
                        </button>
                      </div>
                      {adminErrors.confirmPassword && (
                        <p className="text-xs text-rose-500 mt-1.5 flex items-center gap-1 font-medium">
                          <FiAlertCircle className="text-xs" /> {adminErrors.confirmPassword}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => {
                        setAdminForm({ name: '', email: '', password: '', confirmPassword: '' });
                        setAdminErrors({});
                      }}
                      disabled={isCreatingAdmin}
                      className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                    >
                      Clear
                    </button>
                    <button
                      type="submit"
                      disabled={isCreatingAdmin}
                      className="flex items-center gap-2 px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                    >
                      {isCreatingAdmin ? (
                        <>
                          <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                          <span>Creating Administrator...</span>
                        </>
                      ) : (
                        <>
                          <FiUserPlus className="text-sm" />
                          <span>Create Admin Account</span>
                        </>
                      )}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Admin Policy Guidance Card */}
            <div className="space-y-6">
              <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-sm space-y-4">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiShield className="text-indigo-600 dark:text-indigo-400" />
                  <span>Admin Privilege Policies</span>
                </h3>
                <ul className="text-xs text-slate-600 dark:text-slate-400 space-y-2.5">
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Administrators can create products, adjust stock, manage orders, and oversee staff.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Role is strictly assigned as <strong>admin</strong> by the backend security layer.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Admin accounts bypass Maintenance Mode restrictions at all times.</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <span className="text-indigo-500 font-bold">•</span>
                    <span>Creation activities are automatically tracked in the 360° Audit Log.</span>
                  </li>
                </ul>
              </div>
            </div>
          </div>

          {/* Active Administrators List */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <FiUsers className="text-indigo-600 dark:text-indigo-400" />
                  <span>Existing Administrators</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Active administrator accounts registered in the system
                </p>
              </div>
              <button
                type="button"
                onClick={fetchAdmins}
                disabled={isLoadingAdmins}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <FiRefreshCw className={`text-xs ${isLoadingAdmins ? 'animate-spin' : ''}`} />
                <span>Refresh List</span>
              </button>
            </div>

            {isLoadingAdmins && adminList.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading administrator accounts...</span>
              </div>
            ) : adminList.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No administrator accounts found.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Administrator</th>
                      <th className="py-3 px-4">Email</th>
                      <th className="py-3 px-4">Role</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Created Date</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {adminList.map((adm) => {
                      const isCurrentUser = adm._id === user?._id || adm.email === user?.email;
                      return (
                        <tr key={adm._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                          <td className="py-3.5 px-4 font-semibold text-slate-900 dark:text-white flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-indigo-100 dark:bg-indigo-900/40 text-indigo-700 dark:text-indigo-300 flex items-center justify-center font-bold text-xs uppercase">
                              {adm.name?.charAt(0) || 'A'}
                            </div>
                            <span className="truncate max-w-[200px]">{adm.name}</span>
                            {isCurrentUser && (
                              <span className="px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-400 text-[10px] font-bold border border-indigo-200 dark:border-indigo-800">
                                You
                              </span>
                            )}
                          </td>
                          <td className="py-3.5 px-4 text-slate-600 dark:text-slate-300 font-mono">
                            {adm.email}
                          </td>
                          <td className="py-3.5 px-4">
                            <span className="px-2.5 py-1 rounded-full bg-purple-50 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 font-bold text-[10px] uppercase border border-purple-200 dark:border-purple-800/50">
                              {adm.role}
                            </span>
                          </td>
                          <td className="py-3.5 px-4">
                            <span
                              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold ${
                                adm.isActive !== false
                                  ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-800/50'
                                  : 'bg-rose-50 text-rose-700 dark:bg-rose-950/40 dark:text-rose-400 border border-rose-200 dark:border-rose-800/50'
                              }`}
                            >
                              <span
                                className={`w-1.5 h-1.5 rounded-full ${
                                  adm.isActive !== false ? 'bg-emerald-500' : 'bg-rose-500'
                                }`}
                              />
                              <span>{adm.isActive !== false ? 'Active' : 'Disabled'}</span>
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 dark:text-slate-400">
                            {adm.createdAt
                              ? new Date(adm.createdAt).toLocaleDateString('en-IN', {
                                  day: '2-digit',
                                  month: 'short',
                                  year: 'numeric',
                                })
                              : '—'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: EXPORT & IMPORT (BACKUP & RESTORE) */}
      {activeTab === 'backup' && (
        <div className="space-y-8">
          {/* Header Overview Banner */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <FiDatabase className="text-indigo-600 dark:text-indigo-400" />
                  <span>Data Export, Import & System Disaster Recovery</span>
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 max-w-2xl">
                  Manage individual business module exports/imports (Products, Categories, Orders, Audit Logs) and generate complete compressed backup packages.
                </p>
              </div>

              <div className="flex items-center gap-3 flex-shrink-0">
                <button
                  type="button"
                  onClick={handleCreateFullBackup}
                  disabled={isCreatingBackup}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 cursor-pointer"
                >
                  {isCreatingBackup ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Creating Backup ZIP...</span>
                    </>
                  ) : (
                    <>
                      <FiArchive className="text-sm" />
                      <span>Create Full Backup (ZIP)</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* TWO COLUMN GRID: EXPORT MODULE & IMPORT MODULE */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
            {/* 1. EXPORT MODULE CARD */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiDownload className="text-indigo-600 dark:text-indigo-400" />
                  <span>Export Business Data</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Extract formatted business records in JSON or CSV format.
                </p>
              </div>

              <div className="space-y-4">
                {/* Module Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Select Module
                  </label>
                  <select
                    value={exportModuleSelect}
                    onChange={(e) => setExportModuleSelect(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="products">Products (Catalog, Stock & Prices)</option>
                    <option value="categories">Categories</option>
                    <option value="orders">Orders (Transactions & Status)</option>
                    <option value="order_items">Order Items (Detailed Breakdown)</option>
                    <option value="staff">Staff Accounts</option>
                    <option value="counters">Counter Terminals</option>
                    <option value="admins">Admin Accounts</option>
                    <option value="audit_logs">Audit & Activity Logs</option>
                    <option value="settings">System Settings</option>
                  </select>
                </div>

                {/* Format Radio */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    File Format
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setExportFormat('json')}
                      className={`h-10 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                        exportFormat === 'json'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <FiFileText /> JSON (Structured)
                    </button>
                    <button
                      type="button"
                      onClick={() => setExportFormat('csv')}
                      className={`h-10 rounded-xl text-xs font-bold border transition flex items-center justify-center gap-2 ${
                        exportFormat === 'csv'
                          ? 'border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/40 text-indigo-600 dark:text-indigo-400'
                          : 'border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      <FiLayers /> CSV (Spreadsheet)
                    </button>
                  </div>
                </div>

                {/* Optional Date Range Filters */}
                {(exportModuleSelect === 'orders' ||
                  exportModuleSelect === 'order_items' ||
                  exportModuleSelect === 'audit_logs') && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        Start Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={exportStartDate}
                        onChange={(e) => setExportStartDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-400 mb-1">
                        End Date (Optional)
                      </label>
                      <input
                        type="date"
                        value={exportEndDate}
                        onChange={(e) => setExportEndDate(e.target.value)}
                        className="w-full h-10 px-3 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-xs text-slate-900 dark:text-white focus:outline-none"
                      />
                    </div>
                  </div>
                )}

                <div className="pt-3">
                  <button
                    type="button"
                    onClick={handleExportModule}
                    disabled={isExporting}
                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isExporting ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Exporting Data...</span>
                      </>
                    ) : (
                      <>
                        <FiDownload className="text-sm" />
                        <span>Export {exportModuleSelect.toUpperCase()} ({exportFormat.toUpperCase()})</span>
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            {/* 2. IMPORT MODULE CARD */}
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <FiUpload className="text-indigo-600 dark:text-indigo-400" />
                  <span>Import Data & Catalog</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Upload CSV or JSON files to create or update existing catalog records.
                </p>
              </div>

              <form onSubmit={handleValidateImport} className="space-y-4">
                {/* Module Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Target Module
                  </label>
                  <select
                    value={importModuleSelect}
                    onChange={(e) => {
                      setImportModuleSelect(e.target.value);
                      setImportPreviewData(null);
                    }}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="products">Products (Stock, Pricing, Categories)</option>
                    <option value="categories">Categories</option>
                  </select>
                </div>

                {/* Import Strategy */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Import Strategy
                  </label>
                  <select
                    value={importStrategy}
                    onChange={(e) => setImportStrategy(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="insert">Insert New (Skip duplicate existing records)</option>
                    <option value="update">Update Existing (Modify matched records only)</option>
                    <option value="upsert">Upsert (Add new records and update existing)</option>
                  </select>
                </div>

                {/* File Upload Box */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Upload File (.json or .csv)
                  </label>
                  <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <FiUpload className="text-2xl text-slate-400 mb-1" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {importFile ? importFile.name : 'Click to select .json or .csv file'}
                    </span>
                    <span className="text-[10px] text-slate-400 mt-0.5">Maximum file size: 50MB</span>
                    <input
                      type="file"
                      accept=".json,.csv"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setImportFile(e.target.files[0]);
                          setImportPreviewData(null);
                        }
                      }}
                    />
                  </label>
                </div>

                <div className="pt-2">
                  <button
                    type="submit"
                    disabled={!importFile || isValidatingImport}
                    className="w-full h-11 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
                  >
                    {isValidatingImport ? (
                      <>
                        <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Validating File Structure...</span>
                      </>
                    ) : (
                      <>
                        <FiCheck className="text-sm" />
                        <span>Preview & Validate Import</span>
                      </>
                    )}
                  </button>
                </div>
              </form>
            </div>
          </div>

          {/* IMPORT PREVIEW & CONFIRMATION SECTION */}
          {importPreviewData && (
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-slate-100 dark:border-slate-800">
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <FiLayers className="text-indigo-600 dark:text-indigo-400" />
                    <span>Import Preview & Validation Report</span>
                  </h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                    Review record validation statistics before writing to the database
                  </p>
                </div>

                <div className="flex items-center gap-3">
                  {importPreviewData.errors?.length > 0 && (
                    <button
                      type="button"
                      onClick={handleDownloadErrorReport}
                      className="px-3.5 py-2 rounded-xl border border-rose-300 dark:border-rose-800 text-rose-600 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 transition flex items-center gap-1.5"
                    >
                      <FiDownload className="text-xs" />
                      <span>Download Error Report ({importPreviewData.errors.length})</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setImportPreviewData(null)}
                    className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 transition"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleCommitImport}
                    disabled={isCommittingImport || importPreviewData.validRecords === 0}
                    className="px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md transition flex items-center gap-1.5 disabled:opacity-50 cursor-pointer"
                  >
                    {isCommittingImport ? (
                      <>
                        <div className="w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        <span>Committing Import...</span>
                      </>
                    ) : (
                      <>
                        <FiCheck className="text-xs" />
                        <span>Commit Import ({importPreviewData.validRecords} Records)</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* STATS CHIPS */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200/80 dark:border-slate-700/60">
                  <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider block">
                    Total In File
                  </span>
                  <span className="text-xl font-bold text-slate-900 dark:text-white font-mono mt-1 block">
                    {importPreviewData.totalRecords}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block">
                    Valid Records
                  </span>
                  <span className="text-xl font-bold font-mono mt-1 block">
                    {importPreviewData.validRecords}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block">
                    Duplicates
                  </span>
                  <span className="text-xl font-bold font-mono mt-1 block">
                    {importPreviewData.duplicateRecords}
                  </span>
                </div>
                <div className="p-4 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-700 dark:text-rose-400">
                  <span className="text-[11px] font-semibold uppercase tracking-wider block">
                    Invalid Records
                  </span>
                  <span className="text-xl font-bold font-mono mt-1 block">
                    {importPreviewData.invalidRecords}
                  </span>
                </div>
              </div>

              {/* TABLE SAMPLE PREVIEW */}
              {importPreviewData.preview?.length > 0 && (
                <div className="overflow-x-auto border border-slate-200 dark:border-slate-800 rounded-2xl">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50 dark:bg-slate-800/70 border-b border-slate-200 dark:border-slate-800 text-slate-500 uppercase tracking-wider font-semibold">
                        <th className="py-2.5 px-3"># Row</th>
                        <th className="py-2.5 px-3">Status</th>
                        <th className="py-2.5 px-3">Name / Title</th>
                        <th className="py-2.5 px-3">Category</th>
                        <th className="py-2.5 px-3">Price</th>
                        <th className="py-2.5 px-3">Stock</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                      {importPreviewData.preview.map((p, idx) => (
                        <tr key={idx} className="hover:bg-slate-50/50 dark:hover:bg-slate-800/30">
                          <td className="py-2.5 px-3 font-mono text-slate-400">#{p.__row}</td>
                          <td className="py-2.5 px-3">
                            {p.__valid ? (
                              <span className="px-2 py-0.5 rounded-full bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-400 font-bold text-[10px]">
                                Valid
                              </span>
                            ) : (
                              <span className="px-2 py-0.5 rounded-full bg-rose-100 dark:bg-rose-950/60 text-rose-700 dark:text-rose-400 font-bold text-[10px]">
                                Invalid
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 px-3 font-medium text-slate-800 dark:text-slate-200">
                            {p.name || '—'}
                          </td>
                          <td className="py-2.5 px-3 text-slate-500">{p.category || p.categoryId || '—'}</td>
                          <td className="py-2.5 px-3 font-mono">₹{p.sellingPrice || p.price || 0}</td>
                          <td className="py-2.5 px-3 font-mono">{p.stock || 0}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* FULL SYSTEM RESTORE WORKFLOW */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-6">
            <div className="pb-4 border-b border-slate-100 dark:border-slate-800">
              <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                <FiArchive className="text-indigo-600 dark:text-indigo-400" />
                <span>Restore Full System Backup</span>
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                Upload a verified <code>.zip</code> backup package to restore system data.
              </p>
            </div>

            <form onSubmit={handleValidateRestore} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Upload Backup Archive (.zip)
                  </label>
                  <label className="border-2 border-dashed border-slate-300 dark:border-slate-700 rounded-2xl p-4 flex flex-col items-center justify-center cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/50 transition">
                    <FiArchive className="text-2xl text-slate-400 mb-1" />
                    <span className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {restoreFile ? restoreFile.name : 'Select APC Backup ZIP archive'}
                    </span>
                    <input
                      type="file"
                      accept=".zip"
                      className="hidden"
                      onChange={(e) => {
                        if (e.target.files?.[0]) {
                          setRestoreFile(e.target.files[0]);
                          setRestorePreviewData(null);
                        }
                      }}
                    />
                  </label>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                    Restoration Policy
                  </label>
                  <select
                    value={restoreMode}
                    onChange={(e) => setRestoreMode(e.target.value)}
                    className="w-full h-11 px-3.5 rounded-xl bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 text-sm text-slate-900 dark:text-white focus:outline-none"
                  >
                    <option value="merge">Merge (Add missing records, preserve existing data)</option>
                    <option value="replace">Overwrite Existing (Update matched records)</option>
                  </select>
                  <p className="text-[11px] text-slate-400 mt-1.5">
                    Safe Merge is recommended to prevent accidental overwrites.
                  </p>
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={!restoreFile || isValidatingRestore}
                  className="px-6 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-semibold text-xs shadow-md transition disabled:opacity-50 cursor-pointer flex items-center gap-2"
                >
                  {isValidatingRestore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      <span>Verifying Archive Manifest...</span>
                    </>
                  ) : (
                    <>
                      <FiCheck className="text-sm" />
                      <span>Verify & Inspect Backup</span>
                    </>
                  )}
                </button>
              </div>
            </form>

            {/* RESTORE PACKAGE PREVIEW */}
            {restorePreviewData && (
              <div className="p-5 rounded-2xl bg-indigo-50/40 dark:bg-indigo-950/20 border border-indigo-200 dark:border-indigo-800 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <FiCheckCircle className="text-indigo-600 dark:text-indigo-400 text-lg" />
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 dark:text-white">
                        Verified Backup: {restorePreviewData.manifest?.systemName}
                      </h4>
                      <p className="text-xs text-slate-500">
                        Created on {new Date(restorePreviewData.manifest?.createdAt).toLocaleString()} by{' '}
                        {restorePreviewData.manifest?.createdByName}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setConfirmRestoreModal(true)}
                    className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs shadow-md transition cursor-pointer"
                  >
                    Execute System Restore
                  </button>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-2">
                  {Object.entries(restorePreviewData.availableModules || {}).map(([mod, count]) => (
                    <div key={mod} className="p-3 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700">
                      <span className="text-[10px] font-bold text-slate-400 uppercase">{mod}</span>
                      <span className="text-base font-bold text-slate-900 dark:text-white font-mono block mt-0.5">
                        {count} records
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* BACKUP & RESTORE AUDIT HISTORY */}
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 shadow-sm space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2.5">
                  <FiClock className="text-indigo-600 dark:text-indigo-400" />
                  <span>Backup & Data Transfer History</span>
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                  Chronological trail of system backups, exports, imports, and restorations
                </p>
              </div>
              <button
                type="button"
                onClick={fetchBackupHistory}
                disabled={isLoadingHistory}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
              >
                <FiRefreshCw className={`text-xs ${isLoadingHistory ? 'animate-spin' : ''}`} />
                <span>Refresh Trail</span>
              </button>
            </div>

            {isLoadingHistory && backupHistory.length === 0 ? (
              <div className="py-10 text-center text-slate-400 text-sm">
                <div className="w-6 h-6 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto mb-2" />
                <span>Loading backup activity history...</span>
              </div>
            ) : backupHistory.length === 0 ? (
              <div className="py-8 text-center text-slate-400 text-sm">
                No backup or data operations logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-slate-200/80 dark:border-slate-800 text-slate-400 uppercase tracking-wider font-semibold">
                      <th className="py-3 px-4">Date & Time</th>
                      <th className="py-3 px-4">Operation</th>
                      <th className="py-3 px-4">Details</th>
                      <th className="py-3 px-4">Initiated By</th>
                      <th className="py-3 px-4">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {backupHistory.map((item) => (
                      <tr key={item._id} className="hover:bg-slate-50/60 dark:hover:bg-slate-800/40 transition">
                        <td className="py-3 px-4 text-slate-500 dark:text-slate-400 font-mono">
                          {new Date(item.timestamp).toLocaleString('en-IN', {
                            day: '2-digit',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="py-3 px-4 font-semibold text-slate-900 dark:text-white">
                          <span className="px-2 py-0.5 rounded-md bg-indigo-50 dark:bg-indigo-950/50 text-indigo-700 dark:text-indigo-300 font-mono text-[10px]">
                            {item.action}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-slate-600 dark:text-slate-300 max-w-md truncate">
                          {item.description}
                        </td>
                        <td className="py-3 px-4 text-slate-700 dark:text-slate-300 font-medium">
                          {item.userName}
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              item.status === 'Success'
                                ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400'
                                : 'bg-amber-50 text-amber-700 dark:bg-amber-950/40 dark:text-amber-400'
                            }`}
                          >
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                item.status === 'Success' ? 'bg-emerald-500' : 'bg-amber-500'
                              }`}
                            />
                            {item.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* CONFIRM RESTORE MODAL */}
      <AnimatePresence>
        {confirmRestoreModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => !isCommittingRestore && setConfirmRestoreModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-[2px]"
            />

            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 8 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 8 }}
              transition={{ duration: 0.2 }}
              className="relative z-10 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-5"
            >
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0 bg-amber-100 text-amber-600 dark:bg-amber-500/20 dark:text-amber-400">
                  <FiAlertTriangle />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-slate-900 dark:text-white">
                    Confirm System Restore
                  </h3>
                  <p className="text-xs text-slate-400">Mode: {restoreMode.toUpperCase()}</p>
                </div>
              </div>

              <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                You are about to restore system data from the uploaded backup package.
                {restoreMode === 'replace'
                  ? ' Existing matched records will be updated.'
                  : ' Missing records will be inserted and existing records preserved.'}
              </p>

              <div className="flex items-center justify-end gap-3 pt-3">
                <button
                  type="button"
                  onClick={() => setConfirmRestoreModal(false)}
                  disabled={isCommittingRestore}
                  className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 transition"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleCommitRestore}
                  disabled={isCommittingRestore}
                  className="px-5 py-2.5 rounded-xl text-sm font-bold shadow-md transition flex items-center gap-2 bg-amber-500 hover:bg-amber-400 text-slate-950 cursor-pointer disabled:opacity-50"
                >
                  {isCommittingRestore ? (
                    <>
                      <div className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                      <span>Restoring System Data...</span>
                    </>
                  ) : (
                    <span>Confirm & Execute Restore</span>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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
                      ? 'bg-red-100 text-red-600 dark:bg-red-500/20 dark:text-red-400'
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
                      ? 'bg-red-600 hover:bg-red-500 text-white shadow-red-500/20'
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
