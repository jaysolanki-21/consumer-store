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
  FiChevronLeft,
  FiChevronRight,
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
        (o) => o.status?.toLowerCase() === "pending",
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
          p.stock <= p.lowStockThreshold,
      ).length;

      const out = data.filter(
        (p) => p.visibility !== false && p.stock <= 0,
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
  const isActive = (path) => {
    if (path === "/admin") {
      return location.pathname === "/admin";
    }
    return location.pathname === path;
  };

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

  // =========================
  // ADMIN NAV ITEMS
  // =========================
  const adminNavItems = [
    { path: "/admin", label: "Dashboard", icon: FiGrid },
    { path: "/admin/products", label: "Products", icon: FiBox },
    { path: "/admin/categories", label: "Categories", icon: FiLayers },
    { path: "/admin/stock-refill", label: "Stock", icon: FiDatabase },
    { path: "/admin/sales-report", label: "Report", icon: FiFileText },
    { path: "/admin/orders", label: "Orders", icon: FiShoppingBag },
    { path: "/admin/staff", label: "Staff", icon: FiUsers },
    { path: "/admin/counters", label: "Counters", icon: FiGrid },
    { path: "/admin/insights", label: "Insights", icon: FiBarChart2 },
  ];

  // =========================
  // MOBILE SIDEBAR
  // =========================
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

  useEffect(() => {
    setMobileSidebarOpen(false);
  }, [location.pathname]);

  // =========================
  // ADMIN SIDEBAR
  // =========================
  const AdminSidebar = () => (
    <>
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 z-50 h-screen
          bg-white dark:bg-slate-950
          border-r border-slate-200 dark:border-slate-800
          shadow-xl
          transition-transform duration-300
          lg:translate-x-0
          ${mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"}
          ${sidebarCollapsed ? "lg:w-20" : "lg:w-64"}
        `}
      >
        {/* SIDEBAR HEADER */}
        <div className="h-16 px-4 flex items-center justify-between border-b border-slate-200 dark:border-slate-800">
          <Link
            to="/admin"
            className={`flex items-center gap-3 min-w-0 ${
              sidebarCollapsed ? "lg:justify-center lg:w-full" : ""
            }`}
          >
            <div className="w-9 h-9 flex-shrink-0 rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 flex items-center justify-center shadow-md">
              <FiShoppingBag className="text-white" />
            </div>

            {!sidebarCollapsed && (
              <div className="leading-tight">
                <h1 className="text-base font-bold text-slate-900 dark:text-white">
                  Store
                </h1>
                <p className="text-[10px] uppercase tracking-wider text-slate-400">
                  Admin Panel
                </p>
              </div>
            )}
          </Link>

          {/* DESKTOP COLLAPSE BUTTON */}
          <button
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="hidden lg:flex absolute -right-3 top-5 w-7 h-7 rounded-full items-center justify-center bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 text-slate-600 dark:text-slate-300 shadow-sm hover:bg-slate-50 dark:hover:bg-slate-800 transition"
            title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
            aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {sidebarCollapsed ? (
              <FiChevronRight className="text-sm" />
            ) : (
              <FiChevronLeft className="text-sm" />
            )}
          </button>

          {/* MOBILE CLOSE */}
          <button
            onClick={() => setMobileSidebarOpen(false)}
            className="lg:hidden w-9 h-9 rounded-lg flex items-center justify-center text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close sidebar"
          >
            ✕
          </button>
        </div>

        {/* NAVIGATION */}
        <div className="p-4">
          {!sidebarCollapsed && (
            <p className="px-3 mb-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
              Management
            </p>
          )}

          <nav className="space-y-1">
            {adminNavItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.path);

              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`
                    group flex items-center gap-3
                    px-3 py-2.5 rounded-xl
                    text-sm font-medium
                    transition-all duration-200
                    ${sidebarCollapsed ? "lg:justify-center lg:px-0" : ""}
                    ${
                      active
                        ? "bg-indigo-600 text-white shadow-md shadow-indigo-500/20"
                        : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                    }
                  `}
                >
                  <Icon
                    className={`
                      text-lg flex-shrink-0
                      ${
                        active
                          ? "text-white"
                          : "text-slate-500 dark:text-slate-400 group-hover:text-indigo-600"
                      }
                    `}
                  />
                  {!sidebarCollapsed && <span>{item.label}</span>}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* SIDEBAR USER */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-slate-200 dark:border-slate-800">
          <div className={`flex items-center gap-3 p-3 rounded-xl bg-slate-50 dark:bg-slate-900 ${
            sidebarCollapsed ? "lg:justify-center lg:p-2" : ""
          }`}>
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 text-white flex items-center justify-center text-sm font-semibold">
              {user?.name?.charAt(0)?.toUpperCase() || "A"}
            </div>

            {!sidebarCollapsed && (
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-800 dark:text-white truncate">
                  {user?.name}
                </p>
                <p className="text-[10px] uppercase tracking-wide text-slate-400">
                  Administrator
                </p>
              </div>
            )}
          </div>
        </div>
      </aside>
    </>
  );

  // =========================
  // TOP HEADER
  // =========================
  const TopHeader = () => (
    <nav className="sticky top-0 z-30 backdrop-blur-xl bg-white/80 dark:bg-slate-950/80 border-b border-slate-200 dark:border-slate-800 shadow-sm">
      <div className="h-16 px-4 lg:px-8 flex items-center justify-between gap-4">
        {/* LEFT */}
        <div className="flex items-center gap-3">
          {user?.role === "admin" && (
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden w-10 h-10 rounded-lg border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 flex items-center justify-center text-slate-600 dark:text-slate-300"
              aria-label="Open sidebar"
            >
              ☰
            </button>
          )}

          {user?.role === "admin" ? (
            <div>
              <p className="text-sm font-semibold text-slate-800 dark:text-white">
                Admin Panel
              </p>
              <p className="text-xs text-slate-400">
                Manage APC Store
              </p>
            </div>
          ) : (
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
          )}

          {/* STAFF NAV */}
          {user?.role === "staff" && (
            <div className="flex items-center gap-1 ml-4">
              <Link
                to="/staff"
                className={`
                  flex items-center gap-2 px-3 py-2 rounded-lg
                  text-sm font-medium transition-all duration-200
                  ${
                    isActive("/staff")
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800"
                  }
                `}
              >
                <FiShoppingBag className="text-sm" />
                Orders

                {pendingOrdersCount > 0 && (
                  <span className="ml-1 px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px] font-medium">
                    {pendingOrdersCount}
                  </span>
                )}
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
            title={
              user?.role === "admin"
                ? "Low Stock Alerts"
                : "Pending Orders"
            }
          >
            <FiBell className="text-base" />

            {totalAlerts > 0 && (
              <>
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500 animate-ping" />
                <span className="absolute -top-1 -right-1 w-2 h-2 rounded-full bg-red-500" />

                <span
                  className={`absolute -top-2 -right-2 min-w-[20px] h-5 px-1 rounded-full flex items-center justify-center text-white text-[10px] font-bold ${
                    isAlertsActive ? "bg-red-600" : "bg-red-500"
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
            title="Toggle theme"
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
            title="Logout"
          >
            <FiLogOut className="text-sm" />
          </button>
        </div>
      </div>
    </nav>
  );

  // =========================
  // MAIN LAYOUT
  // =========================
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-300">
      {/* ADMIN SIDEBAR */}
      {user?.role === "admin" && <AdminSidebar />}

      {/* PAGE AREA */}
      <div
        className={
          user?.role === "admin"
            ? sidebarCollapsed
              ? "lg:pl-20"
              : "lg:pl-64"
            : ""
        }
      >
        <TopHeader />

        <main className="max-w-[1600px] mx-auto px-4 lg:px-8 py-6">
          {children}
        </main>
      </div>
    </div>
  );

}