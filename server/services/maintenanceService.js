import mongoose from 'mongoose';
import Setting from '../models/Setting.js';
import Order from '../models/Order.js';
import Product from '../models/Product.js';
import { invalidateMaintenanceCache } from '../middleware/maintenanceMiddleware.js';
import { getIO } from '../sockets/ioInstance.js';

/**
 * Returns the current date and time components in Asia/Kolkata (IST).
 */
export const getISTComponents = (date = new Date()) => {
  const d = new Date(date);

  // Format parts in Asia/Kolkata
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Kolkata',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });

  const parts = formatter.formatToParts(d);
  const partMap = {};
  parts.forEach((p) => {
    partMap[p.type] = p.value;
  });

  const year = Number(partMap.year);
  const month = Number(partMap.month);
  const day = Number(partMap.day);
  const hour = Number(partMap.hour === '24' ? '00' : partMap.hour);
  const minute = Number(partMap.minute);
  const second = Number(partMap.second);

  // YYYY-MM-DD
  const dateStr = `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  // Minutes since midnight (0 to 1439)
  const totalMinutes = hour * 60 + minute;

  // Day of week: 0 = Sun, 1 = Mon, ..., 6 = Sat
  const weekdayShort = partMap.weekday;
  const weekdayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const dayOfWeek = weekdayMap[weekdayShort] ?? 0;

  return {
    year,
    month,
    day,
    hour,
    minute,
    second,
    dateStr,
    totalMinutes,
    dayOfWeek,
  };
};

/**
 * Parses "HH:mm" into minutes since midnight (0 - 1439).
 */
export const parseTimeToMinutes = (timeStr = '00:00') => {
  const [h, m] = String(timeStr).split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

/**
 * Checks if a specific schedule is currently active at the given IST moment.
 */
export const isScheduleActive = (schedule, ist) => {
  if (!schedule || schedule.enabled === false) return false;

  const startM = parseTimeToMinutes(schedule.startTime);
  const endM = parseTimeToMinutes(schedule.endTime);

  // 1. Daily recurring schedule
  if (schedule.type === 'daily') {
    const days = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6]; // all days by default

    // Case A: Schedule does NOT cross midnight (e.g., 01:00 to 05:00)
    if (startM < endM) {
      if (!days.includes(ist.dayOfWeek)) return false;
      return ist.totalMinutes >= startM && ist.totalMinutes < endM;
    }

    // Case B: Schedule crosses midnight (e.g., 23:00 to 03:00)
    if (startM > endM) {
      // It's active if we are after startM on one of the active days...
      if (days.includes(ist.dayOfWeek) && ist.totalMinutes >= startM) {
        return true;
      }
      // ...OR if we are before endM on the morning after one of the active days!
      const prevDay = (ist.dayOfWeek + 6) % 7;
      if (days.includes(prevDay) && ist.totalMinutes < endM) {
        return true;
      }
      return false;
    }

    // startM === endM (full 24h if days match)
    return days.includes(ist.dayOfWeek);
  }

  // 2. Specific Date schedule
  if (schedule.type === 'specific_date') {
    if (!schedule.date) return false;

    // Case A: Does NOT cross midnight
    if (startM < endM) {
      return ist.dateStr === schedule.date && ist.totalMinutes >= startM && ist.totalMinutes < endM;
    }

    // Case B: Crosses midnight (starts on schedule.date at startM, ends next morning at endM)
    if (startM > endM) {
      if (ist.dateStr === schedule.date && ist.totalMinutes >= startM) {
        return true;
      }

      // Check if yesterday was schedule.date
      const [sy, sm, sd] = schedule.date.split('-').map(Number);
      const scheduleDateObj = new Date(Date.UTC(sy, sm - 1, sd));
      const nextDayObj = new Date(scheduleDateObj.getTime() + 86400000);
      const nextDayStr = `${nextDayObj.getUTCFullYear()}-${String(nextDayObj.getUTCMonth() + 1).padStart(2, '0')}-${String(nextDayObj.getUTCDate()).padStart(2, '0')}`;

      if (ist.dateStr === nextDayStr && ist.totalMinutes < endM) {
        return true;
      }
      return false;
    }

    return ist.dateStr === schedule.date;
  }

  return false;
};

/**
 * Calculates human-readable next occurrence for a schedule in IST.
 */
export const calculateNextOccurrence = (schedule, ist) => {
  if (!schedule || schedule.enabled === false) {
    return 'Disabled';
  }

  if (isScheduleActive(schedule, ist)) {
    return `Currently Active (ends at ${schedule.endTime} IST)`;
  }

  const startM = parseTimeToMinutes(schedule.startTime);

  if (schedule.type === 'daily') {
    const days = Array.isArray(schedule.daysOfWeek) && schedule.daysOfWeek.length > 0
      ? schedule.daysOfWeek
      : [0, 1, 2, 3, 4, 5, 6];

    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    // Check next 7 days starting from today
    for (let offset = 0; offset < 7; offset++) {
      const targetDay = (ist.dayOfWeek + offset) % 7;
      if (days.includes(targetDay)) {
        if (offset === 0 && ist.totalMinutes < startM) {
          return `Today at ${schedule.startTime} IST`;
        }
        if (offset === 1) {
          return `Tomorrow at ${schedule.startTime} IST`;
        }
        if (offset > 1) {
          return `${dayNames[targetDay]} at ${schedule.startTime} IST`;
        }
      }
    }

    return `Every day at ${schedule.startTime} IST`;
  }

  if (schedule.type === 'specific_date') {
    if (!schedule.date) return 'No date set';
    if (ist.dateStr === schedule.date) {
      if (ist.totalMinutes < startM) {
        return `Today at ${schedule.startTime} IST`;
      }
      return 'Passed today';
    }
    if (ist.dateStr > schedule.date) {
      return 'Past schedule (Completed)';
    }
    return `${schedule.date} at ${schedule.startTime} IST`;
  }

  return 'Upcoming';
};

/**
 * Evaluates the full maintenance state for the store.
 * Combines manual toggle with scheduled maintenance and computes authoritative status.
 */
export const evaluateMaintenanceState = (settingDoc, customDate = new Date()) => {
  const ist = getISTComponents(customDate);

  const manualEnabled = Boolean(settingDoc?.maintenanceMode?.enabled);
  const scheduledMasterEnabled = Boolean(settingDoc?.scheduledMaintenance?.enabled);
  const schedules = settingDoc?.scheduledMaintenance?.schedules || [];

  let activeSchedule = null;

  if (scheduledMasterEnabled && Array.isArray(schedules)) {
    for (const sched of schedules) {
      if (isScheduleActive(sched, ist)) {
        activeSchedule = sched;
        break;
      }
    }
  }

  const isScheduleActiveNow = Boolean(activeSchedule);

  // Manual override logic:
  // If manual mode is explicitly on, maintenance is active (reason: manual).
  // If manual mode is off, but a schedule is active, maintenance is active (reason: scheduled).
  const isEffectiveActive = manualEnabled || isScheduleActiveNow;

  let activeReason = 'none';
  if (manualEnabled) activeReason = 'manual';
  else if (isScheduleActiveNow) activeReason = 'scheduled';

  // Enrich schedules with next occurrence information
  const enrichedSchedules = schedules.map((s) => {
    const obj = s.toObject ? s.toObject() : { ...s };
    const active = isScheduleActive(s, ist);
    const nextOccurrence = calculateNextOccurrence(s, ist);
    return {
      ...obj,
      isCurrentlyActive: active,
      nextOccurrence,
    };
  });

  return {
    isEffectiveActive,
    activeReason,
    activeSchedule: activeSchedule
      ? {
          id: activeSchedule.id,
          title: activeSchedule.title,
          type: activeSchedule.type,
          startTime: activeSchedule.startTime,
          endTime: activeSchedule.endTime,
          date: activeSchedule.date,
        }
      : null,
    manualEnabled,
    scheduledMasterEnabled,
    schedules: enrichedSchedules,
    currentTimeIST: `${ist.dateStr} ${String(ist.hour).padStart(2, '0')}:${String(ist.minute).padStart(2, '0')} IST`,
  };
};

/**
 * Broadcasts full, authoritative maintenance state over Socket.IO.
 * Ensures all connected clients (Admin, Staff, Counter, Consumers) receive complete data.
 */
export const broadcastMaintenanceState = (ioInstance, setting, evalResult) => {
  const io = ioInstance || getIO();
  if (!io) return;

  const rawMaint = setting?.maintenanceMode?.toObject
    ? setting.maintenanceMode.toObject()
    : (setting?.maintenanceMode || {});

  const payload = {
    maintenanceMode: {
      ...rawMaint,
      effectiveEnabled: evalResult.isEffectiveActive,
      isEffectiveActive: evalResult.isEffectiveActive,
      activeReason: evalResult.activeReason,
      activeSchedule: evalResult.activeSchedule,
    },
    scheduledMaintenance: {
      enabled: setting?.scheduledMaintenance?.enabled ?? false,
      schedules: evalResult.schedules || [],
    },
    enabled: evalResult.isEffectiveActive,
    effectiveEnabled: evalResult.isEffectiveActive,
    isEffectiveActive: evalResult.isEffectiveActive,
    activeReason: evalResult.activeReason,
    activeSchedule: evalResult.activeSchedule,
    currentTimeIST: evalResult.currentTimeIST,
  };

  io.emit('maintenanceModeChanged', payload);
};

/**
 * Background Scheduler runner:
 * Evaluates state every 10 seconds and broadcasts realtime socket events
 * whenever active status or the active schedule changes.
 * Also cleans up expired/abandoned pending online checkout sessions (>15 min) to prevent stock leaks.
 */
let schedulerInterval = null;
let lastKnownState = null;
let lastKnownScheduleId = null;
let tickCount = 0;

export const startMaintenanceScheduler = (io) => {
  if (schedulerInterval) clearInterval(schedulerInterval);

  const checkState = async () => {
    try {
      // If MongoDB is not connected, skip this tick to avoid buffering timeouts
      if (mongoose.connection.readyState !== 1) {
        return;
      }

      tickCount++;
      const setting = await Setting.findOne({ key: 'system_settings' }).maxTimeMS(5000);
      if (!setting) return;

      const evalResult = evaluateMaintenanceState(setting);
      const currentScheduleId = evalResult.activeSchedule?.id || null;

      if (lastKnownState === null) {
        lastKnownState = evalResult.isEffectiveActive;
        lastKnownScheduleId = currentScheduleId;
        return;
      }

      // If effective state flipped OR the active schedule changed
      if (
        lastKnownState !== evalResult.isEffectiveActive ||
        lastKnownScheduleId !== currentScheduleId
      ) {
        console.log(
          `[MaintenanceScheduler] State transition: active=${lastKnownState}->${evalResult.isEffectiveActive}, schedule=${lastKnownScheduleId}->${currentScheduleId}`
        );
        lastKnownState = evalResult.isEffectiveActive;
        lastKnownScheduleId = currentScheduleId;

        invalidateMaintenanceCache();
        broadcastMaintenanceState(io, setting, evalResult);
      }

      // Every ~60 seconds (6 ticks of 10s): clean up abandoned online payment sessions older than 15 mins
      if (tickCount % 6 === 0) {
        try {
          if (mongoose.connection.readyState !== 1) return;
          const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);
          const abandonedOrders = await Order.find({
            'payment.method': { $in: ['Online', 'online'] },
            'payment.status': 'Pending',
            status: 'Pending',
            createdAt: { $lt: fifteenMinutesAgo },
          }).maxTimeMS(5000);

          for (const order of abandonedOrders) {
            order.status = 'Cancelled';
            order.payment.status = 'Failed';
            order.timeline.push({
              status: 'Cancelled',
              message: 'Online payment session expired and cancelled automatically',
              at: new Date(),
            });
            await order.save();

            for (const item of order.items) {
              const product = await Product.findById(item.productId);
              if (!product) continue;
              const actualDeduct = Math.min(product.reservedStock, item.quantity);
              if (actualDeduct > 0) {
                await Product.findByIdAndUpdate(item.productId, {
                  $inc: { reservedStock: -actualDeduct },
                });
              }
            }
          }
        } catch (cleanupErr) {
          console.error('[MaintenanceScheduler] Error cleaning up abandoned sessions:', cleanupErr.message || cleanupErr);
        }
      }
    } catch (err) {
      console.warn('[MaintenanceScheduler] Check skipped:', err.message || err);
    }
  };

  // Run initial check and set interval to 10 seconds for responsive real-time state changes
  checkState();
  schedulerInterval = setInterval(checkState, 10000);
};
