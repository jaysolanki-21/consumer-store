// backend/models/Order.js

import mongoose from 'mongoose';

const orderSchema = new mongoose.Schema({
  invoiceNumber: { type: String, unique: true, sparse: true },
  billNumber: { type: String, unique: true, sparse: true },
  items: [{
    productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    quantity: { type: Number, required: true },
    // Immutable values used for invoices and historical profit reports.
    price: { type: Number, required: true },
    sellingPrice: { type: Number, required: true, default: 0 },
    costPrice: { type: Number, required: true, default: 0, min: 0 }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['Pending', 'Processing', 'Confirmed', 'Cancelled'], default: 'Pending' },
  confirmedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  confirmedAt: { type: Date },
  counter: { type: mongoose.Schema.Types.ObjectId, ref: 'Counter' },
  counterId: { type: String, trim: true },
  counterName: { type: String, trim: true },
  staffId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  staffName: { type: String },
  payment: {
    method: { type: String, enum: ['Cash', 'UPI', 'Online'], default: 'Cash' },
    receivedAmount: { type: Number, default: 0, min: 0 },
    changeReturned: { type: Number, default: 0, min: 0 },
    transactionId: { type: String, default: '' },
    gatewayOrderId: { type: String, default: '' },
    gatewayPaymentId: { type: String, default: '' },
    paymentSessionId: { type: String, default: '' },
    status: { type: String, enum: ['Pending', 'Paid', 'Failed', 'Refunded'], default: 'Pending' },
    paidAt: { type: Date }
  },
  print: {
    status: { type: String, enum: ['Pending', 'Printed'], default: 'Pending' },
    printedAt: { type: Date }
  },
  timeline: [{
    status: { type: String, required: true },
    message: { type: String, required: true },
    by: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    at: { type: Date, default: Date.now }
  }]
}, {
  timestamps: true,
  toJSON: {
    virtuals: true,
    transform: (doc, ret) => {
      if (ret.counter && typeof ret.counter === 'object' && ret.counter._id) {
        if (!ret.counterName && ret.counter.name) {
          ret.counterName = ret.counter.name;
        }
      } else if (!ret.counter && (ret.counterId || ret.counterName)) {
        ret.counter = {
          _id: ret.counterId || '',
          name: ret.counterName || 'Counter 1'
        };
      } else if (typeof ret.counter === 'string') {
        ret.counter = {
          _id: ret.counter,
          name: ret.counterName || 'Counter 1'
        };
      }
      return ret;
    }
  },
  toObject: {
    virtuals: true,
    transform: (doc, ret) => {
      if (ret.counter && typeof ret.counter === 'object' && ret.counter._id) {
        if (!ret.counterName && ret.counter.name) {
          ret.counterName = ret.counter.name;
        }
      } else if (!ret.counter && (ret.counterId || ret.counterName)) {
        ret.counter = {
          _id: ret.counterId || '',
          name: ret.counterName || 'Counter 1'
        };
      } else if (typeof ret.counter === 'string') {
        ret.counter = {
          _id: ret.counter,
          name: ret.counterName || 'Counter 1'
        };
      }
      return ret;
    }
  }
});

orderSchema.pre('save', function(next) {
  if (!this.invoiceNumber) {
    const stamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
    const suffix = this._id.toString().slice(-6).toUpperCase();
    this.invoiceNumber = `INV-${stamp}-${suffix}`;
    this.billNumber = `BILL-${stamp}-${suffix}`;
  }
  next();
});

orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ counter: 1, createdAt: -1 });
orderSchema.index({ counterId: 1, createdAt: -1 });
orderSchema.index({ staffId: 1, createdAt: -1 });
orderSchema.index({ 'payment.method': 1, createdAt: -1 });
orderSchema.index({ 'payment.gatewayOrderId': 1 }, { sparse: true });

export default mongoose.model('Order', orderSchema);
