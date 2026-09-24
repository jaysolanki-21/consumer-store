/**
 * ioInstance.js
 * A simple module-level singleton so the Cashfree webhook handler
 * can access the Socket.IO instance without it being on req.app.
 */

let _io = null;

export const setIO = (io) => {
  _io = io;
};

export const getIO = () => _io;
