export const socketHandler = (io) => {
  io.on('connection', (socket) => {
    console.log('✅ Socket connected:', socket.id);
    socket.on('disconnect', () => {
      console.log('❌ Socket disconnected:', socket.id);
    });
  });
};