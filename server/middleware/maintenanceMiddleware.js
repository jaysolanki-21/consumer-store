import Setting from '../models/Setting.js';

let cachedMaintenance = null;
let lastCacheTime = 0;
const CACHE_TTL = 3000; // 3-second cache

export const invalidateMaintenanceCache = () => {
  cachedMaintenance = null;
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
    if (!cachedMaintenance || now - lastCacheTime > CACHE_TTL) {
      const setting = await Setting.findOne({ key: 'system_settings' });
      cachedMaintenance = setting?.maintenanceMode || { enabled: false };
      lastCacheTime = now;
    }

    if (cachedMaintenance.enabled) {
      // If user is admin (verified after auth middleware), let them through
      if (req.user && req.user.role === 'admin') {
        return next();
      }

      return res.status(503).json({
        success: false,
        maintenance: true,
        title: cachedMaintenance.title || 'System Under Maintenance',
        message:
          cachedMaintenance.message ||
          "We're temporarily performing system maintenance. Please try again after some time.",
      });
    }

    next();
  } catch (error) {
    console.error('Maintenance check error:', error);
    next();
  }
};
