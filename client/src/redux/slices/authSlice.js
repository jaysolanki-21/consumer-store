// frontend/src/redux/slices/authSlice.js

import { createSlice } from '@reduxjs/toolkit';

// Load initial state from localStorage/sessionStorage
const loadInitialState = () => {
  // First check localStorage (Remember Me)
  let user = localStorage.getItem('user');
  let token = localStorage.getItem('token');
  let rememberMe = localStorage.getItem('rememberMe') === 'true';
  
  // If not in localStorage, check sessionStorage
  if (!token) {
    user = sessionStorage.getItem('user');
    token = sessionStorage.getItem('token');
    rememberMe = false;
  }
  
  return {
    user: user ? JSON.parse(user) : null,
    token: token || null,
    rememberMe: rememberMe,
  };
};

const initialState = loadInitialState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setCredentials: (state, action) => {
      const { user, token, rememberMe = false } = action.payload;
      
      state.user = user;
      state.token = token;
      state.rememberMe = rememberMe;
      
      // Save based on rememberMe preference
      if (rememberMe) {
        localStorage.setItem('user', JSON.stringify(user));
        localStorage.setItem('token', token);
        localStorage.setItem('rememberMe', 'true');
        // Clear sessionStorage if exists
        sessionStorage.removeItem('user');
        sessionStorage.removeItem('token');
      } else {
        // Use sessionStorage for temporary session
        sessionStorage.setItem('user', JSON.stringify(user));
        sessionStorage.setItem('token', token);
        // Clear localStorage
        localStorage.removeItem('user');
        localStorage.removeItem('token');
        localStorage.removeItem('rememberMe');
      }
    },
    logout: (state) => {
      state.user = null;
      state.token = null;
      state.rememberMe = false;
      
      // Clear both storages
      localStorage.removeItem('user');
      localStorage.removeItem('token');
      localStorage.removeItem('rememberMe');
      sessionStorage.removeItem('user');
      sessionStorage.removeItem('token');
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      if (state.rememberMe) {
        localStorage.setItem('user', JSON.stringify(state.user));
      } else {
        sessionStorage.setItem('user', JSON.stringify(state.user));
      }
    },
  },
});

export const { setCredentials, logout, updateUser } = authSlice.actions;
export default authSlice.reducer;