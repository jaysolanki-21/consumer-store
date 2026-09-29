import Counter from '../models/Counter.js';
import User from '../models/User.js';

const USER_POPULATE_FIELDS = 'name email isActive disabledUntil lastLogin lastSeen isOnline isOnBreak totalWorkingTime totalActiveTime totalBreakTime currentSessionStart currentBreakStart';

const emitCountersUpdated = (req) => {
  const io = req.app.get('io');
  if (io) {
    io.emit('countersUpdated');
    io.emit('usersUpdated');
  }
};

export const getCounters = async (req, res) => {
  try {
    const counters = await Counter.find()
      .populate('userId', USER_POPULATE_FIELDS)
      .sort({ createdAt: 1 });
    res.json(counters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCounter = async (req, res) => {
  try {
    const { name, email, password, description } = req.body;
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Counter name, email and password are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    let user;
    try {
      user = await User.create({ name, email, password, role: 'counter', isActive: true });
      const counter = await Counter.create({ name, description, userId: user._id, isActive: true });

      emitCountersUpdated(req);
      res.status(201).json(await counter.populate('userId', USER_POPULATE_FIELDS));
    } catch (error) {
      if (user?._id) await User.findByIdAndDelete(user._id);
      throw error;
    }
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateCounter = async (req, res) => {
  try {
    const { name, email, description } = req.body;
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });

    if (name) counter.name = name;
    if (description !== undefined) counter.description = description;

    if (counter.userId) {
      const user = await User.findById(counter.userId);
      if (user) {
        if (name) user.name = name;
        if (email) user.email = email;
        await user.save();
      }
    }

    await counter.save();
    emitCountersUpdated(req);
    res.json(await counter.populate('userId', USER_POPULATE_FIELDS));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setCounterStatus = async (req, res) => {
  try {
    const { isActive, disabledUntil } = req.body;
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });

    counter.isActive = Boolean(isActive);
    counter.disabledUntil = disabledUntil || null;

    if (counter.userId) {
      const user = await User.findById(counter.userId);
      if (user) {
        user.isActive = counter.isActive;
        user.disabledUntil = counter.disabledUntil;

        const isCurrentlyDisabled = !counter.isActive || (counter.disabledUntil && new Date(counter.disabledUntil) > new Date());
        if (isCurrentlyDisabled) {
          user.isOnline = false;
          user.isOnBreak = false;
          if (user.currentSessionStart) {
            user.totalWorkingTime = (user.totalWorkingTime || 0) + (new Date() - user.currentSessionStart);
            user.currentSessionStart = null;
          }
          if (user.currentBreakStart) {
            user.totalBreakTime = (user.totalBreakTime || 0) + (new Date() - user.currentBreakStart);
            user.currentBreakStart = null;
          }
          user.totalActiveTime = Math.max(0, (user.totalWorkingTime || 0) - (user.totalBreakTime || 0));
        }

        await user.save();

        const io = req.app.get('io');
        if (io) {
          if (isCurrentlyDisabled) {
            io.emit('userForceLogout', { userId: String(user._id), message: 'Counter account has been disabled by administrator.' });
          }
          io.emit('usersUpdated');
        }
      }
    }

    await counter.save();
    emitCountersUpdated(req);
    res.json(await counter.populate('userId', USER_POPULATE_FIELDS));
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetCounterPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6) {
      return res.status(400).json({ message: 'Password must be at least 6 characters' });
    }
    const counter = await Counter.findById(req.params.id);
    if (!counter || !counter.userId) return res.status(404).json({ message: 'Counter account not found' });
    const user = await User.findById(counter.userId);
    user.password = newPassword;
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('userForceLogout', { userId: String(user._id), message: 'Password has been reset. Please log in again.' });
      io.emit('usersUpdated');
      io.emit('countersUpdated');
    }

    res.json({ message: 'Counter password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCounter = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });
    if (counter.userId) {
      const io = req.app.get('io');
      if (io) {
        io.emit('userForceLogout', { userId: String(counter.userId), message: 'Counter account has been deleted.' });
      }
      await User.findByIdAndDelete(counter.userId);
    }
    await counter.deleteOne();
    emitCountersUpdated(req);
    res.json({ message: 'Counter deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};