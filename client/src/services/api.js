import axios from 'axios';
import socket from './socket';

const API_URL = import.meta.env.VITE_API_URL || '/api';

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true 
});

api.interceptors.request.use(
  (config) => {
    const isConsumer = typeof window !== 'undefined' && (window.location.pathname.startsWith('/consumer') || window.location.pathname === '/');
    const token = isConsumer
      ? (localStorage.getItem('counterToken') || localStorage.getItem('token'))
      : (localStorage.getItem('token') || localStorage.getItem('counterToken'));
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
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