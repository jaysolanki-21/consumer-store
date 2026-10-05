import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  disabledUntil: { type: Date, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

counterSchema.virtual('isTemporarilyDisabled').get(function() {
  return !!(this.disabledUntil && this.disabledUntil > new Date());
});

// Real-time status virtual with DISABLED as highest priority
counterSchema.virtual('status').get(function() {
  if (!this.isActive || (this.disabledUntil && new Date(this.disabledUntil) > new Date())) {
    return 'DISABLED';
  }
  if (!this.userId) {
    return 'OFFLINE';
  }
  if (typeof this.userId === 'object' && this.userId !== null) {
    if (!this.userId.isActive || (this.userId.disabledUntil && new Date(this.userId.disabledUntil) > new Date())) {
      return 'DISABLED';
    }
    if (!this.userId.isOnline) {
      return 'OFFLINE';
    }
    return 'ONLINE';
  }
  return 'OFFLINE';
});

export default mongoose.model('Counter', counterSchema);
