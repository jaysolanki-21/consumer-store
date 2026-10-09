import Setting from '../models/Setting.js';
import { getIO } from '../sockets/ioInstance.js';
import { invalidateMaintenanceCache } from '../middleware/maintenanceMiddleware.js';
import { recordAuditLog } from '../utils/auditLogger.js';

/**
 * Get current maintenance mode status
 * Public / Authenticated read
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
      });
    }

    res.json({
      success: true,
      maintenanceMode: setting.maintenanceMode,
    });
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
 * Update maintenance mode status
 * ADMIN ONLY
 */
export const updateMaintenanceStatus = async (req, res) => {
  try {
    const { enabled, title, message } = req.body;

    let setting = await Setting.findOne({ key: 'system_settings' });
    if (!setting) {
      setting = new Setting({ key: 'system_settings' });
    }

    const previousEnabled = setting.maintenanceMode?.enabled ?? false;
    const previousTitle = setting.maintenanceMode?.title || 'System Under Maintenance';
    const previousMessage = setting.maintenanceMode?.message || '';

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

    // Broadcast to all connected clients in real time
    const io = req.app.get('io') || getIO();
    if (io) {
      io.emit('maintenanceModeChanged', setting.maintenanceMode);
    }

    const newEnabled = setting.maintenanceMode.enabled;
    const modeToggled = previousEnabled !== newEnabled;

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Administrator',
        role: req.user?.role || 'admin',
        action: modeToggled ? 'MAINTENANCE_TOGGLED' : 'SETTINGS_UPDATED',
        module: 'Settings',
        targetType: 'Setting',
        targetName: 'Maintenance Mode',
        previousValue: previousEnabled ? 'ON' : 'OFF',
        newValue: newEnabled ? 'ON' : 'OFF',
        change: modeToggled
          ? `${previousEnabled ? 'ON' : 'OFF'} → ${newEnabled ? 'ON' : 'OFF'}`
          : 'Config updated',
        description: `${req.user?.name || 'Administrator'} changed Maintenance Mode from ${previousEnabled ? 'ON' : 'OFF'} to ${newEnabled ? 'ON' : 'OFF'}`,
        status: newEnabled ? 'Warning' : 'Success',
        metadata: {
          title: setting.maintenanceMode.title,
          message: setting.maintenanceMode.message,
        },
      },
      req
    );

    res.json({
      success: true,
      message: `Maintenance mode ${setting.maintenanceMode.enabled ? 'enabled' : 'disabled'} successfully`,
      maintenanceMode: setting.maintenanceMode,
    });
  } catch (error) {
    console.error('Error updating maintenance status:', error);
    res.status(500).json({
      success: false,
      message: 'Unable to update maintenance status. Please try again.',
      error: error.message,
    });
  }
};
