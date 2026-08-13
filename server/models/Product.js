import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  costPrice: { type: Number, default: 0, min: 0 },
  sellingPrice: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  stock: { type: Number, required: true, min: 0 },
  reservedStock: { type: Number, default: 0, min: 0 }, 
  image: { type: String }, // ImageKit URL
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  lowStockThreshold: { type: Number, default: 5 },
  visibility: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

// Auto-update isAvailable based on stock
productSchema.pre('save', function() {
  if (this.sellingPrice === undefined || this.sellingPrice === null) {
    this.sellingPrice = this.price;
  }
  this.price = this.sellingPrice;
  if (this.sellingPrice < this.costPrice) {
    throw new Error('Selling price cannot be lower than buying price.');
  }
  this.reservedStock = Math.max(0, this.reservedStock || 0);
  this.isAvailable = this.stock > 0;
});

productSchema.index({ categoryId: 1, visibility: 1, isAvailable: 1 });

export default mongoose.model('Product', productSchema);
