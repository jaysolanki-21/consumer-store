import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiRefreshCw, FiLogOut, FiClock, FiAlertCircle } from 'react-icons/fi';

import api from '../services/api';
import socket from '../services/socket';
import { setMaintenanceMode } from '../redux/slices/settingsSlice';
import { logout } from '../redux/slices/authSlice';
import MaintenanceAnimation from '../components/MaintenanceAnimation';

const formatLocalTime = (date) => {
  return new Date(date).toLocaleTimeString('en-IN', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true,
  });
};

export default function MaintenancePage() {
  const navigate = useNavigate();
  const dispatch = useDispatch();

  const { user } = useSelector((state) => state.auth);
  const maintenance = useSelector((state) => state.settings?.maintenanceMode);

  const [isChecking, setIsChecking] = useState(false);
  const [lastCheckedTime, setLastCheckedTime] = useState(() =>
    formatLocalTime(new Date())
  );

  // Helper to determine where to redirect user when maintenance is disabled
  const getDestinationPath = useCallback(() => {
    if (user?.role === 'admin') return '/admin';
    if (user?.role === 'staff') return '/staff';
    const counterToken = localStorage.getItem('counterToken');
    if (counterToken || user?.role === 'counter') return '/consumer';
    return '/login';
  }, [user]);

  // If Admin lands here, they should never be blocked
  useEffect(() => {
    if (user?.role === 'admin') {
      navigate('/admin', { replace: true });
    }
  }, [user, navigate]);

  // Listen to realtime socket updates
  useEffect(() => {
    const handleMaintenanceSocket = (data) => {
      if (!data) return;
      dispatch(setMaintenanceMode(data));
      setLastCheckedTime(formatLocalTime(new Date()));

      if (!data.enabled) {
        toast.success('System is back online! Redirecting...', {
          duration: 2500,
          id: 'maintenance-restored',
        });
        const dest = getDestinationPath();
        navigate(dest, { replace: true });
      }
    };

    socket.on('maintenanceModeChanged', handleMaintenanceSocket);
    return () => {
      socket.off('maintenanceModeChanged', handleMaintenanceSocket);
    };
  }, [dispatch, navigate, getDestinationPath]);

  // Try Again handler
  const handleTryAgain = async () => {
    if (isChecking) return;
    setIsChecking(true);

    try {
      const { data } = await api.get('/settings/maintenance');
      const isEnabled = data?.maintenanceMode?.enabled ?? false;

      if (data?.maintenanceMode) {
        dispatch(setMaintenanceMode(data.maintenanceMode));
      }

      setLastCheckedTime(formatLocalTime(new Date()));

      if (isEnabled) {
        toast('System maintenance is still in progress. Please check again shortly.', {
          icon: '⏳',
          id: 'maintenance-still-on',
          duration: 3000,
        });
      } else {
        toast.success('System is back online! Redirecting...', {
          duration: 2000,
          id: 'maintenance-off',
        });
        const dest = getDestinationPath();
        navigate(dest, { replace: true });
      }
    } catch (error) {
      console.error('Failed to check maintenance status:', error);
      toast.error('Unable to verify system status. Please try again.', {
        id: 'maintenance-check-err',
      });
      setLastCheckedTime(formatLocalTime(new Date()));
    } finally {
      setIsChecking(false);
    }
  };

  const handleLogout = () => {
    if (user?._id) {
      socket.emit('userDisconnected', user._id);
    }
    localStorage.removeItem('counterToken');
    localStorage.removeItem('counterUser');
    dispatch(logout());
    navigate('/login', { replace: true });
  };

  const title = maintenance?.title || 'System Under Maintenance';
  const message =
    maintenance?.message ||
    "We're temporarily performing system maintenance to improve your experience. Please try again after some time.";

  return (
    <div className="min-h-screen bg-slate-900 text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden select-none">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between z-10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-amber-500 flex items-center justify-center shadow-md">
            <FiAlertCircle className="text-white text-lg" />
          </div>
          <div>
            <h2 className="text-sm font-bold tracking-tight text-white">Smart POS</h2>
            <p className="text-[10px] uppercase tracking-wider text-amber-400 font-semibold">
              Maintenance Guard
            </p>
          </div>
        </div>

        {/* Optional Logout */}
        {(user || localStorage.getItem('counterToken')) && (
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 text-xs font-medium text-slate-300 hover:text-white transition"
            title="Log out of session"
          >
            <FiLogOut className="text-sm" />
            <span className="hidden sm:inline">Logout</span>
          </button>
        )}
      </div>

      {/* Center Maintenance Card */}
      <div className="w-full max-w-lg mx-auto my-auto z-10 py-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-slate-800/60 backdrop-blur-xl border border-slate-700/60 rounded-3xl p-6 sm:p-10 shadow-2xl text-center space-y-6"
        >
          {/* Animated illustration */}
          <MaintenanceAnimation />

          {/* Heading & description */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/15 border border-amber-500/30 text-amber-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
              <span>System Maintenance Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-slate-300 leading-relaxed max-w-md mx-auto">
              {message}
            </p>
          </div>

          {/* Last Checked Badge */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-400">
            <FiClock className="text-amber-400/90 text-sm" />
            <span>Last checked: {lastCheckedTime}</span>
          </div>

          {/* Action Button: Try Again */}
          <div className="pt-2">
            <button
              onClick={handleTryAgain}
              disabled={isChecking}
              className="w-full sm:w-auto min-w-[200px] h-12 px-8 rounded-2xl bg-gradient-to-r from-amber-500 via-orange-500 to-amber-600 hover:from-amber-400 hover:to-orange-500 text-slate-950 font-bold text-sm shadow-lg shadow-amber-500/20 active:scale-95 transition flex items-center justify-center gap-2.5 mx-auto disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
            >
              <FiRefreshCw className={`text-base ${isChecking ? 'animate-spin' : ''}`} />
              <span>{isChecking ? 'Checking System...' : 'Try Again'}</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-5xl mx-auto text-center z-10 text-xs text-slate-500">
        <p>POS & Counter operations will resume automatically once maintenance concludes.</p>
      </div>
    </div>
  );
}
