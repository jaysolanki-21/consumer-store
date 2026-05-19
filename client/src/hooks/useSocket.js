import { useEffect } from 'react';
import socket from '../services/socket';
import { useDispatch } from 'react-redux';
import { addNewOrder, updateOrder } from '../redux/slices/orderSlice';
import { updateProductStock } from '../redux/slices/productSlice';
import toast from 'react-hot-toast';

export const useSocket = () => {
  const dispatch = useDispatch();

  useEffect(() => {
    socket.connect();

    socket.on('newOrder', (order) => {
      dispatch(addNewOrder(order));
      toast.success(`New order from ${order.rollNumber}`);
      // Play sound
      const audio = new Audio('/notification.mp3');
      audio.play().catch(e => console.log('Audio play failed'));
    });

    socket.on('orderConfirmed', (order) => {
      dispatch(updateOrder(order));
      toast.success(`Order ${order._id.slice(-6)} confirmed`);
    });

    socket.on('stockUpdated', (product) => {
      if (product) {
        dispatch(updateProductStock(product));
      } else {
        // Refetch all products
        window.location.reload();
      }
    });

    return () => {
      socket.off('newOrder');
      socket.off('orderConfirmed');
      socket.off('stockUpdated');
    };
  }, [dispatch]);
};