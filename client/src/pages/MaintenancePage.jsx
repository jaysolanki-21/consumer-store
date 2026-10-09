import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSelector, useDispatch } from 'react-redux';
import { motion } from 'framer-motion';
import toast from 'react-hot-toast';
import { FiLogOut, FiClock, FiSun, FiMoon } from 'react-icons/fi';

import socket from '../services/socket';
import { setMaintenanceMode } from '../redux/slices/settingsSlice';
import { logout } from '../redux/slices/authSlice';
import { useTheme } from '../hooks/useTheme';
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
  const { theme, toggleTheme } = useTheme();

  const { user } = useSelector((state) => state.auth);
  const maintenance = useSelector((state) => state.settings?.maintenanceMode);

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
    <div className="min-h-screen bg-slate-50 dark:bg-slate-900 text-slate-800 dark:text-slate-100 flex flex-col justify-between p-4 sm:p-6 relative overflow-hidden select-none transition-colors duration-200">
      {/* Background ambient lighting */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-amber-400/10 dark:bg-amber-500/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-indigo-400/10 dark:bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />

      {/* Top Header Bar */}
      <div className="w-full max-w-5xl mx-auto flex items-center justify-between z-10 py-2">
        {/* Brand / Logo */}
        <div className="flex items-center gap-2">
         
          <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
            APC Store
          </span>
        </div>

        {/* Theme Toggle Button */}
        <button
          type="button"
          onClick={toggleTheme}
          className="w-10 h-10 rounded-xl bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700/80 flex items-center justify-center text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white shadow-xs hover:bg-slate-100 dark:hover:bg-slate-700/60 transition cursor-pointer"
          title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-label="Toggle theme"
        >
          {theme === 'dark' ? (
            <FiSun className="text-yellow-400 text-lg" />
          ) : (
            <FiMoon className="text-slate-700 text-lg" />
          )}
        </button>
      </div>

      {/* Center Maintenance Card */}
      <div className="w-full max-w-lg mx-auto my-auto z-10 py-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="bg-white/85 dark:bg-slate-800/60 backdrop-blur-xl border border-slate-200/90 dark:border-slate-700/60 rounded-3xl p-6 sm:p-10 shadow-xl dark:shadow-2xl text-center space-y-6 transition-colors duration-200"
        >
          {/* Animated illustration */}
          <MaintenanceAnimation />

          {/* Heading & description */}
          <div className="space-y-3">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-400 text-xs font-semibold">
              <span className="w-2 h-2 rounded-full bg-amber-500 animate-ping" />
              <span>System Maintenance Active</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
              {title}
            </h1>
            <p className="text-sm sm:text-base text-slate-600 dark:text-slate-300 leading-relaxed max-w-md mx-auto">
              {message}
            </p>
          </div>

          {/* Last Checked Badge */}
          <div className="flex items-center justify-center gap-1.5 text-xs text-slate-500 dark:text-slate-400">
            <FiClock className="text-amber-500 dark:text-amber-400/90 text-sm" />
            <span>Status active as of: {lastCheckedTime}</span>
          </div>

          {/* Primary Action Button: Logout Button (Replaced Try Again) */}
          <div className="pt-2">
            <button
              type="button"
              onClick={handleLogout}
              className="w-full sm:w-auto min-w-[200px] h-12 px-8 rounded-2xl bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white font-bold text-sm shadow-lg shadow-rose-600/25 active:scale-95 transition flex items-center justify-center gap-2.5 mx-auto cursor-pointer"
              title="Log out of current session"
            >
              <FiLogOut className="text-base" />
              <span>Log Out</span>
            </button>
          </div>
        </motion.div>
      </div>

      {/* Footer Info */}
      <div className="w-full max-w-5xl mx-auto text-center z-10 text-xs text-slate-500 dark:text-slate-400 py-2">
        <p>POS & Counter operations will resume automatically once maintenance concludes.</p>
      </div>
    </div>
  );
}
