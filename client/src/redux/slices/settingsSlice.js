import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  maintenanceMode: {
    enabled: false,
    effectiveEnabled: false,
    title: 'System Under Maintenance',
    message:
      "We're temporarily performing system maintenance to improve your experience. Please try again after some time.",
    updatedAt: null,
    updatedByName: 'Administrator',
  },
  scheduledMaintenance: {
    enabled: false,
    schedules: [],
  },
  isEffectiveActive: false,
  activeReason: 'none',
  activeSchedule: null,
  currentTimeIST: '',
  loading: false,
  error: null,
  lastChecked: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setMaintenanceMode: (state, action) => {
      const payload = action.payload || {};
      if (payload.maintenanceMode) {
        state.maintenanceMode = {
          ...state.maintenanceMode,
          ...payload.maintenanceMode,
        };
      } else if (payload.title || payload.message || typeof payload.enabled === 'boolean') {
        state.maintenanceMode = {
          ...state.maintenanceMode,
          ...payload,
        };
      }

      if (payload.scheduledMaintenance) {
        state.scheduledMaintenance = payload.scheduledMaintenance;
      } else if (payload.schedules) {
        state.scheduledMaintenance = {
          ...state.scheduledMaintenance,
          schedules: payload.schedules,
        };
      }

      const effective = Boolean(
        payload.isEffectiveActive ??
        payload.effectiveEnabled ??
        payload.maintenanceMode?.effectiveEnabled ??
        payload.maintenanceMode?.isEffectiveActive ??
        state.maintenanceMode.enabled
      );

      state.isEffectiveActive = effective;
      state.activeReason = payload.activeReason || (state.maintenanceMode.enabled ? 'manual' : (effective ? 'scheduled' : 'none'));
      state.activeSchedule = payload.activeSchedule || null;

      if (payload.currentTimeIST) {
        state.currentTimeIST = payload.currentTimeIST;
      }
      state.lastChecked = new Date().toISOString();
      state.loading = false;
      state.error = null;
    },
    setScheduledMaintenance: (state, action) => {
      state.scheduledMaintenance = {
        ...state.scheduledMaintenance,
        ...action.payload,
      };
    },
    setMaintenanceLoading: (state, action) => {
      state.loading = action.payload;
    },
    setMaintenanceError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    updateMaintenanceField: (state, action) => {
      const { field, value } = action.payload;
      state.maintenanceMode[field] = value;
    },
  },
});

export const {
  setMaintenanceMode,
  setScheduledMaintenance,
  setMaintenanceLoading,
  setMaintenanceError,
  updateMaintenanceField,
} = settingsSlice.actions;

export default settingsSlice.reducer;
