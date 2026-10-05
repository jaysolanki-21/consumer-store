import User from '../models/User.js';
import bcrypt from 'bcryptjs';
import imagekit from '../config/imagekit.js';

const uploadToImageKit = (file, folder = '/staff') =>
  new Promise((resolve, reject) => {
    imagekit.upload(
      {
        file: file.buffer,
        fileName: `${Date.now()}-${file.originalname}`,
        folder
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

export const getStaff = async (req, res) => {
  try {
    const staff = await User.find({ role: 'staff' })
      .select('-password')
      .sort({ createdAt: -1 });
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const createStaff = async (req, res) => {
  try {
    const { name, email, password } = req.body;
    if (!name || !email || !password)
      return res.status(400).json({ message: 'All fields are required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'Email already exists' });

    let imageUrl = '';
    let imageFileId = '';
    if (req.file) {
      const uploaded = await uploadToImageKit(req.file);
      imageUrl = uploaded.url;
      imageFileId = uploaded.fileId;
    }

    const user = await User.create({
      name, email, password, role: 'staff',
      image: imageUrl, imageFileId,
      isActive: true,
      isOnline: false,
      lastSeen: new Date()
    });

    const { password: _, ...userData } = user.toJSON();
    const io = req.app.get('io');
    if (io) io.emit('usersUpdated');

    res.status(201).json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const updateStaff = async (req, res) => {
  try {
    const { name, email } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    if (user.role !== 'staff')
      return res.status(400).json({ message: 'Not a staff account' });

    if (req.file) {
      if (user.imageFileId) {
        try { await imagekit.deleteFile(user.imageFileId); } catch {}
      }
      const uploaded = await uploadToImageKit(req.file);
      user.image = uploaded.url;
      user.imageFileId = uploaded.fileId;
    }

    user.name = name || user.name;
    user.email = email || user.email;
    await user.save();

    const { password, ...userData } = user.toJSON();
    const io = req.app.get('io');
    if (io) io.emit('usersUpdated');

    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const setStaffStatus = async (req, res) => {
  try {
    const { isActive, disabledUntil } = req.body;
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    if (user.role !== 'staff')
      return res.status(400).json({ message: 'Not a staff account' });

    user.isActive = Boolean(isActive);
    user.disabledUntil = disabledUntil || null;

    const isCurrentlyDisabled = !user.isActive || (user.disabledUntil && new Date(user.disabledUntil) > new Date());
    if (isCurrentlyDisabled) {
      user.isOnline = false;
    }

    await user.save();

    const io = req.app.get('io');
    if (io) {
      if (isCurrentlyDisabled) {
        io.emit('userForceLogout', { userId: String(user._id), message: 'Your staff account has been deactivated by administrator.' });
      }
      io.emit('usersUpdated');
      io.emit('countersUpdated');
    }

    const { password, ...userData } = user.toJSON();
    res.json(userData);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const resetStaffPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || newPassword.length < 6)
      return res.status(400).json({ message: 'Password must be at least 6 characters' });

    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    if (user.role !== 'staff')
      return res.status(400).json({ message: 'Not a staff account' });

    user.password = newPassword;
    await user.save();

    const io = req.app.get('io');
    if (io) {
      io.emit('userForceLogout', { userId: String(user._id), message: 'Password has been reset. Please log in again.' });
      io.emit('usersUpdated');
    }

    res.json({ message: 'Password reset successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const deleteStaff = async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ message: 'Staff not found' });
    if (user.role !== 'staff')
      return res.status(400).json({ message: 'Not a staff account' });

    if (user.imageFileId) {
      try { await imagekit.deleteFile(user.imageFileId); } catch {}
    }

    const io = req.app.get('io');
    if (io) {
      io.emit('userForceLogout', { userId: String(user._id), message: 'Account deleted.' });
      io.emit('usersUpdated');
    }

    await user.deleteOne();
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const getLoginHistory = async (req, res) => {
  try {
    const users = await User.find({ role: { $in: ['staff', 'counter', 'admin'] } })
      .select('name email role loginHistory lastLogin lastSeen isOnline')
      .lean();

    const history = [];
    users.forEach(u => {
      (u.loginHistory || []).forEach(h => {
        history.push({
          userId: u._id,
          name: u.name,
          email: u.email,
          role: u.role,
          loginAt: h.loginAt,
          logoutAt: h.logoutAt,
          ip: h.ip,
          userAgent: h.userAgent
        });
      });
    });

    history.sort((a, b) => new Date(b.loginAt) - new Date(a.loginAt));
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};