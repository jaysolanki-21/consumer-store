import { useEffect, useState } from 'react';
import api from '../services/api';
import { FiAlertCircle } from 'react-icons/fi';

export default function LowStockAlert() {
  const [lowStockProducts, setLowStockProducts] = useState([]);
  
  useEffect(() => {
    fetchLowStock();
    const interval = setInterval(fetchLowStock, 30000);
    return () => clearInterval(interval);
  }, []);
  
  const fetchLowStock = async () => {
    const { data } = await api.get('/products');
    const low = data.filter(p => p.stock <= p.lowStockThreshold && p.stock > 0);
    setLowStockProducts(low);
  };
  
  if (lowStockProducts.length === 0) return null;
  
  return (
    <div className="bg-red-50 dark:bg-red-900/20 border-l-4 border-red-500 p-4 mb-6 rounded">
      <div className="flex items-center">
        <FiAlertCircle className="text-red-500 mr-2" />
        <span className="font-semibold text-red-700 dark:text-red-400">Low Stock Alert</span>
      </div>
      <div className="mt-2 text-sm text-red-600 dark:text-red-300">
        {lowStockProducts.map(p => (
          <div key={p._id}>{p.name}: Only {p.stock} left</div>
        ))}
      </div>
    </div>
  );
}