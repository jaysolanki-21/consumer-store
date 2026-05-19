import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true },
  price: { type: Number, required: true },
  stock: { type: Number, required: true, min: 0 },
  reservedStock: { type: Number, default: 0 }, 
  image: { type: String }, // ImageKit URL
  categoryId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', required: true },
  lowStockThreshold: { type: Number, default: 5 },
  visibility: { type: Boolean, default: true },
  isAvailable: { type: Boolean, default: true }
}, { timestamps: true });

// Auto-update isAvailable based on stock
productSchema.pre('save', function() {
  this.isAvailable = this.stock > 0;
});

export default mongoose.model('Product', productSchema);