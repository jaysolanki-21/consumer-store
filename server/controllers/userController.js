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
      image: imageUrl, imageFileId
    });

    const { password: _, ...userData } = user.toObject();
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

    const { password, ...userData } = user.toObject();
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
    await user.save();

    const { password, ...userData } = user.toObject();
    const io = req.app.get('io');
    if (io) io.emit('usersUpdated');
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

    await user.deleteOne();
    res.json({ message: 'Staff deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};