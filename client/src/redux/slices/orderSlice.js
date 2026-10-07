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
      if (!order || !order._id) return;
      if (!state.byId[order._id]) {
        state.byId[order._id] = order;
        state.allIds.unshift(order._id);
      } else {
        Object.assign(state.byId[order._id], order);
      }
      state.lastUpdate = Date.now();
    },

    updateOrder: (state, action) => {
      const payload = action.payload;
      if (!payload) return;
      const id = payload.id || payload._id;
      const changes = payload.changes ? payload.changes : payload;

      if (id && state.byId[id]) {
        Object.assign(state.byId[id], changes);
        state.lastUpdate = Date.now();
      }
    },

    cancelOrder: (state, action) => {
      const payload = action.payload;
      if (!payload) return;
      const orderId = payload._id || payload.id || (typeof payload === 'string' ? payload : null);
      if (orderId && state.byId[orderId]) {
        state.byId[orderId].status = payload.status || 'Cancelled';
        if (payload.timeline) {
          state.byId[orderId].timeline = payload.timeline;
        }
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