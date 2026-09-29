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

    if (user.role === 'counter') {
      const counterDoc = await Counter.findOne({ userId: user._id });
      const cId = counterDoc ? counterDoc._id.toString() : user._id.toString();
      const cName = counterDoc ? counterDoc.name : user.name;
      response.counter = {
        _id: cId,
        name: cName
      };
      response.counterId = cId;
      response.counterName = cName;
    }

    // Create session / mark Online
    user.lastLogin = new Date();
    user.lastSeen = new Date();
    user.isOnline = true;
    user.isOnBreak = false;
    if (!user.currentSessionStart) {
      user.currentSessionStart = new Date();
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
 * Endpoint for navigator.sendBeacon when closing browser/tab
 */
export const beaconDisconnect = async (req, res) => {
  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch {}
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