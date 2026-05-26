import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  byId: {},
  allIds: [],
  loading: true,
  lastUpdate: null,
};

const orderSlice = createSlice({
  name: 'orders',
  initialState,
  reducers: {
    setOrders: (state, action) => {
      state.byId = {};
      state.allIds = [];

      action.payload.forEach(order => {
        state.byId[order._id] = order;
        state.allIds.push(order._id);
      });

      state.loading = false;
      state.lastUpdate = Date.now();
    },

    addNewOrder: (state, action) => {
      const order = action.payload;
      if (!state.byId[order._id]) {
        state.byId[order._id] = order;
        state.allIds.unshift(order._id);
        state.lastUpdate = Date.now();
      }
    },

    updateOrder: (state, action) => {
      const { id, changes } = action.payload;

      if (state.byId[id]) {
        Object.assign(state.byId[id], changes);
        state.lastUpdate = Date.now();
      }
    },

    cancelOrder: (state, action) => {
      const orderId = action.payload._id;
      if (state.byId[orderId]) {
        Object.assign(state.byId[orderId], { status: action.payload.status });
        state.lastUpdate = Date.now();
      }
    },

    updateOrderStatus: (state, action) => {
      const { id, status } = action.payload;
      if (state.byId[id]) {
        Object.assign(state.byId[id], { status });
        state.lastUpdate = Date.now();
      }
    },

    removeOrder: (state, action) => {
      const orderId = action.payload;
      if (state.byId[orderId]) {
        delete state.byId[orderId];
        state.allIds = state.allIds.filter(id => id !== orderId);
        state.lastUpdate = Date.now();
      }
    },

    clearOrders: (state) => {
      state.byId = {};
      state.allIds = [];
      state.loading = false;
      state.lastUpdate = Date.now();
    },

    setLoading: (state, action) => {
      state.loading = action.payload;
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
  clearOrders,
  setLoading
} = orderSlice.actions;

export default orderSlice.reducer;