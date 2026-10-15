import mongoose from 'mongoose';

const scheduleItemSchema = new mongoose.Schema(
  {
    id: {
      type: String,
      required: true,
    },
    title: {
      type: String,
      default: 'Scheduled Maintenance',
      maxlength: 100,
    },
    type: {
      type: String,
      enum: ['daily', 'specific_date'],
      required: true,
      default: 'daily',
    },
    enabled: {
      type: Boolean,
      default: true,
    },
    startTime: {
      type: String,
      required: true,
      default: '00:00', // "HH:mm"
    },
    endTime: {
      type: String,
      required: true,
      default: '06:00', // "HH:mm"
    },
    daysOfWeek: {
      type: [Number], // 0 (Sun) to 6 (Sat)
      default: [0, 1, 2, 3, 4, 5, 6],
    },
    date: {
      type: String, // "YYYY-MM-DD" for specific_date
    },
  },
  { _id: false, timestamps: true }
);

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
    scheduledMaintenance: {
      enabled: {
        type: Boolean,
        default: false,
      },
      schedules: [scheduleItemSchema],
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
