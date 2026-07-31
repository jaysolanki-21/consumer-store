// backend/models/Order.js

import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Confirmed', 'Cancelled'], default: 'Pending' },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date },
  counterId: { 
    type: String, 
    enum: ['counter-1', 'counter-2', 'counter-3', 'counter-4', 'counter-5', 'counter-6', 'counter-7', 'counter-8', 'counter-9', 'counter-10'],
    required: true 
  },
  counterName: { type: String }
}, { timestamps: true });

export default mongoose.model('Order', orderSchema);