import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema(
  {
    timestamp: {
      type: Date,
      default: Date.now,
      index: true,
    },
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      index: true,
      default: null,
    },
    userName: {
      type: String,
      default: 'System',
      index: true,
    },
    role: {
      type: String,
      enum: ['admin', 'staff', 'counter', 'system', 'anonymous'],
      default: 'system',
      index: true,
    },
    action: {
      type: String,
      required: true,
      index: true,
    },
    module: {
      type: String,
      required: true,
      enum: [
        'Authentication',
        'Orders',
        'Inventory',
        'Products',
        'Categories',
        'Staff',
        'Counters',
        'Payments',
        'Settings',
        'System',
      ],
      index: true,
    },
    targetType: {
      type: String,
      default: '',
    },
    targetId: {
      type: String,
      default: '',
    },
    targetName: {
      type: String,
      default: '',
    },
    description: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ['Success', 'Failed', 'Warning'],
      default: 'Success',
      index: true,
    },
    previousValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    newValue: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    change: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
      default: null,
    },
    deviceName: {
      type: String,
      default: 'Desktop PC',
    },
    deviceType: {
      type: String,
      enum: ['desktop', 'laptop', 'mobile', 'tablet', 'server', 'unknown'],
      default: 'desktop',
    },
    os: {
      type: String,
      default: 'Unknown OS',
    },
    browser: {
      type: String,
      default: 'Unknown Browser',
    },
    ipAddress: {
      type: String,
      default: '127.0.0.1',
    },
    sessionId: {
      type: String,
      default: '',
    },
    orderId: {
      type: String,
      default: null,
      index: true,
    },
    counterId: {
      type: String,
      default: null,
      index: true,
    },
    counterName: {
      type: String,
      default: null,
    },
    amount: {
      type: Number,
      default: null,
    },
    paymentMethod: {
      type: String,
      default: null,
    },
    failureReason: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Compound indexes for optimal queries and sorting
auditLogSchema.index({ module: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ role: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ targetName: 1 });
auditLogSchema.index({ createdAt: -1 });

export default mongoose.model('AuditLog', auditLogSchema);
