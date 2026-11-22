import { io } from 'socket.io-client';

const deriveSocketUrl = () => {
  if (import.meta.env.VITE_SOCKET_URL) {
    return import.meta.env.VITE_SOCKET_URL.trim().replace(/\/+$/, '');
  }
  if (import.meta.env.VITE_API_URL) {
    // If VITE_API_URL is e.g. https://consumer-store-backend.onrender.com/api, derive base URL
    return import.meta.env.VITE_API_URL.trim().replace(/\/+$/, '').replace(/\/api$/, '');
  }
  if (typeof window !== 'undefined' && window.location.hostname !== 'localhost' && window.location.hostname !== '127.0.0.1') {
    return window.location.origin;
  }
  return 'http://localhost:5000';
};

const SOCKET_URL = deriveSocketUrl();

const socket = io(SOCKET_URL, {
  transports: ['websocket', 'polling'],
  withCredentials: true,
  reconnectionAttempts: 5
});

export default socket;
