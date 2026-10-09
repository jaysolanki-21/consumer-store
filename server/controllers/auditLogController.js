import AuditLog from '../models/AuditLog.js';
import Setting from '../models/Setting.js';
import { recordAuditLog } from '../utils/auditLogger.js';

// Helper for Asia/Kolkata IST Day Boundaries
const getISTDateBoundaries = (dateStr) => {
  let y, m, d;
  if (!dateStr || dateStr === 'today') {
    const now = new Date();
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .split('-');
    y = Number(istParts[0]);
    m = Number(istParts[1]);
    d = Number(istParts[2]);
  } else if (dateStr === 'yesterday') {
    const now = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const istParts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .format(now)
      .split('-');
    y = Number(istParts[0]);
    m = Number(istParts[1]);
    d = Number(istParts[2]);
  } else {
    const parts = dateStr.split('-').map(Number);
    y = parts[0];
    m = parts[1];
    d = parts[2];
  }

  const startOfDay = new Date(Date.UTC(y, m - 1, d, 0, 0, 0, 0) - 5.5 * 60 * 60 * 1000);
  const endOfDay = new Date(Date.UTC(y, m - 1, d, 23, 59, 59, 999) - 5.5 * 60 * 60 * 1000);
  return { startOfDay, endOfDay };
};

/**
 * Build Mongoose query filter from query parameters
 */
const buildAuditFilter = (query) => {
  const filter = {};

  // 1. Module filter
  if (query.module && query.module !== 'all') {
    filter.module = query.module;
  }

  // 2. Action filter
  if (query.action && query.action !== 'all') {
    filter.action = query.action;
  }

  // 3. Role filter
  if (query.role && query.role !== 'all') {
    filter.role = query.role.toLowerCase();
  }

  // 4. Status filter
  if (query.status && query.status !== 'all') {
    filter.status = query.status;
  }

  // 5. Device Type filter
  if (query.deviceType && query.deviceType !== 'all') {
    filter.deviceType = query.deviceType.toLowerCase();
  }

  // 6. Specific User filter
  if (query.userId && query.userId !== 'all') {
    filter.userId = query.userId;
  }

  // 7. Date range filter
  if (query.dateRange) {
    if (query.dateRange === 'today') {
      const { startOfDay, endOfDay } = getISTDateBoundaries('today');
      filter.timestamp = { $gte: startOfDay, $lte: endOfDay };
    } else if (query.dateRange === 'yesterday') {
      const { startOfDay, endOfDay } = getISTDateBoundaries('yesterday');
      filter.timestamp = { $gte: startOfDay, $lte: endOfDay };
    } else if (query.dateRange === '7days') {
      const now = new Date();
      const past7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      filter.timestamp = { $gte: past7 };
    } else if (query.dateRange === '30days') {
      const now = new Date();
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      filter.timestamp = { $gte: past30 };
    } else if (query.dateRange === 'custom' && (query.startDate || query.endDate)) {
      filter.timestamp = {};
      if (query.startDate) {
        const { startOfDay } = getISTDateBoundaries(query.startDate);
        filter.timestamp.$gte = startOfDay;
      }
      if (query.endDate) {
        const { endOfDay } = getISTDateBoundaries(query.endDate);
        filter.timestamp.$lte = endOfDay;
      }
    }
  }

  // 8. General text search
  if (query.search && query.search.trim()) {
    const term = query.search.trim();
    const regex = new RegExp(term, 'i');
    filter.$or = [
      { description: regex },
      { userName: regex },
      { targetName: regex },
      { orderId: regex },
      { counterName: regex },
      { ipAddress: regex },
      { deviceName: regex },
      { sessionId: regex },
      { action: regex },
    ];
  }

  return filter;
};

/**
 * GET /api/audit-logs
 * Paginated list of audit logs + KPI statistics
 */
export const getAuditLogs = async (req, res) => {
  try {
    const page = Math.max(1, parseInt(req.query.page) || 1);
    const limit = Math.min(100, Math.max(10, parseInt(req.query.limit) || 25));
    const skip = (page - 1) * limit;

    const filter = buildAuditFilter(req.query);

    // Sorting
    const sortBy = req.query.sortBy || 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
    const sort = { [sortBy]: sortOrder };

    // Parallel fetch: Logs + Total Count + Global KPIs
    const [logs, total, totalActivities, todayActivities, loginActivities, orderActivities, inventoryActivities, staffActivities, securityEvents, failedActions] = await Promise.all([
      AuditLog.find(filter).sort(sort).skip(skip).limit(limit).lean(),
      AuditLog.countDocuments(filter),
      AuditLog.countDocuments({}),
      (() => {
        const { startOfDay, endOfDay } = getISTDateBoundaries('today');
        return AuditLog.countDocuments({ timestamp: { $gte: startOfDay, $lte: endOfDay } });
      })(),
      AuditLog.countDocuments({ module: 'Authentication' }),
      AuditLog.countDocuments({ module: 'Orders' }),
      AuditLog.countDocuments({ module: 'Inventory' }),
      AuditLog.countDocuments({ module: 'Staff' }),
      AuditLog.countDocuments({
        $or: [
          { action: { $in: ['FAILED_LOGIN', 'STAFF_STATUS_CHANGED', 'STAFF_PASSWORD_RESET', 'COUNTER_STATUS_CHANGED', 'COUNTER_PASSWORD_RESET'] } },
          { status: 'Warning' }
        ]
      }),
      AuditLog.countDocuments({ status: 'Failed' }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    res.json({
      logs,
      pagination: {
        page,
        limit,
        total,
        totalPages,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
      stats: {
        totalActivities,
        todayActivities,
        loginActivities,
        orderActivities,
        inventoryActivities,
        staffActivities,
        securityEvents,
        failedActions,
      },
    });
  } catch (error) {
    console.error('Error in getAuditLogs:', error);
    res.status(500).json({ message: 'Failed to retrieve audit logs', error: error.message });
  }
};

/**
 * GET /api/audit-logs/:id
 * Retrieve full details of an individual audit entry
 */
export const getAuditLogById = async (req, res) => {
  try {
    const log = await AuditLog.findById(req.params.id).lean();
    if (!log) {
      return res.status(404).json({ message: 'Audit log not found' });
    }
    res.json(log);
  } catch (error) {
    console.error('Error in getAuditLogById:', error);
    res.status(500).json({ message: 'Failed to retrieve audit log', error: error.message });
  }
};

/**
 * GET /api/audit-logs/export/records
 * Returns up to 5000 records matching active filters for CSV / Excel / PDF generation
 */
export const exportAuditLogs = async (req, res) => {
  try {
    const filter = buildAuditFilter(req.query);
    const sortBy = req.query.sortBy || 'timestamp';
    const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;

    const logs = await AuditLog.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(5000)
      .lean();

    // Log the export activity itself!
    await recordAuditLog(
      {
        action: 'EXPORT_PERFORMED',
        module: 'System',
        targetType: 'AuditLog',
        targetName: 'Audit Report',
        description: `${req.user?.name || 'Admin'} exported ${logs.length} audit records`,
        status: 'Success',
        metadata: {
          exportedCount: logs.length,
          appliedFilters: req.query,
        },
      },
      req
    );

    res.json(logs);
  } catch (error) {
    console.error('Error in exportAuditLogs:', error);
    res.status(500).json({ message: 'Failed to export audit logs', error: error.message });
  }
};

/**
 * GET /api/audit-logs/retention/policy
 * Get current retention policy setting and retention statistics
 */
export const getRetentionPolicy = async (req, res) => {
  try {
    let settingDoc = await Setting.findOne({ key: 'system_settings' });
    const policy = settingDoc?.metadata?.auditRetentionPolicy || 'forever';
    const lastCleanupAt = settingDoc?.metadata?.auditLastCleanupAt || null;

    const [totalCount, oldestLog] = await Promise.all([
      AuditLog.countDocuments({}),
      AuditLog.findOne({}).sort({ timestamp: 1 }).select('timestamp').lean(),
    ]);

    res.json({
      policy,
      lastCleanupAt,
      totalCount,
      oldestLogDate: oldestLog ? oldestLog.timestamp : null,
    });
  } catch (error) {
    console.error('Error in getRetentionPolicy:', error);
    res.status(500).json({ message: 'Failed to retrieve retention policy', error: error.message });
  }
};

/**
 * PUT /api/audit-logs/retention/policy
 * Update audit log retention policy ('30', '90', '180', '365', 'forever')
 */
export const updateRetentionPolicy = async (req, res) => {
  try {
    const { policy } = req.body;
    const validPolicies = ['30', '90', '180', '365', 'forever'];

    if (!validPolicies.includes(String(policy))) {
      return res.status(400).json({ message: 'Invalid retention policy. Allowed: 30, 90, 180, 365, forever' });
    }

    let settingDoc = await Setting.findOne({ key: 'system_settings' });
    if (!settingDoc) {
      settingDoc = new Setting({ key: 'system_settings' });
    }

    if (!settingDoc.metadata) {
      settingDoc.metadata = {};
    }

    const previousPolicy = settingDoc.metadata.auditRetentionPolicy || 'forever';
    settingDoc.metadata.auditRetentionPolicy = String(policy);
    settingDoc.markModified('metadata');
    await settingDoc.save();

    // Log the change
    await recordAuditLog(
      {
        action: 'SETTINGS_UPDATED',
        module: 'Settings',
        targetType: 'Setting',
        targetName: 'Audit Retention Policy',
        description: `${req.user?.name || 'Admin'} updated Audit Retention Policy from ${previousPolicy} to ${policy}`,
        previousValue: previousPolicy,
        newValue: policy,
        change: `${previousPolicy} → ${policy}`,
        status: 'Success',
      },
      req
    );

    res.json({
      message: 'Retention policy updated successfully',
      policy: String(policy),
    });
  } catch (error) {
    console.error('Error in updateRetentionPolicy:', error);
    res.status(500).json({ message: 'Failed to update retention policy', error: error.message });
  }
};

/**
 * POST /api/audit-logs/retention/cleanup
 * Execute retention cleanup
 */
export const runRetentionCleanup = async (req, res) => {
  try {
    const settingDoc = await Setting.findOne({ key: 'system_settings' });
    const policy = settingDoc?.metadata?.auditRetentionPolicy || 'forever';

    if (policy === 'forever') {
      return res.json({
        message: 'Retention policy is set to Forever. No logs were deleted.',
        deletedCount: 0,
      });
    }

    const days = parseInt(policy, 10);
    if (isNaN(days) || days <= 0) {
      return res.status(400).json({ message: 'Invalid retention policy duration' });
    }

    const cutoffDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
    const deleteResult = await AuditLog.deleteMany({ timestamp: { $lt: cutoffDate } });

    if (settingDoc) {
      if (!settingDoc.metadata) settingDoc.metadata = {};
      settingDoc.metadata.auditLastCleanupAt = new Date();
      settingDoc.markModified('metadata');
      await settingDoc.save();
    }

    // Record audit event
    await recordAuditLog(
      {
        action: 'RETENTION_CLEANUP',
        module: 'System',
        targetType: 'AuditLog',
        targetName: 'Data Retention Cleanup',
        description: `Executed retention cleanup (${days} days policy): Purged ${deleteResult.deletedCount} old audit records`,
        status: 'Success',
        metadata: {
          cutoffDate,
          deletedCount: deleteResult.deletedCount,
          policy: `${days} days`,
        },
      },
      req
    );

    res.json({
      message: `Cleaned up ${deleteResult.deletedCount} audit records older than ${days} days`,
      deletedCount: deleteResult.deletedCount,
      cutoffDate,
    });
  } catch (error) {
    console.error('Error in runRetentionCleanup:', error);
    res.status(500).json({ message: 'Retention cleanup failed', error: error.message });
  }
};
