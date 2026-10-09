import express from 'express';
import {
  getAuditLogs,
  getAuditLogById,
  exportAuditLogs,
  getRetentionPolicy,
  updateRetentionPolicy,
  runRetentionCleanup,
} from '../controllers/auditLogController.js';
import { protect, adminOnly } from '../middleware/authMiddleware.js';

const router = express.Router();

// All audit log routes require valid JWT and Admin role
router.use(protect, adminOnly);

router.get('/', getAuditLogs);
router.get('/export/records', exportAuditLogs);
router.get('/retention/policy', getRetentionPolicy);
router.put('/retention/policy', updateRetentionPolicy);
router.post('/retention/cleanup', runRetentionCleanup);
router.get('/:id', getAuditLogById);

export default router;
