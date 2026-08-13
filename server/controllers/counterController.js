import Counter from '../models/Counter.js';
import User from '../models/User.js';

const nextCounterId = async () => {
  const counters = await Counter.find({}, 'counterId');
  const used = new Set(counters.map(counter => counter.counterId));
  let index = 1;
  while (used.has(`counter-${index}`)) index += 1;
  return `counter-${index}`;
};

const emitCountersUpdated = (req) => {
  const io = req.app.get('io');
  if (io) io.emit('countersUpdated');
};

export const getCounters = async (req, res) => {
  try {
    const counters = await Counter.find().populate('userId', 'name email isActive disabledUntil lastLogin').sort({ counterId: 1 });
    res.json(counters);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createCounter = async (req, res) => {
  try {
    const { name, counterId, email, password, description } = req.body;
    const finalCounterId = counterId?.trim() || await nextCounterId();
    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Counter name, email and password are required' });
    }

    const existingCounter = await Counter.findOne({ counterId: finalCounterId });
    if (existingCounter) return res.status(400).json({ message: 'Counter ID already exists' });

    const existingUser = await User.findOne({ email });
    if (existingUser) return res.status(400).json({ message: 'Email already exists' });

    let user;
    try {
      user = await User.create({ name, email, password, role: 'counter', counterId: finalCounterId, isActive: true });
      const counter = await Counter.create({ name, counterId: finalCounterId, description, userId: user._id, isActive: true });

      emitCountersUpdated(req);
      res.status(201).json(await counter.populate('userId', 'name email isActive disabledUntil lastLogin'));
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
    res.json(await counter.populate('userId', 'name email isActive disabledUntil lastLogin'));
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
      await User.findByIdAndUpdate(counter.userId, {
        isActive: counter.isActive,
        disabledUntil: counter.disabledUntil
      });
    }

    await counter.save();
    emitCountersUpdated(req);
    res.json(await counter.populate('userId', 'name email isActive disabledUntil lastLogin'));
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
    res.json({ message: 'Counter password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteCounter = async (req, res) => {
  try {
    const counter = await Counter.findById(req.params.id);
    if (!counter) return res.status(404).json({ message: 'Counter not found' });
    if (counter.userId) await User.findByIdAndDelete(counter.userId);
    await counter.deleteOne();
    emitCountersUpdated(req);
    res.json({ message: 'Counter deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};