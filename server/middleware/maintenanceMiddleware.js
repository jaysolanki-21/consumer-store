import Setting from '../models/Setting.js';
import { evaluateMaintenanceState } from '../services/maintenanceService.js';

let cachedEvaluation = null;
let lastCacheTime = 0;
const CACHE_TTL = 3000; // 3-second cache

export const invalidateMaintenanceCache = () => {
  cachedEvaluation = null;
  lastCacheTime = 0;
};

/**
 * Middleware that blocks operational POS / Staff mutations when maintenance mode is active.
 * ADMIN users are ALWAYS permitted.
 */
export const checkMaintenanceMode = async (req, res, next) => {
  // Always allow admin users
  if (req.user && req.user.role === 'admin') {
    return next();
  }

  try {
    const now = Date.now();
    if (!cachedEvaluation || now - lastCacheTime > CACHE_TTL) {
      const setting = await Setting.findOne({ key: 'system_settings' });
      if (setting) {
        cachedEvaluation = {
          evalResult: evaluateMaintenanceState(setting),
          maintenanceMode: setting.maintenanceMode,
        };
      } else {
        cachedEvaluation = {
          evalResult: { isEffectiveActive: false, activeReason: 'none' },
          maintenanceMode: { enabled: false },
        };
      }
      lastCacheTime = now;
    }

    if (cachedEvaluation.evalResult.isEffectiveActive) {
      // If user is admin (verified after auth middleware), let them through
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      const activeNotice = cachedEvaluation.maintenanceMode || {};
      const activeSched = cachedEvaluation.evalResult.activeSchedule;

      const scheduleMsg = activeSched
        ? ` Scheduled maintenance (${activeSched.title}) is active until ${activeSched.endTime} IST.`
        : '';

      return res.status(503).json({
        success: false,
        maintenance: true,
        title: activeNotice.title || 'System Under Maintenance',
        message: (activeNotice.message || "We're temporarily performing system maintenance. Please try again after some time.") + scheduleMsg,
        activeReason: cachedEvaluation.evalResult.activeReason,
        activeSchedule: activeSched,
      });
    }

    next();
  } catch (error) {
    console.error('Maintenance check error:', error);
    next();
  }
};
