import { createSelector } from 'reselect';

const selectOrderState = (state) => state.orders;
const selectById = (state) => state.orders.byId;
const selectAllIds = (state) => state.orders.allIds;
const selectLoading = (state) => state.orders.loading;
const selectLastUpdate = (state) => state.orders.lastUpdate;

export const selectAllOrders = createSelector(
  [selectById, selectAllIds],
  (byId, allIds) => allIds.map(id => byId[id])
);

export const selectOrderById = (orderId) =>
  createSelector([selectById], (byId) => byId[orderId]);

export const selectPendingOrders = createSelector(
  [selectAllOrders],
  (orders) => orders.filter(o => o.status === 'Pending')
);

export const selectConfirmedOrders = createSelector(
  [selectAllOrders],
  (orders) => orders.filter(o => o.status === 'Confirmed')
);

export const selectPendingCount = createSelector(
  [selectPendingOrders],
  (orders) => orders.length
);

export const selectConfirmedCount = createSelector(
  [selectConfirmedOrders],
  (orders) => orders.length
);

export const selectTotalRevenue = createSelector(
  [selectConfirmedOrders],
  (orders) => orders.reduce((sum, o) => sum + o.totalAmount, 0)
);

export const selectFilteredOrdersByDate = (filterDate) =>
  createSelector([selectAllOrders], (orders) => {
    // ✅ API now filters by date, but keep this for safety
    return orders.filter((order) => {
      const d = new Date(order.createdAt);
      const orderDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(
        2,
        '0'
      )}-${String(d.getDate()).padStart(2, '0')}`;
      return orderDate === filterDate;
    });
  });

export const selectFilteredOrdersBySearch = (filterDate, searchQuery) =>
  createSelector([selectFilteredOrdersByDate(filterDate)], (orders) => {
    if (!searchQuery) return orders;
    const q = searchQuery.toLowerCase();
    return orders.filter(
      (o) =>
        o.rollNumber.toLowerCase().includes(q) ||
        o._id.toLowerCase().includes(q)
    );
  });

export const selectLoadingState = createSelector(
  [selectLoading],
  (loading) => loading
);

export const selectLastUpdateTime = createSelector(
  [selectLastUpdate],
  (lastUpdate) => lastUpdate
);
