import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  items: [],
  rollNumber: '',
  customerName: '',
  room: ''
};

const cartSlice = createSlice({
  name: 'cart',
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const { product, quantity } = action.payload;
      const existing = state.items.find(i => i.productId === product._id);
      if (existing) {
        existing.quantity += quantity;
      } else {
        state.items.push({
          productId: product._id,
          name: product.name,
          price: product.price,
          quantity,
          stock: product.stock,
          image: product.image
        });
      }
    },
    removeFromCart: (state, action) => {
      state.items = state.items.filter(i => i.productId !== action.payload);
    },
    updateQuantity: (state, action) => {
      const { productId, quantity } = action.payload;
      const item = state.items.find(i => i.productId === productId);
      if (item) item.quantity = Math.min(quantity, item.stock);
    },
    clearCart: (state) => {
      state.items = [];
    },
    setCustomerInfo: (state, action) => {
      state.rollNumber = action.payload.rollNumber;
      state.customerName = action.payload.name;
      state.room = action.payload.room;
    }
  }
});

export const { addToCart, removeFromCart, updateQuantity, clearCart, setCustomerInfo } = cartSlice.actions;
export default cartSlice.reducer;