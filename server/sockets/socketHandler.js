import User from '../models/User.js';

// Map: userId -> Set of socket.ids
const userSocketsMap = new Map();
// Map: socket.id -> userId
const socketUserMap = new Map();
// Map: userId -> lastHeartbeatTimestamp
const userLastHeartbeat = new Map();

let globalIo = null;

export const disconnectUserBeacon = async (userId) => {
  if (!userId) return;
  const uId = String(userId);
  userSocketsMap.delete(uId);
  userLastHeartbeat.delete(uId);

  for (const [sId, mappedUId] of socketUserMap.entries()) {
    if (mappedUId === uId) {
      socketUserMap.delete(sId);
    }
  }

  try {
    const user = await User.findById(uId);
    if (user && user.isOnline) {
      user.isOnline = false;
      user.lastSeen = new Date();
      if (user.currentSessionStart) {
        const sessionDuration = new Date() - new Date(user.currentSessionStart);
        user.totalWorkingTime = (user.totalWorkingTime || 0) + sessionDuration;
        user.currentSessionStart = null;
      }
      if (user.isOnBreak && user.currentBreakStart) {
        const breakDuration = new Date() - new Date(user.currentBreakStart);
        user.totalBreakTime = (user.totalBreakTime || 0) + breakDuration;
        user.currentBreakStart = null;
        user.isOnBreak = false;
      }
      user.totalActiveTime = Math.max(0, (user.totalWorkingTime || 0) - (user.totalBreakTime || 0));
      await user.save();
      if (globalIo) {
        globalIo.emit('usersUpdated');
        globalIo.emit('countersUpdated');
      }
    }
  } catch (err) {
    console.error('Beacon disconnect error:', err);
  }
};

export const socketHandler = (io) => {
  globalIo = io;

  // Stale session sweeper running every 20 seconds
  setInterval(async () => {
    const now = Date.now();
    try {
      const onlineUsers = await User.find({ isOnline: true });
      let hasChanges = false;

      for (const user of onlineUsers) {
        const uId = String(user._id);
        const sockets = userSocketsMap.get(uId);
        const lastHb = userLastHeartbeat.get(uId) || (user.lastSeen ? new Date(user.lastSeen).getTime() : 0);

        // If no active sockets AND last heartbeat was more than 40 seconds ago
        const isStale = (!sockets || sockets.size === 0) && (now - lastHb > 40000);

        if (isStale) {
          user.isOnline = false;
          user.isOnBreak = false;
          if (user.currentSessionStart) {
            user.totalWorkingTime = (user.totalWorkingTime || 0) + (new Date() - new Date(user.currentSessionStart));
            user.currentSessionStart = null;
          }
          if (user.currentBreakStart) {
            user.totalBreakTime = (user.totalBreakTime || 0) + (new Date() - new Date(user.currentBreakStart));
            user.currentBreakStart = null;
          }
          user.totalActiveTime = Math.max(0, (user.totalWorkingTime || 0) - (user.totalBreakTime || 0));
          await user.save();
          userSocketsMap.delete(uId);
          userLastHeartbeat.delete(uId);
          hasChanges = true;
        }
      }

      if (hasChanges) {
        io.emit('usersUpdated');
        io.emit('countersUpdated');
      }
    } catch (err) {
      console.error('Sweeper error:', err);
    }
  }, 20000);

  io.on('connection', (socket) => {
    // 1. userConnected
    socket.on('userConnected', async (userId) => {
      if (!userId) return;
      const uId = String(userId);
      socketUserMap.set(socket.id, uId);

      if (!userSocketsMap.has(uId)) {
        userSocketsMap.set(uId, new Set());
      }
      userSocketsMap.get(uId).add(socket.id);
      userLastHeartbeat.set(uId, Date.now());

      try {
        const user = await User.findById(uId);
        if (user) {
          // If disabled, force logout immediately
          const isCurrentlyDisabled = !user.isActive || (user.disabledUntil && new Date(user.disabledUntil) > new Date());
          if (isCurrentlyDisabled) {
            socket.emit('userForceLogout', { userId: uId, message: 'Your account is deactivated.' });
            return;
          }

          user.isOnline = true;
          user.lastLogin = new Date();
          user.lastSeen = new Date();
          if (!user.currentSessionStart) {
            user.currentSessionStart = new Date();
          }
          await user.save();
          io.emit('usersUpdated');
          io.emit('countersUpdated');
        }
      } catch (err) {
        console.error('userConnected error:', err);
      }
    });

    // 2. heartbeat (every 20-30s from frontend)
    socket.on('heartbeat', async (userId) => {
      if (!userId) return;
      const uId = String(userId);
      userLastHeartbeat.set(uId, Date.now());
      try {
        await User.findByIdAndUpdate(uId, {
          lastSeen: new Date(),
          isOnline: true
        });
      } catch (err) {}
    });

    // 3. setBreakStatus (Start Break / End Break)
    socket.on('setBreakStatus', async ({ userId, isOnBreak }) => {
      if (!userId) return;
      try {
        const user = await User.findById(userId);
        if (user) {
          if (isOnBreak && !user.isOnBreak) {
            user.isOnBreak = true;
            user.currentBreakStart = new Date();
          } else if (!isOnBreak && user.isOnBreak) {
            user.isOnBreak = false;
            if (user.currentBreakStart) {
              const breakDuration = new Date() - new Date(user.currentBreakStart);
              user.totalBreakTime = (user.totalBreakTime || 0) + breakDuration;
              user.currentBreakStart = null;
            }
          }
          user.lastSeen = new Date();
          user.totalActiveTime = Math.max(0, (user.totalWorkingTime || 0) - (user.totalBreakTime || 0));
          await user.save();
          io.emit('usersUpdated');
          io.emit('countersUpdated');
        }
      } catch (err) {
        console.error('setBreakStatus error:', err);
      }
    });

    // 4. userDisconnected (Manual Logout)
    socket.on('userDisconnected', async (userId) => {
      if (!userId) return;
      const uId = String(userId);
      userSocketsMap.delete(uId);
      userLastHeartbeat.delete(uId);

      for (const [sId, mappedUId] of socketUserMap.entries()) {
        if (mappedUId === uId) {
          socketUserMap.delete(sId);
        }
      }

      try {
        const user = await User.findById(uId);
        if (user) {
          user.isOnline = false;
          user.lastSeen = new Date();
          if (user.currentSessionStart) {
            const sessionDuration = new Date() - new Date(user.currentSessionStart);
            user.totalWorkingTime = (user.totalWorkingTime || 0) + sessionDuration;
            user.currentSessionStart = null;
          }
          if (user.isOnBreak && user.currentBreakStart) {
            const breakDuration = new Date() - new Date(user.currentBreakStart);
            user.totalBreakTime = (user.totalBreakTime || 0) + breakDuration;
            user.currentBreakStart = null;
            user.isOnBreak = false;
          }
          user.totalActiveTime = Math.max(0, (user.totalWorkingTime || 0) - (user.totalBreakTime || 0));
          await user.save();
          io.emit('usersUpdated');
          io.emit('countersUpdated');
        }
      } catch (err) {
        console.error('userDisconnected error:', err);
      }
    });

    // 5. disconnect (Tab/Window close)
    socket.on('disconnect', async () => {
      const uId = socketUserMap.get(socket.id);
      socketUserMap.delete(socket.id);

      if (uId) {
        const sockets = userSocketsMap.get(uId);
        if (sockets) {
          sockets.delete(socket.id);
          // MULTIPLE TABS SUPPORT: If user has other active tabs, DO NOT mark offline!
          if (sockets.size > 0) {
            return;
          }
          userSocketsMap.delete(uId);
        }

        // Grace period (3.5 seconds) in case of rapid page navigation
        setTimeout(async () => {
          const currentSockets = userSocketsMap.get(uId);
          if (currentSockets && currentSockets.size > 0) {
            return; // User has another active connection
          }

          try {
            const user = await User.findById(uId);
            if (user && user.isOnline) {
              user.isOnline = false;
              user.lastSeen = new Date();
              if (user.currentSessionStart) {
                const sessionDuration = new Date() - new Date(user.currentSessionStart);
                user.totalWorkingTime = (user.totalWorkingTime || 0) + sessionDuration;
                user.currentSessionStart = null;
              }
              if (user.isOnBreak && user.currentBreakStart) {
                const breakDuration = new Date() - new Date(user.currentBreakStart);
                user.totalBreakTime = (user.totalBreakTime || 0) + breakDuration;
                user.currentBreakStart = null;
                user.isOnBreak = false;
              }
              user.totalActiveTime = Math.max(0, (user.totalWorkingTime || 0) - (user.totalBreakTime || 0));
              await user.save();
              io.emit('usersUpdated');
              io.emit('countersUpdated');
            }
          } catch (err) {
            console.error('Socket disconnect error:', err);
          }
        }, 3500);
      }
    });
  });
};