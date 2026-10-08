import mongoose from 'mongoose';

const settingSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      required: true,
      unique: true,
      default: 'system_settings',
      index: true,
    },
    maintenanceMode: {
      enabled: {
        type: Boolean,
        default: false,
      },
      title: {
        type: String,
        default: 'System Under Maintenance',
        maxlength: 100,
      },
      message: {
        type: String,
        default:
          "We're temporarily performing system maintenance to improve your experience. Please try again after some time.",
        maxlength: 500,
      },
      updatedAt: {
        type: Date,
        default: Date.now,
      },
      updatedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
      },
      updatedByName: {
        type: String,
        default: 'Administrator',
      },
    },
  },
  { timestamps: true }
);

export default mongoose.model('Setting', settingSchema);
