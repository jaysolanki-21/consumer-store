import express from 'express';
import multer from 'multer';
import {
  getStaff,
  createStaff,
  updateStaff,
  setStaffStatus,
  resetStaffPassword,
  deleteStaff
} from '../controllers/userController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Memory storage — we stream the buffer to ImageKit
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'), false);
  }
});

// All routes are relative to /api/users (mounted in server.js)
router.get('/staff', protect, adminOnly, getStaff);
router.post('/staff', protect, adminOnly, upload.single('image'), createStaff);
router.put('/staff/:id', protect, adminOnly, upload.single('image'), updateStaff);
router.put('/staff/:id/status', protect, adminOnly, setStaffStatus);
router.put('/staff/:id/reset-password', protect, adminOnly, resetStaffPassword);
router.delete('/staff/:id', protect, adminOnly, deleteStaff);

export default router;