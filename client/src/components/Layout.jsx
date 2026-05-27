import { Link, useLocation, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { logout } from "../redux/slices/authSlice";
import { useTheme } from "../hooks/useTheme";
import { useEffect, useState, useCallback } from "react";
import api from "../services/api";
import socket from "../services/socket";

import {
  FiSun,
  FiMoon,
  FiLogOut,
  FiBell,
  FiGrid,
  FiBox,
  FiLayers,
  FiDatabase,
  FiShoppingBag,
  FiUsers,
  FiBarChart2,
  FiFileText,
} from "react-icons/fi";

export default function Layout({ children }) {
  const { user } = useSelector((state) => state.auth);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  // REALTIME COUNTERS
  const [pendingOrdersCount, setPendingOrdersCount] = useState(0);
  const [lowStockCount, setLowStockCount] = useState(0);

  // =========================
  // FETCH PENDING ORDERS
  // =========================
  const fetchPendingOrders = useCallback(async () => {
    try {
      const { data } = await api.get("/orders");

      const pending = data.filter(
        (o) => o.status?.toLowerCase() === "pending"
      ).length;

      setPendingOrdersCount(pending);
    } catch (err) {
      console.error("Failed to fetch pending orders", err);
    }
  }, []);

  // =========================
  // FETCH LOW STOCK ALERTS
  // =========================
  const fetchLowStockAlerts = useCallback(async () => {
    try {
      const { data } = await api.get("/products");

      const low = data.filter(
        (p) =>
          p.visibility !== false &&
          p.stock > 0 &&
          p.stock <= p.lowStockThreshold
      ).length;

      const out = data.filter(
        (p) =>
          p.visibility !== false &&
          p.stock <= 0
      ).length;

      setLowStockCount(low + out);
    } catch (err) {
      console.error("Failed to fetch low stock alerts", err);
    }
  }, []);

  // =========================
  // SOCKET REALTIME LISTENERS
  // =========================
  useEffect(() => {
    if (!user) return;

    // -------------------------
    // STAFF REALTIME
    // -------------------------
    const handlePendingOrders = () => {
      fetchPendingOrders();
    };

    // -------------------------
    // ADMIN REALTIME
    // -------------------------
    const handleStockUpdate = () => {
      fetchLowStockAlerts();
    };

    // INITIAL FETCH
    if (user.role === "staff") {
      fetchPendingOrders();

      socket.on("newOrder", handlePendingOrders);
      socket.on("orderConfirmed", handlePendingOrders);
      socket.on("orderCancelled", handlePendingOrders);
    }

    if (user.role === "admin") {
      fetchLowStockAlerts();

      socket.on("stockUpdated", handleStockUpdate);

      // OPTIONAL EXTRA SAFETY
      socket.on("newOrder", handleStockUpdate);
      socket.on("orderConfirmed", handleStockUpdate);
      socket.on("orderCancelled", handleStockUpdate);
      socket.on("stockRefilled", handleStockUpdate);
      socket.on("productUpdated", handleStockUpdate);
    }

    // CLEANUP
    return () => {
      socket.off("newOrder", handlePendingOrders);
      socket.off("orderConfirmed", handlePendingOrders);
      socket.off("orderCancelled", handlePendingOrders);

      socket.off("stockUpdated", handleStockUpdate);
      socket.off("stockRefilled", handleStockUpdate);
      socket.off("productUpdated", handleStockUpdate);
    };
  }, [user, fetchPendingOrders, fetchLowStockAlerts]);

  // =========================
  // LOGOUT
  // =========================
  const handleLogout = () => {
    dispatch(logout());
    navigate("/login");
  };

  // =========================
  // BELL CLICK
  // =========================
  const handleBellClick = () => {
    if (user?.role === "admin") {
      navigate("/admin/alerts");
    } else if (user?.role === "staff") {
      navigate("/staff");
    }
  };

  // =========================
  // ACTIVE NAV
  // =========================
  const isActive = (path) => location.pathname === path;

  const navClass = (path) =>
    `relative flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
      isActive(path)
        ? "bg-indigo-600 text-white shadow-sm"
        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
    }`;

  // =========================
  // ALERT COUNTS
  // =========================
  const totalAlerts =
    user?.role === "admin"
      ? lowStockCount
      : user?.role === "staff"
      ? pendingOrdersCount
      : 0;

  const isAlertsActive = location.pathname === "/admin/alerts";

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* NAVBAR */}
      <nav className="sticky top-0 z-50 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
        <div className="max-w-[1600px] mx-auto px-4 lg:px-8">
          <div className="h-16 flex items-center justify-between gap-4">

            {/* LEFT */}
            <div className="flex items-center gap-6 overflow-x-auto">

              {/* LOGO */}
              <Link to="/" className="flex items-center gap-2 flex-shrink-0">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
                  <FiShoppingBag className="text-white text-sm" />
                </div>

                <div className="leading-tight hidden sm:block">
                  <h1 className="text-base font-semibold text-slate-900 dark:text-white">
                    APC Store
                  </h1>
                </div>
              </Link>

              {/* ADMIN NAV */}
              {user?.role === "admin" && (
                <div className="flex items-center gap-1 overflow-x-auto">

                  <Link to="/admin" className={navClass("/admin")}>
                    <FiGrid className="text-sm" />
                    Dashboard
                  </Link>

                  <Link
                    to="/admin/products"
                    className={navClass("/admin/products")}
                  >
                    <FiBox className="text-sm" />
                    Products
                  </Link>

                  <Link
                    to="/admin/categories"
                    className={navClass("/admin/categories")}
                  >
                    <FiLayers className="text-sm" />
                    Categories
                  </Link>

                  <Link
                    to="/admin/stock-refill"
                    className={navClass("/admin/stock-refill")}
                  >
                    <FiDatabase className="text-sm" />
                    Stock
                  </Link>

                  <Link
                    to="/admin/sales-report"
                    className={navClass("/admin/sales-report")}
                  >
                    <FiFileText className="text-sm" />
                    Report
                  </Link>

                  <Link
                    to="/admin/orders"
                    className={navClass("/admin/orders")}
                  >
                    <FiShoppingBag className="text-sm" />
                    Orders
                  </Link>

                  <Link
                    to="/admin/staff"
                    className={navClass("/admin/staff")}
                  >
                    <FiUsers className="text-sm" />
                    Staff
                  </Link>

                  <Link
                    to="/admin/insights"
                    className={navClass("/admin/insights")}
                  >
                    <FiBarChart2 className="text-sm" />
                    Insights
                  </Link>
                </div>
              )}
            </div>

            {/* RIGHT */}
            <div className="flex items-center gap-2 flex-shrink-0">

              {/* ALERT BELL */}
              <button
                onClick={handleBellClick}
                className={`relative w-10 h-10 rounded-lg border flex items-center justify-center transition-all duration-200 ${
                  isAlertsActive
                    ? "bg-blue-500 border-blue-500 text-white shadow-md"
                    : "bg-white dark:bg-slate-900 border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800"
                }`}
              >
                <FiBell className="text-base" />

                {totalAlerts > 0 && (
                  <>
                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping"></span>

                    <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500"></span>

                    <span
                      className={`absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                        isAlertsActive
                          ? "bg-red-600"
                          : "bg-red-500"
                      }`}
                    >
                      {totalAlerts > 99 ? "99+" : totalAlerts}
                    </span>
                  </>
                )}
              </button>

              {/* THEME */}
              <button
                onClick={toggleTheme}
                className="w-10 h-10 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800 transition"
              >
                {theme === "dark" ? (
                  <FiSun className="text-yellow-500 text-base" />
                ) : (
                  <FiMoon className="text-slate-600 text-base" />
                )}
              </button>

              {/* USER */}
              <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-medium">
                  {user?.name?.charAt(0)?.toUpperCase() || "A"}
                </div>

                <div className="leading-tight">
                  <p className="text-sm font-medium text-slate-800 dark:text-white">
                    {user?.name}
                  </p>

                  <p className="text-[10px] uppercase tracking-wide text-slate-400 font-medium">
                    {user?.role}
                  </p>
                </div>
              </div>

              {/* LOGOUT */}
              <button
                onClick={handleLogout}
                className="w-10 h-10 rounded-lg bg-red-500 hover:bg-red-600 text-white flex items-center justify-center shadow-sm transition hover:scale-105"
              >
                <FiLogOut className="text-sm" />
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* MAIN */}
      <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
        {children}
      </main>
    </div>
  );
}