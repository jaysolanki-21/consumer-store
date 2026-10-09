import { useState, useEffect } from 'react';
import { useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

import { setCredentials } from '../redux/slices/authSlice';
import api from '../services/api';

import {
  FiMail,
  FiLock,
  FiArrowRight,
  FiShoppingBag,
  FiCheckCircle,
  FiEye,
  FiEyeOff,
  FiHelpCircle,
  FiX,
  FiAlertCircle,
} from 'react-icons/fi';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showForgotPasswordModal, setShowForgotPasswordModal] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();

  // Load saved email if available
  useEffect(() => {
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
      setEmail(savedEmail);
    }
  }, []);

  // Close modal on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && showForgotPasswordModal) {
        setShowForgotPasswordModal(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [showForgotPasswordModal]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address');
      return;
    }
    if (!password) {
      setError('Please enter your password');
      return;
    }

    setLoading(true);

    try {
      const { data } = await api.post('/auth/login', {
        email: cleanEmail,
        password,
      });

      console.log('🔐 Login Response:', data);

      // ✅ Always save credentials (remember me is always ON)
      dispatch(
        setCredentials({
          user: data,
          token: data.token,
          rememberMe: true,
        })
      );

      // ✅ Always save email for next time
      localStorage.setItem('savedEmail', cleanEmail);

      // ✅ Check maintenance mode status
      let isMaintenanceActive = false;
      try {
        const { data: maintData } = await api.get('/settings/maintenance');
        isMaintenanceActive = !!maintData?.maintenanceMode?.enabled;
      } catch (e) {}

      // ✅ Handle redirect based on role
      if (data.role === 'admin') {
        toast.success(`Welcome back, ${data.name}!`);
        navigate('/admin');
      } else if (isMaintenanceActive) {
        if (data.role === 'counter') {
          localStorage.setItem('counterToken', data.token);
          localStorage.setItem('counterUser', JSON.stringify(data));
        }
        toast(
          'System Under Maintenance: Your account is valid, but Staff/Counter access is temporarily unavailable.',
          {
            icon: '⚠️',
            duration: 4000,
          }
        );
        navigate('/maintenance');
      } else if (data.role === 'staff') {
        toast.success(`Welcome back, ${data.name}!`);
        navigate('/staff');
      } else if (data.role === 'counter') {
        toast.success(`Welcome back, ${data.name}!`);
        // ✅ Save counter token separately for consumer page
        localStorage.setItem('counterToken', data.token);
        localStorage.setItem('counterUser', JSON.stringify(data));

        console.log('🔄 Counter user detected, counterId:', data.counterId);
        console.log('📋 Full user data:', data);

        // ✅ Small delay to ensure localStorage is set
        setTimeout(() => {
          navigate('/consumer');
        }, 100);
      } else {
        toast.error('Unknown role. Please contact admin.');
        navigate('/');
      }
    } catch (err) {
      console.error('❌ Login error:', err);
      const errMsg = err.response?.data?.message || 'Invalid email or password';
      setError(errMsg);
      toast.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-slate-900 dark:bg-[#0b1120] text-slate-100 flex items-center justify-center p-4 sm:p-6 select-none transition-colors duration-200">
      {/* BACKGROUND AMBIENT LIGHTING (Soft radial glows, non-distracting) */}
      <div
        className="absolute inset-0 pointer-events-none opacity-40 dark:opacity-60"
        style={{
          background:
            'radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.12), transparent 45%), radial-gradient(circle at 100% 100%, rgba(168, 85, 247, 0.1), transparent 50%)',
        }}
        aria-hidden="true"
      />
      <div
        className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />
      <div
        className="absolute -bottom-32 -right-32 w-96 h-96 bg-purple-500/10 rounded-full blur-3xl pointer-events-none"
        aria-hidden="true"
      />

      {/* LOGIN CARD */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: 'easeOut' }}
        className="relative z-10 w-full max-w-[450px] rounded-3xl border border-slate-800/90 dark:border-slate-800/80 bg-slate-850/90 dark:bg-slate-900/85 backdrop-blur-2xl shadow-2xl shadow-black/50 p-6 sm:p-9 text-slate-100"
        style={{
          backgroundColor: 'rgba(15, 23, 42, 0.88)',
        }}
      >
        {/* BRAND LOGO CONTAINER */}
        <div className="flex justify-center mb-5">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-indigo-600 via-purple-600 to-indigo-700 flex items-center justify-center shadow-lg shadow-purple-600/25 ring-4 ring-purple-500/10">
            <FiShoppingBag className="text-white text-3xl" />
          </div>
        </div>

        {/* TITLE & SUBTITLE */}
        <div className="text-center mb-6">
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            APC Store
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1.5 font-medium leading-relaxed">
            Staff, Admin &amp; Counter Login Portal
          </p>
        </div>

        {/* ERROR MESSAGE ALERT */}
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center gap-2.5 bg-rose-500/15 border border-rose-500/30 rounded-xl px-3.5 py-2.5 mb-5 text-rose-300 text-xs sm:text-sm"
          >
            <FiAlertCircle className="text-rose-400 text-base shrink-0" />
            <p className="flex-1 font-medium">{error}</p>
          </motion.div>
        )}

        {/* LOGIN FORM */}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          {/* EMAIL INPUT */}
          <div>
            <label
              htmlFor="login-email"
              className="block text-xs sm:text-sm font-semibold text-slate-300 mb-1.5"
            >
              Email Address
            </label>
            <div className="relative">
              <FiMail
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="login-email"
                type="email"
                name="email"
                autoComplete="email"
                placeholder="name@apcstore.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                required
                className="w-full h-12 sm:h-[48px] pl-11 pr-4 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm font-medium outline-hidden focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              />
            </div>
          </div>

          {/* PASSWORD INPUT */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label
                htmlFor="login-password"
                className="block text-xs sm:text-sm font-semibold text-slate-300"
              >
                Password
              </label>
              {/* FORGOT PASSWORD LINK */}
              <button
                type="button"
                onClick={() => setShowForgotPasswordModal(true)}
                className="text-xs font-semibold text-purple-400 hover:text-purple-300 transition cursor-pointer"
              >
                Forgot password?
              </button>
            </div>
            <div className="relative">
              <FiLock
                className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 text-base pointer-events-none"
                aria-hidden="true"
              />
              <input
                id="login-password"
                type={showPassword ? 'text' : 'password'}
                name="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  if (error) setError('');
                }}
                disabled={loading}
                required
                className="w-full h-12 sm:h-[48px] pl-11 pr-11 rounded-xl bg-slate-950/70 border border-slate-700/80 text-white placeholder-slate-500 text-sm font-medium outline-hidden focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                disabled={loading}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-8 h-8 rounded-lg flex items-center justify-center text-slate-400 hover:text-slate-200 hover:bg-slate-800/60 transition cursor-pointer"
                aria-label={showPassword ? 'Hide password' : 'Show password'}
              >
                {showPassword ? (
                  <FiEyeOff className="text-base" />
                ) : (
                  <FiEye className="text-base" />
                )}
              </button>
            </div>
          </div>

          {/* LOGIN SUBMIT BUTTON */}
          <div className="pt-2">
            <button
              type="submit"
              disabled={loading}
              className="w-full h-12 sm:h-[48px] rounded-xl bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 hover:from-indigo-500 hover:via-purple-500 hover:to-indigo-500 active:scale-[0.99] text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-purple-600/20 transition-all disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer group"
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Login</span>
                  <FiArrowRight className="text-base transition-transform group-hover:translate-x-0.5" />
                </>
              )}
            </button>
          </div>
        </form>

        {/* INFO MESSAGE & FOOTER */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 text-center">
          <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5 font-medium">
            <FiCheckCircle className="text-emerald-400 text-sm shrink-0" />
            <span>Stay logged in until you logout</span>
          </p>
          <p className="text-[11px] sm:text-xs text-slate-500 mt-2 font-medium tracking-tight">
            APC Consumer Store Management System
          </p>
        </div>
      </motion.div>

      {/* ── FORGOT PASSWORD / CONTACT ADMINISTRATOR MODAL ── */}
      <AnimatePresence>
        {showForgotPasswordModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setShowForgotPasswordModal(false)}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm"
              aria-hidden="true"
            />

            {/* Modal Card */}
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 10 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative z-10 w-full max-w-[420px] rounded-3xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 p-6 sm:p-7 shadow-2xl text-slate-900 dark:text-slate-100 space-y-5 transition-colors duration-200"
            >
              {/* Header: Icon, Title & Close Button */}
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <div className="w-11 h-11 rounded-2xl bg-purple-50 dark:bg-purple-500/15 border border-purple-200 dark:border-purple-500/30 flex items-center justify-center text-purple-600 dark:text-purple-400 shrink-0">
                    <FiHelpCircle className="text-2xl" />
                  </div>
                  <div>
                    <h2 className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                      Contact Administrator
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5 font-medium">
                      Password Reset &amp; Recovery
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-8 h-8 rounded-xl flex items-center justify-center text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
                  aria-label="Close dialog"
                >
                  <FiX className="text-lg" />
                </button>
              </div>

              {/* Message Box */}
              <div className="rounded-2xl border border-indigo-100 dark:border-indigo-500/20 bg-indigo-50/70 dark:bg-indigo-500/10 p-4 space-y-1.5">
                <h3 className="text-sm font-bold text-indigo-950 dark:text-white leading-snug">
                  Forgot or Need to Change Your Password?
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                  For password resets or password changes, please contact your administrator.
                </p>
              </div>

              {/* Action Button: Back to Login */}
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setShowForgotPasswordModal(false)}
                  className="w-full h-11 rounded-xl bg-slate-900 hover:bg-slate-800 dark:bg-slate-800 dark:hover:bg-slate-750 text-white font-semibold text-xs sm:text-sm border border-slate-900 dark:border-slate-700 transition cursor-pointer flex items-center justify-center shadow-xs active:scale-[0.99]"
                >
                  Back to Login
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}