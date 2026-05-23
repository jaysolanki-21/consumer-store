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
      state.pendingCount += 1;
    },
    updateOrder: (state, action) => {
      const index = state.orders.findIndex(o => o._id === action.payload._id);
      if (index !== -1) {
        if (state.orders[index].status === 'Pending' && action.payload.status === 'Confirmed') {
          state.pendingCount -= 1;
        }
        state.orders[index] = action.payload;
      }
    },
    cancelOrder: (state, action) => {
      const index = state.orders.findIndex(o => o._id === action.payload._id);
      if (index !== -1) {
        if (state.orders[index].status === 'Pending' && action.payload.status === 'Cancelled') {
          state.pendingCount--;
        }
        state.orders[index] = action.payload;
      }
    }
  }
});

export const { setOrders, addNewOrder, updateOrder, cancelOrder } = orderSlice.actions;
export default orderSlice.reducer;