import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: {
    type: String,
    enum: ['admin', 'staff', 'counter'],
    default: 'counter'
  },
  image: { type: String, default: '' },
  imageFileId: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  disabledUntil: { type: Date, default: null },
  lastLogin: { type: Date },
  lastSeen: { type: Date, default: Date.now },
  isOnline: { type: Boolean, default: false },
  isOnBreak: { type: Boolean, default: false },
  currentSessionStart: { type: Date, default: null },
  currentBreakStart: { type: Date, default: null },
  totalWorkingTime: { type: Number, default: 0 },
  totalBreakTime: { type: Number, default: 0 },
  totalActiveTime: { type: Number, default: 0 },
  loginHistory: [{
    loginAt: { type: Date, default: Date.now },
    logoutAt: { type: Date, default: null },
    ip: { type: String, default: '' },
    userAgent: { type: String, default: '' }
  }]
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Real-time status virtual with DISABLED as highest priority
userSchema.virtual('status').get(function() {
  if (!this.isActive || (this.disabledUntil && new Date(this.disabledUntil) > new Date())) {
    return 'DISABLED';
  }
  if (!this.isOnline) {
    return 'OFFLINE';
  }
  if (this.isOnBreak) {
    return 'ON BREAK';
  }
  return 'ONLINE';
});

userSchema.pre('save', function (next) {
  if (!this.isModified('password')) return next();
  bcrypt.hash(this.password, 10, (err, hash) => {
    if (err) return next(err);
    this.password = hash;
    next();
  });
});

userSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

export default mongoose.model('User', userSchema);