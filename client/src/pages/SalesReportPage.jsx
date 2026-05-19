import { useState, useEffect } from "react";
import api from "../services/api";
import socket from "../services/socket"; // 👈 import socket
import toast from "react-hot-toast";
import {
  FiCalendar,
  FiDollarSign,
  FiShoppingBag,
  FiPackage,
  FiUserCheck,
  FiClock,
  FiChevronLeft,
  FiChevronRight,
} from "react-icons/fi";
import { FaRupeeSign } from "react-icons/fa";

export default function SalesReportPage() {
  // Get today's date in Indian Standard Time (IST) as YYYY-MM-DD
  const getTodayIST = () => {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Kolkata",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    return formatter.format(new Date());
  };

  const [selectedDate, setSelectedDate] = useState(getTodayIST());
  const [salesData, setSalesData] = useState({
    date: "",
    totalOrders: 0,
    totalIncome: 0,
    productWise: [],
  });
  const [confirmedOrders, setConfirmedOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [loadingOrders, setLoadingOrders] = useState(false);

  // Fetch data when selectedDate changes
  useEffect(() => {
    fetchSalesReport();
    fetchConfirmedOrders();
  }, [selectedDate]);

  // Real‑time socket listeners
  useEffect(() => {
    const handleOrderChange = () => {
      fetchSalesReport();
      fetchConfirmedOrders();
    };

    socket.on("orderConfirmed", handleOrderChange);
    socket.on("orderCancelled", handleOrderChange);
    // Also listen for new orders (though they start as pending, but if later confirmed, it's covered above)
    socket.on("newOrder", handleOrderChange);

    return () => {
      socket.off("orderConfirmed", handleOrderChange);
      socket.off("orderCancelled", handleOrderChange);
      socket.off("newOrder", handleOrderChange);
    };
  }, [selectedDate]); // re‑attach when selectedDate changes (though not strictly needed, but safe)

  const fetchSalesReport = async () => {
    setLoading(true);
    try {
      const { data } = await api.get(
        `/orders/sales-report?date=${selectedDate}`,
      );
      setSalesData(data);
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to load sales report");
      setSalesData({
        date: selectedDate,
        totalOrders: 0,
        totalIncome: 0,
        productWise: [],
      });
    } finally {
      setLoading(false);
    }
  };

  const fetchConfirmedOrders = async () => {
    setLoadingOrders(true);
    try {
      const { data } = await api.get("/orders");
      // Filter: status Confirmed and date matches selectedDate (using IST day boundaries)
      const startDate = new Date(`${selectedDate}T00:00:00.000+05:30`);
      const endDate = new Date(`${selectedDate}T23:59:59.999+05:30`);
      const filtered = data.filter(
        (order) =>
          order.status === "Confirmed" &&
          new Date(order.createdAt) >= startDate &&
          new Date(order.createdAt) <= endDate,
      );
      setConfirmedOrders(filtered);
    } catch (err) {
      toast.error("Failed to load confirmed orders");
    } finally {
      setLoadingOrders(false);
    }
  };

  // Helper: add/subtract days from a date string (YYYY-MM-DD)
  const addDays = (dateStr, days) => {
    const date = new Date(dateStr);
    date.setDate(date.getDate() + days);
    return date.toISOString().split("T")[0];
  };

  const handlePrevDay = () => {
    const newDate = addDays(selectedDate, -1);
    setSelectedDate(newDate);
  };

  const handleNextDay = () => {
    const todayIST = getTodayIST();
    const newDate = addDays(selectedDate, 1);
    if (newDate <= todayIST) {
      setSelectedDate(newDate);
    } else {
      toast.error("Cannot go beyond today");
    }
  };

  const handleDateChange = (e) => {
    const newDate = e.target.value;
    const todayIST = getTodayIST();
    if (newDate > todayIST) {
      toast.error("Cannot select a future date (IST)");
      return;
    }
    setSelectedDate(newDate);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const [year, month, day] = dateStr.split("-");
    const date = new Date(Date.UTC(year, month - 1, day));
    return date.toLocaleDateString("en-IN", {
      timeZone: "Asia/Kolkata",
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold">Sales Report</h1>
        <div className="flex items-center gap-2 bg-white dark:bg-gray-800 rounded-lg px-3 py-2 shadow-sm">
          <button
            onClick={handlePrevDay}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            title="Previous day"
          >
            <FiChevronLeft className="text-indigo-500" />
          </button>
          <FiCalendar className="text-indigo-500" />
          <input
            type="date"
            value={selectedDate}
            onChange={handleDateChange}
            max={getTodayIST()}
            className="bg-transparent outline-none"
          />
          <button
            onClick={handleNextDay}
            className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded transition"
            title="Next day"
          >
            <FiChevronRight className="text-indigo-500" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-8">
            {/* Report Date Card */}
            <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-indigo-100 text-sm font-medium">
                    Report Date
                  </p>
                  <p className="text-lg font-semibold mt-1">
                    {formatDate(selectedDate)}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiCalendar className="text-2xl text-white" />
                </div>
              </div>
            
            </div>

            {/* Total Income Card */}
            <div className="bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-emerald-100 text-sm font-medium">
                    Total Income
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    ₹{(salesData.totalIncome || 0).toLocaleString()}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FaRupeeSign className="text-2xl text-white" />
                </div>
              </div>
            
            </div>

            {/* Total Orders Card */}
            <div className="bg-gradient-to-br from-purple-600 to-indigo-600 rounded-xl p-5 text-white shadow-lg hover:-translate-y-1 transition-all duration-300 cursor-pointer">
              <div className="flex justify-between items-start">
                <div>
                  <p className="text-purple-100 text-sm font-medium">
                    Total Orders (Confirmed)
                  </p>
                  <p className="text-2xl font-bold mt-1">
                    {salesData.totalOrders || 0}
                  </p>
                </div>
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center">
                  <FiShoppingBag className="text-2xl text-white" />
                </div>
              </div>
              
            </div>
          </div>

          {/* Product-wise Sales Table */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiPackage /> Product-wise Sales
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                      Product
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                      Quantity Sold
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                      Revenue
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {!salesData.productWise ||
                  salesData.productWise.length === 0 ? (
                    <tr>
                      <td
                        colSpan="3"
                        className="px-6 py-8 text-center text-gray-500"
                      >
                        No sales for this date.
                      </td>
                    </tr>
                  ) : (
                    salesData.productWise.map((item) => (
                      <tr key={item.productId}>
                        <td className="px-6 py-4 font-medium">{item.name}</td>
                        <td className="px-6 py-4">{item.quantity}</td>
                        <td className="px-6 py-4 font-semibold text-green-600">
                          ₹{item.revenue.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Confirmed Orders with "Approved By" */}
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-200 dark:border-gray-700">
              <h2 className="text-lg font-semibold flex items-center gap-2">
                <FiUserCheck /> Confirmed Orders – Approved By
              </h2>
            </div>
            {loadingOrders ? (
              <div className="flex justify-center items-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-gray-700">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                        Order ID
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                        Time
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                        Roll Number
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                        Total Amount
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium uppercase">
                        Approved By
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                    {confirmedOrders.length === 0 ? (
                      <tr>
                        <td
                          colSpan="5"
                          className="px-6 py-8 text-center text-gray-500"
                        >
                          No confirmed orders for this date.
                        </td>
                      </tr>
                    ) : (
                      confirmedOrders.map((order) => (
                        <tr key={order._id}>
                          <td className="px-6 py-4 font-mono text-sm">
                            #{order._id.slice(-8)}
                          </td>
                          <td className="px-6 py-4 text-sm">
                            {new Date(order.createdAt).toLocaleString()}
                          </td>
                          <td className="px-6 py-4">{order.rollNumber}</td>
                          <td className="px-6 py-4 font-semibold">
                            ₹{order.totalAmount}
                          </td>
                          <td className="px-6 py-4">
                            <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                              <FiUserCheck size={12} />{" "}
                              {order.confirmedBy?.name || "System"}
                            </span>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
