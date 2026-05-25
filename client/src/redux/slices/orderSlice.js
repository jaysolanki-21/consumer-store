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
    
    // ✅ Updated to match the StaffPage implementation
    updateOrder: (state, action) => {
      // Support both formats: { id, changes } OR { _id, status, ... }
      let orderId, updatedOrder;
      
      if (action.payload.id && action.payload.changes) {
        // Format: { id, changes }
        orderId = action.payload.id;
        const index = state.orders.findIndex(o => o._id === orderId);
        if (index !== -1) {
          const oldStatus = state.orders[index].status;
          const newStatus = action.payload.changes.status;
          
          // Update pending count if status changed
          if (oldStatus === 'Pending' && newStatus !== 'Pending') {
            state.pendingCount -= 1;
          } else if (oldStatus !== 'Pending' && newStatus === 'Pending') {
            state.pendingCount += 1;
          }
          
          // Merge changes
          state.orders[index] = { ...state.orders[index], ...action.payload.changes };
        }
      } else {
        // Format: full order object { _id, status, ... }
        orderId = action.payload._id;
        const index = state.orders.findIndex(o => o._id === orderId);
        if (index !== -1) {
          const oldStatus = state.orders[index].status;
          const newStatus = action.payload.status;
          
          // Update pending count if status changed
          if (oldStatus === 'Pending' && newStatus !== 'Pending') {
            state.pendingCount -= 1;
          } else if (oldStatus !== 'Pending' && newStatus === 'Pending') {
            state.pendingCount += 1;
          }
          
          state.orders[index] = action.payload;
        }
      }
    },
    
    cancelOrder: (state, action) => {
      const index = state.orders.findIndex(o => o._id === action.payload._id);
      if (index !== -1) {
        const oldStatus = state.orders[index].status;
        const newStatus = action.payload.status;
        
        // Update pending count if status changed
        if (oldStatus === 'Pending' && newStatus === 'Cancelled') {
          state.pendingCount -= 1;
        }
        
        state.orders[index] = action.payload;
      }
    },
    
    // ✅ Helper action to update only status (more efficient)
    updateOrderStatus: (state, action) => {
      const { id, status } = action.payload;
      const index = state.orders.findIndex(o => o._id === id);
      if (index !== -1) {
        const oldStatus = state.orders[index].status;
        
        // Update pending count
        if (oldStatus === 'Pending' && status !== 'Pending') {
          state.pendingCount -= 1;
        } else if (oldStatus !== 'Pending' && status === 'Pending') {
          state.pendingCount += 1;
        }
        
        state.orders[index].status = status;
      }
    },
    
    // ✅ Remove order (if needed)
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
    
    // ✅ Clear all orders (for logout, etc.)
    clearOrders: (state) => {
      state.orders = [];
      state.pendingCount = 0;
    }
  }
});

// Export all actions
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