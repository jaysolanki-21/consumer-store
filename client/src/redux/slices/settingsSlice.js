import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  maintenanceMode: {
    enabled: false,
    title: 'System Under Maintenance',
    message:
      "We're temporarily performing system maintenance to improve your experience. Please try again after some time.",
    updatedAt: null,
    updatedByName: 'Administrator',
  },
  loading: false,
  error: null,
  lastChecked: null,
};

const settingsSlice = createSlice({
  name: 'settings',
  initialState,
  reducers: {
    setMaintenanceMode: (state, action) => {
      state.maintenanceMode = {
        ...state.maintenanceMode,
        ...action.payload,
      };
      state.lastChecked = new Date().toISOString();
      state.loading = false;
      state.error = null;
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
  setMaintenanceLoading,
  setMaintenanceError,
  updateMaintenanceField,
} = settingsSlice.actions;

export default settingsSlice.reducer;
