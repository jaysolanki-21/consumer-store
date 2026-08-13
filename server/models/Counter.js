import mongoose from 'mongoose';

const counterSchema = new mongoose.Schema({
  counterId: { type: String, required: true, unique: true, trim: true },
  name: { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  isActive: { type: Boolean, default: true },
  disabledUntil: { type: Date, default: null },
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
}, { timestamps: true });

counterSchema.virtual('isTemporarilyDisabled').get(function() {
  return !!(this.disabledUntil && this.disabledUntil > new Date());
});

export default mongoose.model('Counter', counterSchema);
