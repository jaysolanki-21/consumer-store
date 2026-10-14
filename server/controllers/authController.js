import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import User from '../models/User.js';
import Counter from '../models/Counter.js';
import { disconnectUserBeacon } from '../sockets/socketHandler.js';

const generateToken = (id) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET is not defined in environment');
  }
  return jwt.sign({ id }, process.env.JWT_SECRET, { expiresIn: '30d' });
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Validate input
    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email });

    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    // Check if user is active / disabled
    if (!user.isActive || (user.disabledUntil && new Date(user.disabledUntil) > new Date())) {
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
      ip: req.headers['x-forwarded-for']?.split(',')[0]?.trim() || req.ip || '127.0.0.1',
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

    if (userId) {
      const user = await User.findById(userId);
      if (user) {
        user.isOnline = false;
        user.lastSeen = new Date();

        if (user.loginHistory && user.loginHistory.length > 0) {
          const lastEntry = user.loginHistory[user.loginHistory.length - 1];
          if (lastEntry && !lastEntry.logoutAt) {
            lastEntry.logoutAt = new Date();
          }
        }
        await user.save();

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
    }
    res.status(200).send('OK');
  } catch (err) {
    res.status(200).send('OK');
  }
};

/**
 * Change Password for the logged-in user
 */
export const changePassword = async (req, res) => {
  try {
    const { currentPassword, newPassword, confirmNewPassword } = req.body;

    if (!currentPassword) {
      return res.status(400).json({ message: 'Current password is required' });
    }

    if (!newPassword) {
      return res.status(400).json({ message: 'New password is required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    if (confirmNewPassword !== undefined && newPassword !== confirmNewPassword) {
      return res.status(400).json({ message: 'New password and confirmation do not match' });
    }

    if (currentPassword === newPassword) {
      return res.status(400).json({ message: 'New password cannot be the same as current password' });
    }

    // Retrieve user including password
    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const isMatch = await user.matchPassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({ message: 'Current password is incorrect' });
    }

    // Assign new password (hashed by pre-save hook)
    user.password = newPassword;
    await user.save();

    res.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    res.status(500).json({ message: 'Failed to update password', error: error.message });
  }
};

/**
 * Create another administrator account (Admin Only)
 */
export const createAdmin = async (req, res) => {
  try {
    const { name, email, password, confirmPassword } = req.body;

    // Validate required fields
    if (!name || !name.trim()) {
      return res.status(400).json({ message: 'Full name is required' });
    }

    if (!email || !email.trim()) {
      return res.status(400).json({ message: 'Email address is required' });
    }

    const trimmedEmail = email.trim().toLowerCase();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      return res.status(400).json({ message: 'Please enter a valid email address' });
    }

    if (!password) {
      return res.status(400).json({ message: 'Password is required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }

    if (confirmPassword !== undefined && password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }

    // Check duplicate email across all users
    const existing = await User.findOne({ email: trimmedEmail });
    if (existing) {
      return res.status(400).json({ message: 'An account with this email already exists' });
    }

    // Always assign 'admin' role securely on the backend
    const newAdmin = await User.create({
      name: name.trim(),
      email: trimmedEmail,
      password,
      role: 'admin',
      isActive: true,
      isOnline: false,
      lastSeen: new Date(),
    });

    const { password: _, ...adminData } = newAdmin.toJSON();

    const io = req.app.get('io');
    if (io) {
      io.emit('usersUpdated');
    }

    res.status(201).json({
      success: true,
      message: 'Admin account created successfully',
      admin: adminData,
    });
  } catch (error) {
    console.error('Create admin error:', error);
    res.status(500).json({ message: 'Failed to create admin account', error: error.message });
  }
};

/**
 * List all administrator accounts (Admin Only)
 */
export const getAdmins = async (req, res) => {
  try {
    const admins = await User.find({ role: 'admin' })
      .select('-password -loginHistory')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      admins,
    });
  } catch (error) {
    console.error('Get admins error:', error);
    res.status(500).json({ message: 'Failed to retrieve admin accounts', error: error.message });
  }
};