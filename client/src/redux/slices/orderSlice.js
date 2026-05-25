import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  orders: [],
  pendingCount: 0
};

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action) => {
      state.orders = action.payload;
      state.pendingCount = action.payload.filter(o => o.status === 'Pending').length;
    },
    
    addNewOrder: (state, action) => {
      state.orders.unshift(action.payload);
      if (action.payload.status === 'Pending') {
        state.pendingCount += 1;
      }
    },
    
    // ✅ CRITICAL FIX: Use Object.assign to preserve object reference
    updateOrder: (state, action) => {
      const { id, changes } = action.payload;
      
      const index = state.orders.findIndex((o) => o._id === id);
      
      if (index !== -1) {
        const oldStatus = state.orders[index].status;
        const newStatus = changes.status;
        
        // Update pending count if status changed
        if (oldStatus === 'Pending' && newStatus !== 'Pending') {
          state.pendingCount -= 1;
        } else if (oldStatus !== 'Pending' && newStatus === 'Pending') {
          state.pendingCount += 1;
        }
        
        // ✅ CRITICAL: Object.assign preserves object reference
        // This prevents Framer Motion from re-animating
        Object.assign(state.orders[index], changes);
      }
    },
    
    cancelOrder: (state, action) => {
      const index = state.orders.findIndex(o => o._id === action.payload._id);
      if (index !== -1) {
        const oldStatus = state.orders[index].status;
        const newStatus = action.payload.status;
        
        if (oldStatus === 'Pending' && newStatus === 'Cancelled') {
          state.pendingCount -= 1;
        }
        
        Object.assign(state.orders[index], { status: newStatus });
      }
    },
    
    updateOrderStatus: (state, action) => {
      const { id, status } = action.payload;
      const index = state.orders.findIndex(o => o._id === id);
      if (index !== -1) {
        const oldStatus = state.orders[index].status;
        
        if (oldStatus === 'Pending' && status !== 'Pending') {
          state.pendingCount -= 1;
        } else if (oldStatus !== 'Pending' && status === 'Pending') {
          state.pendingCount += 1;
        }
        
        Object.assign(state.orders[index], { status });
      }
    },
    
    removeOrder: (state, action) => {
      const orderId = action.payload;
      const index = state.orders.findIndex(o => o._id === orderId);
      if (index !== -1) {
        if (state.orders[index].status === 'Pending') {
          state.pendingCount -= 1;
        }
        state.orders.splice(index, 1);
      }
    },
    
    clearOrders: (state) => {
      state.orders = [];
      state.pendingCount = 0;
    }
  }
});

export const { 
  setOrders, 
  addNewOrder, 
  updateOrder, 
  cancelOrder,
  updateOrderStatus,
  removeOrder,
  clearOrders
} = orderSlice.actions;

export default orderSlice.reducer;