import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'react-hot-toast';
import { 
  FiLock, FiShield, FiAlertCircle, FiClock, 
  FiKey, FiUnlock, FiUserCheck, FiXCircle, FiRefreshCw
} from 'react-icons/fi';

const PasswordProtection = ({ children, pageName = "Consumer Store" }) => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [attempts, setAttempts] = useState(0);
  const [isLocked, setIsLocked] = useState(false);
  const [lockTimer, setLockTimer] = useState(0);
  const [showAdminRecovery, setShowAdminRecovery] = useState(false);
  const [adminKey, setAdminKey] = useState('');
  const [adminError, setAdminError] = useState('');
  
  // Admin recovery brute force protection
  const [adminRecoveryAttempts, setAdminRecoveryAttempts] = useState(0);
  const [adminRecoveryLocked, setAdminRecoveryLocked] = useState(false);
  const [adminRecoveryTimer, setAdminRecoveryTimer] = useState(0);

  // Load attempts from localStorage (persist across page refresh)
  useEffect(() => {
    const savedAttempts = localStorage.getItem('consumer_attempts');
    const savedLockUntil = localStorage.getItem('consumer_lock_until');
    const savedAdminAttempts = localStorage.getItem('admin_recovery_attempts');
    const savedAdminLockUntil = localStorage.getItem('admin_recovery_lock_until');
    
    if (savedAttempts) {
      setAttempts(parseInt(savedAttempts));
    }
    
    if (savedAdminAttempts) {
      setAdminRecoveryAttempts(parseInt(savedAdminAttempts));
    }
    
    if (savedLockUntil) {
      const lockUntil = parseInt(savedLockUntil);
      const now = Date.now();
      if (lockUntil > now) {
        const remaining = Math.ceil((lockUntil - now) / 1000);
        setIsLocked(true);
        setLockTimer(remaining);
        startCountdown(remaining);
      } else {
        localStorage.removeItem('consumer_lock_until');
        localStorage.removeItem('consumer_attempts');
      }
    }
    
    if (savedAdminLockUntil) {
      const lockUntil = parseInt(savedAdminLockUntil);
      const now = Date.now();
      if (lockUntil > now) {
        const remaining = Math.ceil((lockUntil - now) / 1000);
        setAdminRecoveryLocked(true);
        setAdminRecoveryTimer(remaining);
        startAdminRecoveryCountdown(remaining);
      } else {
        localStorage.removeItem('admin_recovery_lock_until');
        localStorage.removeItem('admin_recovery_attempts');
      }
    }
  }, []);

  // Check if already authenticated in this session
  useEffect(() => {
    const sessionAuth = sessionStorage.getItem('consumer_auth');
    if (sessionAuth === 'true') {
      setIsAuthenticated(true);
    }
  }, []);

  const startCountdown = (duration) => {
    const endTime = Date.now() + duration * 1000;
    localStorage.setItem('consumer_lock_until', endTime.toString());
    
    const timer = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setIsLocked(false);
        setLockTimer(0);
        setError('');
        localStorage.removeItem('consumer_lock_until');
      } else {
        setLockTimer(remaining);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  };

  const startAdminRecoveryCountdown = (duration) => {
    const endTime = Date.now() + duration * 1000;
    localStorage.setItem('admin_recovery_lock_until', endTime.toString());
    
    const timer = setInterval(() => {
      const remaining = Math.ceil((endTime - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(timer);
        setAdminRecoveryLocked(false);
        setAdminRecoveryTimer(0);
        setAdminRecoveryAttempts(0);
        localStorage.removeItem('admin_recovery_lock_until');
        localStorage.removeItem('admin_recovery_attempts');
      } else {
        setAdminRecoveryTimer(remaining);
      }
    }, 1000);
    
    return () => clearInterval(timer);
  };

  // Calculate lock duration based on attempts (MODERATE - to prevent brute force)
  const getLockDuration = (attemptCount) => {
    // 10 sec, 30 sec, 1 min, 2 min, 5 min, 10 min, 20 min, 30 min, 1 hour
    const durations = [
      10,      // 10 seconds
      30,      // 30 seconds
      60,      // 1 minute
      120,     // 2 minutes
      300,     // 5 minutes
      600,     // 10 minutes
      1200,    // 20 minutes
      1800,    // 30 minutes
      3600     // 1 hour
    ];
    const index = Math.min(attemptCount - 1, durations.length - 1);
    return durations[index];
  };

  // Admin recovery lock duration (shorter but still protective)
  const getAdminRecoveryLockDuration = (attemptCount) => {
    const durations = [
      15,      // 15 seconds
      30,      // 30 seconds
      60,      // 1 minute
      120,     // 2 minutes
      300      // 5 minutes
    ];
    const index = Math.min(attemptCount - 1, durations.length - 1);
    return durations[index];
  };

  // Admin recovery key
  const ADMIN_RECOVERY_KEY = "apcstore@admin123";
  const ADMIN_OVERRIDE_CODE = "9876543210";

  const handleAdminRecovery = (e) => {
    e.preventDefault();
    
    if (adminRecoveryLocked) {
      setAdminError(`Admin recovery locked! Please wait ${formatTime(adminRecoveryTimer)}`);
      return;
    }
    
    if (adminKey === ADMIN_RECOVERY_KEY || adminKey === ADMIN_OVERRIDE_CODE) {
      // Successful recovery
      localStorage.removeItem('consumer_attempts');
      localStorage.removeItem('consumer_lock_until');
      localStorage.removeItem('admin_recovery_attempts');
      localStorage.removeItem('admin_recovery_lock_until');
      setAttempts(0);
      setIsLocked(false);
      setLockTimer(0);
      setAdminRecoveryAttempts(0);
      setAdminRecoveryLocked(false);
      setShowAdminRecovery(false);
      setAdminKey('');
      setAdminError('');
      setError('');
      toast.success('✅ System unlocked by administrator', {
        icon: '🔓',
        style: { background: '#10b981', color: '#fff' }
      });
    } else {
      const newAttempts = adminRecoveryAttempts + 1;
      setAdminRecoveryAttempts(newAttempts);
      localStorage.setItem('admin_recovery_attempts', newAttempts.toString());
      
      const duration = getAdminRecoveryLockDuration(newAttempts);
      
      setAdminError(`❌ Invalid recovery key! Admin recovery locked for ${formatTime(duration)}`);
      
      // Lock admin recovery
      setAdminRecoveryLocked(true);
      setAdminRecoveryTimer(duration);
      startAdminRecoveryCountdown(duration);
      
      setAdminKey('');
      
      // Log failed attempt
      console.warn(`⚠️ Failed admin recovery attempt #${newAttempts} from IP: ${window.location.host}`);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (isLocked) return;
    
    const CONSUMER_PASSWORD = "consumer@admin";
    
    if (password === CONSUMER_PASSWORD) {
      // Successful login - reset all
      sessionStorage.setItem('consumer_auth', 'true');
      localStorage.removeItem('consumer_attempts');
      localStorage.removeItem('consumer_lock_until');
      setIsAuthenticated(true);
      setError('');
      setPassword('');
      setAttempts(0);
      toast.success('✅ Access granted! Welcome to APC Store', {
        icon: '🎉',
        style: { background: '#10b981', color: '#fff' }
      });
    } else {
      const newAttempts = attempts + 1;
      setAttempts(newAttempts);
      localStorage.setItem('consumer_attempts', newAttempts.toString());
      
      const duration = getLockDuration(newAttempts);
      
      const timeText = formatTime(duration);
      
      setError(`❌ INCORRECT PASSWORD! Locked for ${timeText}`);
      
      // Lock the user
      setIsLocked(true);
      setLockTimer(duration);
      startCountdown(duration);
      
      setPassword('');
      
      // Show warning toast
      toast.error(`⚠️ Failed attempt ${newAttempts}/10`, {
        duration: 3000
      });
    }
  };

  // Format time display (mm:ss or hh:mm:ss)
  const formatTime = (seconds) => {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hours > 0) {
      return `${hours}h ${minutes}m ${secs}s`;
    }
    if (minutes > 0) {
      return `${minutes}m ${secs}s`;
    }
    return `${seconds}s`;
  };

  if (isAuthenticated) {
    return children;
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="max-w-md w-full"
      >
        <div className="bg-white/10 backdrop-blur-xl rounded-2xl shadow-2xl p-8 border border-white/10">
          {/* Lock Icon with animation */}
          <div className="flex justify-center mb-6">
            <motion.div
              animate={isLocked ? { scale: [1, 1.05, 1], rotate: [0, 3, -3, 0] } : {}}
              transition={{ repeat: isLocked ? Infinity : 0, duration: 2 }}
              className="w-20 h-20 rounded-2xl bg-gradient-to-br from-slate-600 to-slate-700 flex items-center justify-center shadow-lg"
            >
              {isLocked ? (
                <FiClock className="text-white text-3xl" />
              ) : (
                <FiLock className="text-white text-3xl" />
              )}
            </motion.div>
          </div>

          <h2 className="text-2xl font-bold text-white text-center mb-2">
            {isLocked ? 'Access Locked' : 'Consumer Access'}
          </h2>
          <p className="text-slate-300 text-center text-sm mb-8">
            {isLocked ? 'Too many failed attempts' : pageName}
          </p>

          {!isLocked ? (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium text-slate-200 mb-2">
                  Enter Access Password
                </label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter consumer password"
                  className="w-full px-4 py-3 rounded-xl bg-white/90 border border-slate-300 focus:ring-2 focus:ring-indigo-500 focus:border-transparent outline-none transition"
                  autoFocus
                />
              </div>

              {/* Attempts remaining indicator */}
              {attempts > 0 && attempts < 8 && (
                <div className="flex items-center gap-2 text-amber-300 text-xs bg-amber-500/10 p-2 rounded-lg">
                  <FiAlertCircle />
                  <span>⚠️ {10 - attempts} attempt(s) remaining before lockout</span>
                </div>
              )}

              {error && (
                <motion.p
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-red-300 text-sm flex items-center gap-2 bg-red-500/10 p-2 rounded-lg"
                >
                  <FiAlertCircle />
                  {error}
                </motion.p>
              )}

              <button
                type="submit"
                className="w-full bg-gradient-to-r from-indigo-600 to-indigo-700 text-white py-3 rounded-xl font-semibold hover:from-indigo-700 hover:to-indigo-800 transition shadow-lg"
              >
                Access Store
              </button>
            </form>
          ) : (
            <div className="space-y-5">
              {/* Locked State */}
              <div className="bg-red-500/10 rounded-xl p-4 text-center border border-red-500/20">
                <div className="flex items-center justify-center gap-2 mb-2">
                  <FiClock className="text-red-300 text-xl" />
                  <p className="text-red-300 font-bold">ACCESS LOCKED</p>
                </div>
                <p className="text-slate-300 text-sm mb-3">
                  Multiple failed authentication attempts detected.
                </p>
                <p className="text-white text-lg font-bold mb-2">
                  {formatTime(lockTimer)}
                </p>
                <div className="mt-2 h-2 bg-red-500/20 rounded-full overflow-hidden">
                  <motion.div
                    initial={{ width: '100%' }}
                    animate={{ width: '0%' }}
                    transition={{ duration: lockTimer, ease: 'linear' }}
                    className="h-full bg-red-500 rounded-full"
                  />
                </div>
                <p className="text-slate-400 text-xs mt-3">
                  Auto-unlock after timer expires
                </p>
              </div>

              {/* Admin Recovery Button */}
              <button
                onClick={() => setShowAdminRecovery(!showAdminRecovery)}
                disabled={adminRecoveryLocked}
                className="w-full bg-slate-700/50 text-slate-300 py-2 rounded-xl text-sm font-medium hover:bg-slate-700 transition flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <FiKey />
                {adminRecoveryLocked ? `Recovery Locked (${formatTime(adminRecoveryTimer)})` : 'Administrator Recovery'}
              </button>

              {/* Admin Recovery Form */}
              {showAdminRecovery && !adminRecoveryLocked && (
                <motion.form
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  onSubmit={handleAdminRecovery}
                  className="space-y-3 mt-3 p-4 bg-slate-800/50 rounded-xl border border-slate-700"
                >
                  <p className="text-indigo-300 text-xs text-center">
                    Enter administrator recovery key to override lock
                  </p>
                  <input
                    type="password"
                    value={adminKey}
                    onChange={(e) => setAdminKey(e.target.value)}
                    placeholder="Administrator Recovery Key"
                    className="w-full px-4 py-2 rounded-lg bg-slate-700 text-white border border-slate-600 outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                  />
                  {adminError && (
                    <p className="text-red-400 text-xs flex items-center gap-1">
                      <FiXCircle />
                      {adminError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="w-full bg-emerald-600 text-white py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition flex items-center justify-center gap-2"
                  >
                    <FiUnlock />
                    Unlock Device
                  </button>
                </motion.form>
              )}
            </div>
          )}

          <div className="mt-6 pt-4 border-t border-white/10 text-center">
            <p className="text-slate-400 text-xs flex items-center justify-center gap-1">
              <FiShield className="text-xs" />
              Protected Consumer Area | v2.0
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  );
};

export default PasswordProtection;