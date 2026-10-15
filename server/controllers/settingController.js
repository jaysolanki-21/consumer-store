import crypto from 'crypto';
import Setting from '../models/Setting.js';
import { getIO } from '../sockets/ioInstance.js';
import { evaluateMaintenanceState, broadcastMaintenanceState } from '../services/maintenanceService.js';

const buildMaintenanceResponse = (setting, evalResult, extra = {}) => ({
  success: true,
  maintenanceMode: {
    ...setting.maintenanceMode.toObject(),
    effectiveEnabled: evalResult.isEffectiveActive,
    isEffectiveActive: evalResult.isEffectiveActive,
    activeReason: evalResult.activeReason,
    activeSchedule: evalResult.activeSchedule,
  },
  scheduledMaintenance: {
    enabled: setting.scheduledMaintenance?.enabled ?? false,
    schedules: evalResult.schedules || [],
  },
  schedules: evalResult.schedules || [],
  isEffectiveActive: evalResult.isEffectiveActive,
  activeReason: evalResult.activeReason,
  activeSchedule: evalResult.activeSchedule,
  currentTimeIST: evalResult.currentTimeIST,
  ...extra,
});

/**
 * Get current maintenance mode status (including schedules and authoritative effective status).
 * Public / Authenticated read.
 */
export const getMaintenanceStatus = async (req, res) => {
  try {
    let setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting) {
      setting = await Setting.create({
        key: 'system_settings',
        maintenanceMode: {
          enabled: false,
          title: 'System Under Maintenance',
          message:
            "We're temporarily performing system maintenance to improve your experience. Please try again after some time.",
          updatedAt: new Date(),
          updatedByName: 'Administrator',
        },
        scheduledMaintenance: {
          enabled: false,
          schedules: [],
        },
      });
    }

    const evalResult = evaluateMaintenanceState(setting);

    res.json(buildMaintenanceResponse(setting, evalResult));
  } catch (error) {
    console.error('Error fetching maintenance status:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch maintenance status',
      error: error.message,
    });
  }
};

/**
 * Update manual maintenance mode settings.
 * ADMIN ONLY
 */
export const updateMaintenanceStatus = async (req, res) => {
  try {
    const { enabled, title, message } = req.body;

    let setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting) {
      setting = new Setting({ key: 'system_settings' });
    }

    if (typeof enabled === 'boolean') {
      setting.maintenanceMode.enabled = enabled;
    }

    if (typeof title === 'string' && title.trim()) {
      setting.maintenanceMode.title = title.trim().slice(0, 100);
    }

    if (typeof message === 'string' && message.trim()) {
      setting.maintenanceMode.message = message.trim().slice(0, 500);
    }

    setting.maintenanceMode.updatedAt = new Date();
    setting.maintenanceMode.updatedBy = req.user?._id;
    setting.maintenanceMode.updatedByName = req.user?.name || 'Administrator';

    await setting.save();
    invalidateMaintenanceCache();

    const evalResult = evaluateMaintenanceState(setting);

    // Broadcast to all connected clients in real time
    const io = req.app.get('io') || getIO();
    broadcastMaintenanceState(io, setting, evalResult);

    res.json(
      buildMaintenanceResponse(setting, evalResult, {
        message: `Manual maintenance mode ${setting.maintenanceMode.enabled ? 'enabled' : 'disabled'} successfully`,
      })
    );
  } catch (error) {
    console.error('Error updating maintenance status:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update maintenance status. Please try again.',
      error: error.message,
    });
  }
};

/**
 * Master Toggle for Scheduled Maintenance.
 * ADMIN ONLY
 */
export const toggleScheduledMaintenance = async (req, res) => {
  try {
    const { enabled } = req.body;
    if (typeof enabled !== 'boolean') {
      return res.status(400).json({ message: 'Invalid enabled parameter' });
    }

    let setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting) {
      setting = new Setting({ key: 'system_settings' });
    }

    if (!setting.scheduledMaintenance) {
      setting.scheduledMaintenance = { enabled, schedules: [] };
    } else {
      setting.scheduledMaintenance.enabled = enabled;
    }

    setting.scheduledMaintenance.updatedAt = new Date();
    setting.scheduledMaintenance.updatedBy = req.user?._id;
    setting.scheduledMaintenance.updatedByName = req.user?.name || 'Administrator';

    await setting.save();
    invalidateMaintenanceCache();

    const evalResult = evaluateMaintenanceState(setting);

    const io = req.app.get('io') || getIO();
    broadcastMaintenanceState(io, setting, evalResult);

    return res.json(
      buildMaintenanceResponse(setting, evalResult, {
        message: `Scheduled maintenance system ${enabled ? 'enabled' : 'disabled'} successfully`,
      })
    );
  } catch (error) {
    console.error('Error toggling scheduled maintenance:', error);
    return res.status(500).json({ message: 'Failed to update scheduled maintenance setting' });
  }
};

/**
 * Helper to validate schedule fields.
 */
const validateScheduleInput = ({ type, startTime, endTime, date, daysOfWeek }) => {
  const normType = type === 'date' ? 'specific_date' : type;
  if (!['daily', 'specific_date'].includes(normType)) {
    return 'Schedule type must be either "daily" or "specific_date".';
  }

  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(startTime || '')) {
    return 'Start time must be in 24-hour format HH:mm (e.g. 02:00, 23:30).';
  }
  if (!timeRegex.test(endTime || '')) {
    return 'End time must be in 24-hour format HH:mm (e.g. 06:00, 04:00).';
  }

  if (startTime === endTime) {
    return 'Start time and end time cannot be identical.';
  }

  if (normType === 'specific_date') {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '')) {
      return 'Valid date in YYYY-MM-DD format is required for specific date schedule.';
    }
  }

  if (normType === 'daily' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0) {
    for (const d of daysOfWeek) {
      if (typeof d !== 'number' || d < 0 || d > 6) {
        return 'Days of week must be integers between 0 (Sun) and 6 (Sat).';
      }
    }
  }

  return null;
};

/**
 * Create a new maintenance schedule.
 * ADMIN ONLY
 */
export const createSchedule = async (req, res) => {
  try {
    const { title, type, startTime, endTime, daysOfWeek, date, enabled } = req.body;
    const normType = type === 'date' ? 'specific_date' : type;

    const validationError = validateScheduleInput({ type: normType, startTime, endTime, date, daysOfWeek });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    let setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting) {
      setting = new Setting({ key: 'system_settings' });
    }

    if (!setting.scheduledMaintenance) {
      setting.scheduledMaintenance = { enabled: false, schedules: [] };
    }

    const newId = `sched_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`;
    const newSchedule = {
      id: newId,
      title: (title || 'Scheduled Maintenance').trim().slice(0, 100),
      type: normType,
      enabled: typeof enabled === 'boolean' ? enabled : true,
      startTime,
      endTime,
      daysOfWeek: normType === 'daily' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0
        ? daysOfWeek
        : [0, 1, 2, 3, 4, 5, 6],
      date: normType === 'specific_date' ? date : undefined,
    };

    setting.scheduledMaintenance.schedules.push(newSchedule);
    setting.scheduledMaintenance.updatedAt = new Date();
    setting.scheduledMaintenance.updatedBy = req.user?._id;
    setting.scheduledMaintenance.updatedByName = req.user?.name || 'Administrator';

    await setting.save();
    invalidateMaintenanceCache();

    const evalResult = evaluateMaintenanceState(setting);

    const io = req.app.get('io') || getIO();
    broadcastMaintenanceState(io, setting, evalResult);

    return res.status(201).json(
      buildMaintenanceResponse(setting, evalResult, {
        message: 'Maintenance schedule created successfully',
      })
    );
  } catch (error) {
    console.error('Error creating schedule:', error);
    return res.status(500).json({ message: 'Failed to create maintenance schedule' });
  }
};

/**
 * Update an existing maintenance schedule.
 * ADMIN ONLY
 */
export const updateSchedule = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, type, startTime, endTime, daysOfWeek, date, enabled } = req.body;
    const normType = type === 'date' ? 'specific_date' : type;

    const validationError = validateScheduleInput({ type: normType, startTime, endTime, date, daysOfWeek });
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting || !setting.scheduledMaintenance?.schedules) {
      return res.status(404).json({ message: 'No schedules configured' });
    }

    const schedule = setting.scheduledMaintenance.schedules.find((s) => s.id === id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    schedule.title = (title || schedule.title).trim().slice(0, 100);
    schedule.type = normType;
    schedule.startTime = startTime;
    schedule.endTime = endTime;
    schedule.daysOfWeek = normType === 'daily' && Array.isArray(daysOfWeek) && daysOfWeek.length > 0
      ? daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];
    schedule.date = normType === 'specific_date' ? date : undefined;
    if (typeof enabled === 'boolean') {
      schedule.enabled = enabled;
    }

    setting.scheduledMaintenance.updatedAt = new Date();
    setting.scheduledMaintenance.updatedBy = req.user?._id;
    setting.scheduledMaintenance.updatedByName = req.user?.name || 'Administrator';

    await setting.save();
    invalidateMaintenanceCache();

    const evalResult = evaluateMaintenanceState(setting);

    const io = req.app.get('io') || getIO();
    broadcastMaintenanceState(io, setting, evalResult);

    return res.json(
      buildMaintenanceResponse(setting, evalResult, {
        message: 'Schedule updated successfully',
      })
    );
  } catch (error) {
    console.error('Error updating schedule:', error);
    return res.status(500).json({ message: 'Failed to update schedule' });
  }
};

/**
 * Toggle single schedule enabled/disabled.
 * ADMIN ONLY
 */
export const toggleSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting || !setting.scheduledMaintenance?.schedules) {
      return res.status(404).json({ message: 'No schedules configured' });
    }

    const schedule = setting.scheduledMaintenance.schedules.find((s) => s.id === id);
    if (!schedule) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    schedule.enabled = !schedule.enabled;
    setting.scheduledMaintenance.updatedAt = new Date();

    await setting.save();
    invalidateMaintenanceCache();

    const evalResult = evaluateMaintenanceState(setting);

    const io = req.app.get('io') || getIO();
    broadcastMaintenanceState(io, setting, evalResult);

    return res.json(
      buildMaintenanceResponse(setting, evalResult, {
        message: `Schedule "${schedule.title}" ${schedule.enabled ? 'enabled' : 'disabled'}`,
      })
    );
  } catch (error) {
    console.error('Error toggling schedule:', error);
    return res.status(500).json({ message: 'Failed to toggle schedule' });
  }
};

/**
 * Delete a maintenance schedule.
 * ADMIN ONLY
 */
export const deleteSchedule = async (req, res) => {
  try {
    const { id } = req.params;

    const setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting || !setting.scheduledMaintenance?.schedules) {
      return res.status(404).json({ message: 'No schedules found' });
    }

    const initialLength = setting.scheduledMaintenance.schedules.length;
    setting.scheduledMaintenance.schedules = setting.scheduledMaintenance.schedules.filter(
      (s) => s.id !== id
    );

    if (setting.scheduledMaintenance.schedules.length === initialLength) {
      return res.status(404).json({ message: 'Schedule not found' });
    }

    setting.scheduledMaintenance.updatedAt = new Date();
    await setting.save();
    invalidateMaintenanceCache();

    const evalResult = evaluateMaintenanceState(setting);

    const io = req.app.get('io') || getIO();
    broadcastMaintenanceState(io, setting, evalResult);

    return res.json(
      buildMaintenanceResponse(setting, evalResult, {
        message: 'Schedule deleted successfully',
      })
    );
  } catch (error) {
    console.error('Error deleting schedule:', error);
    return res.status(500).json({ message: 'Failed to delete schedule' });
  }
};
