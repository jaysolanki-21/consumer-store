import { useEffect, useRef } from 'react';
import socket from '../services/socket';
import { useDispatch } from 'react-redux';
import { addNewOrder, updateOrder } from '../redux/slices/orderSlice';
import { updateProductStock } from '../redux/slices/productSlice';
import toast from 'react-hot-toast';

let isSocketInitialized = false;

function formatTime(date) {
  return new Date(date).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function normalizeOrder(order) {
  return {
    ...order,
    formattedTime: formatTime(order.createdAt),
  };
}

export const useSocket = () => {
  const dispatch = useDispatch();
  const isMountedRef = useRef(true);
  const processedEventsRef = useRef(new Set());

  const deduplicateEvent = (eventKey) => {
    if (processedEventsRef.current.has(eventKey)) return false;
    processedEventsRef.current.add(eventKey);
    setTimeout(() => processedEventsRef.current.delete(eventKey), 3000);
    return true;
  };

  useEffect(() => {
    // ✅ Only initialize once to prevent duplicate listeners in StrictMode
    if (isSocketInitialized) return;
    isSocketInitialized = true;

    socket.connect();

    const handleNewOrder = (order) => {
      const eventKey = `new-${order._id}`;
      if (!deduplicateEvent(eventKey) || !isMountedRef.current) return;

      const normalizedOrder = normalizeOrder(order);
      dispatch(addNewOrder(normalizedOrder));
      toast.success(`🛒 New order from ${order.rollNumber}`);
      const audio = new Audio('/sounds/notification-bell.mp3');
      audio.play().catch(() => {});
    };

    const handleOrderConfirmed = (order) => {
      const eventKey = `confirm-${order._id}`;
      if (!deduplicateEvent(eventKey) || !isMountedRef.current) return;

      dispatch(updateOrder({ id: order._id, changes: { status: 'Confirmed' } }));
      toast.success(`✅ Order ${order._id.slice(-6)} confirmed`);
    };

    const handleStockUpdated = (product) => {
      if (!isMountedRef.current) return;
      if (product) {
        dispatch(updateProductStock(product));
      } else {
        window.location.reload();
      }
    };

    socket.on('newOrder', handleNewOrder);
    socket.on('orderConfirmed', handleOrderConfirmed);
    socket.on('stockUpdated', handleStockUpdated);

    return () => {
      isMountedRef.current = false;
      socket.off('newOrder', handleNewOrder);
      socket.off('orderConfirmed', handleOrderConfirmed);
      socket.off('stockUpdated', handleStockUpdated);
    };
  }, [dispatch]);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);
};