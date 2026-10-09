import axios from 'axios';
import socket from './socket';

const API_URL = import.meta.env.VITE_API_URL || '/api';

// Helper to get or generate persistent session ID per tab/session
const getSessionId = () => {
  if (typeof window === 'undefined') return '';
  let sId = sessionStorage.getItem('pos_session_id');
  if (!sId) {
    sId = 'SES-' + Date.now().toString(36) + '-' + Math.random().toString(36).substring(2, 7).toUpperCase();
    sessionStorage.setItem('pos_session_id', sId);
  }
  return sId;
};

// Helper to determine device type
const getDeviceType = () => {
  if (typeof window === 'undefined') return 'desktop';
  const width = window.innerWidth;
  const ua = navigator.userAgent || '';
  if (/tablet|ipad/i.test(ua) || (width >= 640 && width <= 1024)) return 'tablet';
  if (/mobile|android|iphone/i.test(ua) || width < 640) return 'mobile';
  return 'desktop';
};

// Helper to get/generate device name
const getDeviceName = () => {
  if (typeof window === 'undefined') return 'Desktop PC';
  let devName = localStorage.getItem('pos_device_name');
  if (!devName) {
    const isWindows = /windows/i.test(navigator.userAgent);
    const isMac = /mac/i.test(navigator.userAgent);
    const prefix = isWindows ? 'DESKTOP-APC' : isMac ? 'MAC-APC' : 'POS-NODE';
    devName = `${prefix}-${Math.floor(10 + Math.random() * 90)}`;
    localStorage.setItem('pos_device_name', devName);
  }
  return devName;
};

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

api.interceptors.request.use(
  (config) => {
    const isConsumer =
      typeof window !== 'undefined' &&
      (window.location.pathname.startsWith('/consumer') || window.location.pathname === '/');
    const token = isConsumer
      ? localStorage.getItem('counterToken') || localStorage.getItem('token')
      : localStorage.getItem('token') || localStorage.getItem('counterToken');

    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    // Attach client session and device metadata headers
    config.headers['X-Session-Id'] = getSessionId();
    config.headers['X-Device-Type'] = getDeviceType();
    config.headers['X-Device-Name'] = getDeviceName();

    return config;
  },
  (error) => Promise.reject(error)
);

api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      const userStr = localStorage.getItem('user');
      if (userStr) {
        try {
          const user = JSON.parse(userStr);
          if (user && user._id) {
            socket.emit('userDisconnected', user._id);
          }
        } catch (e) {}
      }
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

export default api;