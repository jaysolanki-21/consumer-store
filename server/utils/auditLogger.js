import AuditLog from '../models/AuditLog.js';
import { getIO } from '../sockets/ioInstance.js';

// Safe keys filter to prevent logging sensitive credentials
const SENSITIVE_KEYS = new Set([
  'password',
  'token',
  'refreshtoken',
  'secret',
  'key',
  'jwt',
  'authorization',
  'cookie',
  'sessioncookie',
  'cvv',
  'cardnumber',
  'creditcard',
  'apikey',
  'secretkey',
]);

/**
 * Recursively sanitize objects to remove sensitive keys (passwords, tokens, secrets)
 */
export const sanitizeData = (data) => {
  if (!data || typeof data !== 'object') return data;
  if (data instanceof Date) return data;
  if (Array.isArray(data)) return data.map(sanitizeData);

  const sanitized = {};
  for (const [key, val] of Object.entries(data)) {
    const lowerKey = key.toLowerCase();
    if (SENSITIVE_KEYS.has(lowerKey) || lowerKey.includes('password') || lowerKey.includes('secret')) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof val === 'object' && val !== null) {
      sanitized[key] = sanitizeData(val);
    } else {
      sanitized[key] = val;
    }
  }
  return sanitized;
};

/**
 * Extract Device, OS, Browser, and IP from Express Request
 */
export const extractClientInfo = (req) => {
  if (!req) {
    return {
      ipAddress: '127.0.0.1',
      deviceName: 'System Server',
      deviceType: 'server',
      os: 'System Environment',
      browser: 'System Runtime',
      sessionId: '',
    };
  }

  // 1. IP Address
  let ipAddress =
    req.headers['x-forwarded-for']?.split(',')[0].trim() ||
    req.headers['x-real-ip'] ||
    req.ip ||
    req.socket?.remoteAddress ||
    '127.0.0.1';
  if (ipAddress === '::1' || ipAddress === '::ffff:127.0.0.1') {
    ipAddress = '127.0.0.1';
  }

  // 2. Client-provided headers (via frontend interceptor)
  const clientSessionId = req.headers['x-session-id'] || '';
  const clientDeviceName = req.headers['x-device-name'] || '';
  const clientDeviceType = req.headers['x-device-type'] || '';

  // 3. User-Agent parsing
  const ua = req.headers['user-agent'] || '';

  let os = 'Unknown OS';
  if (/windows nt 10\.0/i.test(ua)) os = 'Windows 11 / 10';
  else if (/windows nt 6\.3/i.test(ua)) os = 'Windows 8.1';
  else if (/windows nt 6\.1/i.test(ua)) os = 'Windows 7';
  else if (/macintosh|mac os x/i.test(ua)) os = 'macOS';
  else if (/android/i.test(ua)) os = 'Android';
  else if (/iphone|ipad|ipod/i.test(ua)) os = 'iOS';
  else if (/linux/i.test(ua)) os = 'Linux';

  let browser = 'Unknown Browser';
  if (/edg\//i.test(ua)) browser = 'Edge';
  else if (/opr\/|opera/i.test(ua)) browser = 'Opera';
  else if (/chrome|crios/i.test(ua)) browser = 'Chrome';
  else if (/firefox|fxios/i.test(ua)) browser = 'Firefox';
  else if (/safari/i.test(ua)) browser = 'Safari';

  let deviceType = clientDeviceType || 'desktop';
  if (!clientDeviceType) {
    if (/tablet|ipad/i.test(ua)) deviceType = 'tablet';
    else if (/mobile|android|iphone/i.test(ua)) deviceType = 'mobile';
    else deviceType = 'desktop';
  }

  let deviceName = clientDeviceName;
  if (!deviceName) {
    if (deviceType === 'desktop') {
      deviceName = `${os} (${browser})`;
    } else {
      deviceName = `${os} ${deviceType.charAt(0).toUpperCase() + deviceType.slice(1)}`;
    }
  }

  return {
    ipAddress,
    deviceName,
    deviceType,
    os,
    browser,
    sessionId: clientSessionId,
  };
};

/**
 * Record an audit log entry in MongoDB and broadcast via Socket.IO
 */
export const recordAuditLog = async (logData, req = null) => {
  try {
    const clientInfo = extractClientInfo(req);

    // Resolve user data from req.user if available
    const userId = logData.userId || req?.user?._id || null;
    const userName = logData.userName || req?.user?.name || (userId ? 'User' : 'System');
    const role = (logData.role || req?.user?.role || 'system').toLowerCase();

    const entry = {
      timestamp: logData.timestamp || new Date(),
      userId,
      userName,
      role: ['admin', 'staff', 'counter', 'system', 'anonymous'].includes(role) ? role : 'system',
      action: logData.action,
      module: logData.module,
      targetType: logData.targetType || '',
      targetId: logData.targetId ? String(logData.targetId) : '',
      targetName: logData.targetName || '',
      description: logData.description || `${userName} performed ${logData.action}`,
      status: logData.status || 'Success',
      previousValue: sanitizeData(logData.previousValue),
      newValue: sanitizeData(logData.newValue),
      change: sanitizeData(logData.change),
      metadata: sanitizeData(logData.metadata),
      deviceName: logData.deviceName || clientInfo.deviceName,
      deviceType: logData.deviceType || clientInfo.deviceType,
      os: logData.os || clientInfo.os,
      browser: logData.browser || clientInfo.browser,
      ipAddress: logData.ipAddress || clientInfo.ipAddress,
      sessionId: logData.sessionId || clientInfo.sessionId,
      orderId: logData.orderId ? String(logData.orderId) : null,
      counterId: logData.counterId ? String(logData.counterId) : null,
      counterName: logData.counterName || null,
      amount: typeof logData.amount === 'number' ? logData.amount : null,
      paymentMethod: logData.paymentMethod || null,
      failureReason: logData.failureReason || null,
    };

    const doc = await AuditLog.create(entry);

    // Real-time broadcast to connected admin clients via Socket.IO
    const io = getIO() || req?.app?.get('io');
    if (io) {
      io.emit('auditLogCreated', doc);
    }

    return doc;
  } catch (error) {
    console.error('⚠️ Failed to record audit log:', error.message);
    // Never throw error so parent business logic is uninhibited
    return null;
  }
};

export default {
  recordAuditLog,
  extractClientInfo,
  sanitizeData,
};
