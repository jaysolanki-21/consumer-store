import Counter from '../models/Counter.js';
import User from '../models/User.js';
import { recordAuditLog } from '../utils/auditLogger.js';

const USER_POPULATE_FIELDS = 'name email isActive disabledUntil lastLogin lastSeen isOnline';

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

      await recordAuditLog(
        {
          userId: req.user?._id,
          userName: req.user?.name || 'Admin',
          role: req.user?.role || 'admin',
          action: 'COUNTER_CREATED',
          module: 'Counters',
          targetType: 'Counter',
          targetId: counter._id,
          targetName: counter.name,
          counterId: counter._id.toString(),
          counterName: counter.name,
          description: `${req.user?.name || 'Admin'} created new POS counter "${counter.name}"`,
          status: 'Success',
        },
        req
      );

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

    const oldName = counter.name;
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

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'COUNTER_UPDATED',
        module: 'Counters',
        targetType: 'Counter',
        targetId: counter._id,
        targetName: counter.name,
        counterId: counter._id.toString(),
        counterName: counter.name,
        previousValue: { name: oldName },
        newValue: { name: counter.name },
        description: `${req.user?.name || 'Admin'} updated counter "${counter.name}"`,
        status: 'Success',
      },
      req
    );

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

    const wasActive = counter.isActive && (!counter.disabledUntil || new Date(counter.disabledUntil) <= new Date());

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
        }

        await user.save();

        const io = req.app.get('io');
        if (io) {
          if (isCurrentlyDisabled) {
            io.emit('userForceLogout', {
              userId: String(user._id),
              message: 'Counter account has been disabled by administrator.',
            });
          }
          io.emit('usersUpdated');
        }
      }
    }

    await counter.save();
    emitCountersUpdated(req);

    const isCurrentlyDisabled = !counter.isActive || (counter.disabledUntil && new Date(counter.disabledUntil) > new Date());

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'COUNTER_STATUS_CHANGED',
        module: 'Counters',
        targetType: 'Counter',
        targetId: counter._id,
        targetName: counter.name,
        counterId: counter._id.toString(),
        counterName: counter.name,
        previousValue: wasActive ? 'Active' : 'Disabled',
        newValue: isCurrentlyDisabled ? 'Disabled' : 'Active',
        change: `${wasActive ? 'Active' : 'Disabled'} → ${isCurrentlyDisabled ? 'Disabled' : 'Active'}`,
        description: `${req.user?.name || 'Admin'} ${isCurrentlyDisabled ? 'disabled' : 'enabled'} counter: ${counter.name}`,
        status: isCurrentlyDisabled ? 'Warning' : 'Success',
      },
      req
    );

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
      io.emit('userForceLogout', {
        userId: String(user._id),
        message: 'Password has been reset. Please log in again.',
      });
      io.emit('usersUpdated');
      io.emit('countersUpdated');
    }

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'COUNTER_PASSWORD_RESET',
        module: 'Counters',
        targetType: 'Counter',
        targetId: counter._id,
        targetName: counter.name,
        counterId: counter._id.toString(),
        counterName: counter.name,
        description: `${req.user?.name || 'Admin'} reset password for counter: ${counter.name}`,
        status: 'Warning',
      },
      req
    );

    res.json({ message: 'Counter password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCounter = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });
    const counterName = counter.name;
    const cId = counter._id.toString();

    if (counter.userId) {
      const io = req.app.get('io');
      if (io) {
        io.emit('userForceLogout', { userId: String(counter.userId), message: 'Counter account has been deleted.' });
      }
      await User.findByIdAndDelete(counter.userId);
    }
    await counter.deleteOne();
    emitCountersUpdated(req);

    await recordAuditLog(
      {
        userId: req.user?._id,
        userName: req.user?.name || 'Admin',
        role: req.user?.role || 'admin',
        action: 'COUNTER_DELETED',
        module: 'Counters',
        targetType: 'Counter',
        targetId: cId,
        targetName: counterName,
        counterId: cId,
        counterName: counterName,
        description: `${req.user?.name || 'Admin'} deleted counter "${counterName}"`,
        status: 'Warning',
      },
      req
    );

    res.json({ message: 'Counter deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};