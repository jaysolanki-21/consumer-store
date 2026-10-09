import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { disconnectUserBeacon } from '../sockets/socketHandler.js';
import { recordAuditLog, extractClientInfo } from '../utils/auditLogger.js';

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    const clientInfo = extractClientInfo(req);

    // Validate input
    if (!email || !password) {
      await recordAuditLog(
        {
          action: 'FAILED_LOGIN',
          module: 'Authentication',
          targetType: 'Session',
          targetName: email || 'Unknown',
          description: `Login attempted without required credentials`,
          status: 'Failed',
          failureReason: 'Missing email or password',
          role: 'anonymous',
          userName: email || 'Anonymous',
        },
        req
      );
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      await recordAuditLog(
        {
          action: 'FAILED_LOGIN',
          module: 'Authentication',
          targetType: 'Session',
          targetName: email,
          description: `Failed login attempt: account ${email} not found`,
          status: 'Failed',
          failureReason: 'Account not found',
          role: 'anonymous',
          userName: email,
        },
        req
      );
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      await recordAuditLog(
        {
          userId: user._id,
          userName: user.name,
          role: user.role,
          action: 'FAILED_LOGIN',
          module: 'Authentication',
          targetType: 'Session',
          targetName: user.email,
          description: `Failed login attempt for ${user.name} (${user.email}): incorrect password`,
          status: 'Failed',
          failureReason: 'Incorrect password',
        },
        req
      );
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active / disabled
    if (!user.isActive || (user.disabledUntil && new Date(user.disabledUntil) > new Date())) {
      await recordAuditLog(
        {
          userId: user._id,
          userName: user.name,
          role: user.role,
          action: 'FAILED_LOGIN',
          module: 'Authentication',
          targetType: 'Session',
          targetName: user.email,
          description: `Login rejected for ${user.name} (${user.role.toUpperCase()}): account is deactivated`,
          status: 'Warning',
          failureReason: 'Account deactivated by administrator',
        },
        req
      );
      return res.status(403).json({ message: 'Account is deactivated. Please contact admin.' });
    }

    // Build response with all fields
    const response = {
      _id: user._id,
      name: user.name,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      token: generateToken(user._id),
      status: 'ONLINE',
    };

    let counterDoc = null;
    if (user.role === 'counter') {
      counterDoc = await Counter.findOne({ userId: user._id });
      const cId = counterDoc ? counterDoc._id.toString() : user._id.toString();
      const cName = counterDoc ? counterDoc.name : user.name;
      response.counter = {
        _id: cId,
        name: cName,
      };
      response.counterId = cId;
      response.counterName = cName;
    }

    // Mark Online
    user.lastLogin = new Date();
    user.lastSeen = new Date();
    user.isOnline = true;
    if (!user.loginHistory) user.loginHistory = [];
    user.loginHistory.push({
      loginAt: new Date(),
      logoutAt: null,
      ip: clientInfo.ipAddress,
      userAgent: req.headers['user-agent'] || '',
    });
    if (user.loginHistory.length > 50) {
      user.loginHistory = user.loginHistory.slice(-50);
    }
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('usersUpdated');
      io.emit('countersUpdated');
    }

    // Record Successful Login Audit Log
    await recordAuditLog(
      {
        userId: user._id,
        userName: user.name,
        role: user.role,
        action: 'LOGIN',
        module: 'Authentication',
        targetType: 'Session',
        targetName: user.name,
        counterId: counterDoc?._id ? String(counterDoc._id) : null,
        counterName: counterDoc?.name || null,
        description: `${user.name} (${user.role.toUpperCase()}) logged in from ${clientInfo.deviceName}`,
        status: 'Success',
        metadata: {
          email: user.email,
          loginTime: new Date(),
          device: clientInfo.deviceName,
          os: clientInfo.os,
          browser: clientInfo.browser,
          ip: clientInfo.ipAddress,
        },
      },
      req
    );

    res.json(response);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

/**
 * Endpoint for manual User Logout
 */
export const logoutUser = async (req, res) => {
  try {
    const userId = req.user?._id;
    const clientInfo = extractClientInfo(req);

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();

        let sessionDurationMs = 0;
        if (user.loginHistory && user.loginHistory.length > 0) {
          const lastEntry = user.loginHistory[user.loginHistory.length - 1];
          if (lastEntry && !lastEntry.logoutAt) {
            lastEntry.logoutAt = new Date();
            sessionDurationMs = Math.max(0, new Date().getTime() - new Date(lastEntry.loginAt).getTime());
          }
        }
        await user.save();

        const durationMinutes = Math.round(sessionDurationMs / 60000);
        const durationFormatted = durationMinutes > 0 ? `${durationMinutes}m` : `${Math.round(sessionDurationMs / 1000)}s`;

        await recordAuditLog(
          {
            userId: user._id,
            userName: user.name,
            role: user.role,
            action: 'LOGOUT',
            module: 'Authentication',
            targetType: 'Session',
            targetName: user.name,
            description: `${user.name} (${user.role.toUpperCase()}) logged out (Session: ${durationFormatted})`,
            status: 'Success',
            metadata: {
              sessionDurationMs,
              sessionDuration: durationFormatted,
              logoutAt: new Date(),
            },
          },
          req
        );

        const io = req.app.get('io');
        if (io) {
          io.emit('usersUpdated');
          io.emit('countersUpdated');
        }
      }
    }

    res.status(200).json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ message: 'Error during logout' });
  }
};

/**
 * Endpoint for navigator.sendBeacon when closing browser/tab
 */
export const beaconDisconnect = async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch {}
    }
    const userId = body?.userId;
    if (userId) {
      await disconnectUserBeacon(userId);
      const user = await User.findById(userId);
      if (user) {
        await recordAuditLog(
          {
            userId: user._id,
            userName: user.name,
            role: user.role,
            action: 'LOGOUT',
            module: 'Authentication',
            targetType: 'Session',
            targetName: user.name,
            description: `${user.name} session ended (Browser/Tab closed)`,
            status: 'Success',
          },
          req
        );
      }
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(200).send('OK');
  }
};