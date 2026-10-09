import express from 'express';
import multer from 'multer';
import {
  exportModule,
  validateImportPreview,
  commitImport,
  createFullBackup,
  validateRestoreBackup,
  commitRestoreBackup,
  getBackupHistory,
} from '../controllers/backupController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// Configure memory storage for uploaded JSON / CSV / ZIP files
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB maximum backup/import file
  fileFilter: (_req, file, cb) => {
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (['json', 'csv', 'zip'].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Only .json, .csv, and .zip files are allowed'), false);
    }
  },
});

// All backup & export/import routes strictly require admin privileges
router.use(protect, adminOnly);

// 1. Export individual module
router.get('/export/:module', exportModule);

// 2. Import individual module (Preview stage)
router.post('/import/:module/preview', upload.single('file'), validateImportPreview);

// 3. Import individual module (Commit stage)
router.post('/import/:module/commit', commitImport);

// 4. Full System Backup (Generate & download ZIP)
router.get('/full/backup', createFullBackup);

// 5. Full System Restore (Validate ZIP package)
router.post('/full/restore/preview', upload.single('file'), validateRestoreBackup);

// 6. Full System Restore (Commit staged restore)
router.post('/full/restore/commit', commitRestoreBackup);

// 7. Backup history and metrics
router.get('/history', getBackupHistory);

export default router;
