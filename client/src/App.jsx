import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useSelector, useDispatch } from "react-redux";
import { useEffect, useState } from "react";
import Swal from "sweetalert2";
import socket from "./services/socket";
import api from "./services/api";
import { setMaintenanceMode } from "./redux/slices/settingsSlice";

import ConsumerPage from "./pages/ConsumerPage";
import StaffPage from "./pages/StaffPage";
import AdminPage from "./pages/AdminPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import MaintenanceGuard from "./components/MaintenanceGuard";
import MaintenancePage from "./pages/MaintenancePage";
import Layout from "./components/Layout";
import StockRefillPage from "./pages/StockRefillPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminStaffPage from "./pages/AdminStaffPage";
import AdminAlertsPage from "./pages/AdminAlertsPage";
import InsightsPage from "./pages/InsightsPage";
import AdminCountersPage from "./pages/AdminCountersPage";
import SalesReportPage from "./pages/SalesReportPage";
import AdminSettingsPage from "./pages/AdminSettingsPage";

function App() {
  const { user, token } = useSelector((state) => state.auth);
  const isAuthenticated = !!token && !!user;
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    setIsPWA(standalone);
  }, []);

  // Global presence: Connect, Heartbeat (every 25s), Force Logout & Beacon Disconnect
  useEffect(() => {
    const getActiveUserId = () => {
      if (isAuthenticated && user?._id) return user._id;
      const counterUserData = localStorage.getItem('counterUser');
      if (counterUserData) {
        try {
          const parsed = JSON.parse(counterUserData);
          if (parsed._id) return parsed._id;
        } catch (e) {}
      }
      return null;
    };

    const activeUserId = getActiveUserId();

    if (activeUserId) {
      socket.emit('userConnected', activeUserId);
      const handleConnect = () => socket.emit('userConnected', activeUserId);
      socket.on('connect', handleConnect);

      // Heartbeat every 25 seconds
      const heartbeatTimer = setInterval(() => {
        const currentId = getActiveUserId();
        if (currentId) {
          socket.emit('heartbeat', currentId);
        }
      }, 25000);

      // Send beacon disconnect on tab/window close
      const handleBeforeUnload = () => {
        const id = getActiveUserId();
        if (id && navigator.sendBeacon) {
          const beaconUrl = `${import.meta.env.VITE_API_URL || '/api'}/auth/beacon-disconnect`;
          const blob = new Blob([JSON.stringify({ userId: id })], { type: 'application/json' });
          navigator.sendBeacon(beaconUrl, blob);
        }
      };

      window.addEventListener('beforeunload', handleBeforeUnload);

      return () => {
        socket.off('connect', handleConnect);
        clearInterval(heartbeatTimer);
        window.removeEventListener('beforeunload', handleBeforeUnload);
      };
    }
  }, [isAuthenticated, user]);

  // Global Force Logout listener
  useEffect(() => {
    const handleForceLogout = (data) => {
      const targetUserId = typeof data === 'object' ? data?.userId : data;
      const currentAuthId = user?._id;
      let counterUserId = null;
      try {
        const parsed = JSON.parse(localStorage.getItem('counterUser') || '{}');
        counterUserId = parsed._id;
      } catch (e) {}

      if (
        !targetUserId ||
        targetUserId === currentAuthId ||
        targetUserId === counterUserId
      ) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        localStorage.removeItem('counterToken');
        localStorage.removeItem('counterUser');
        window.location.href = '/login';
      }
    };

    socket.on('userForceLogout', handleForceLogout);
    return () => {
      socket.off('userForceLogout', handleForceLogout);
    };
  }, [user]);

  const dispatch = useDispatch();

  // Initial maintenance status fetch
  useEffect(() => {
    api
      .get('/settings/maintenance')
      .then(({ data }) => {
        if (data?.maintenanceMode) {
          dispatch(setMaintenanceMode(data.maintenanceMode));
        }
      })
      .catch((err) => {
        console.error('Failed to load initial maintenance status:', err);
      });
  }, [dispatch]);

  // Global Maintenance Mode realtime listener
  useEffect(() => {
    const handleMaintenanceChange = (data) => {
      if (!data) return;
      dispatch(setMaintenanceMode(data));

      const activeRole = user?.role;
      let counterRole = null;
      try {
        const parsed = JSON.parse(localStorage.getItem('counterUser') || '{}');
        counterRole = parsed.role;
      } catch (e) {}

      // Admin is NEVER redirected or interrupted
      if (activeRole === 'admin') {
        return;
      }

      // If maintenance enabled and user is staff or counter
      if (data.enabled) {
        const isStaff = activeRole === 'staff';
        const isCounter = counterRole === 'counter' || !!localStorage.getItem('counterToken');

        if (isStaff || isCounter) {
          if (window.location.pathname === '/maintenance') return;

          Swal.fire({
            title: 'System Maintenance Started',
            text: 'The system is now under maintenance. You will be redirected shortly.',
            icon: 'warning',
            timer: 2500,
            timerProgressBar: true,
            showConfirmButton: false,
            background: '#0f172a',
            color: '#ffffff',
            customClass: {
              popup: 'rounded-2xl border border-slate-700',
            },
          }).then(() => {
            window.location.href = '/maintenance';
          });
        }
      }
    };

    socket.on('maintenanceModeChanged', handleMaintenanceChange);
    return () => {
      socket.off('maintenanceModeChanged', handleMaintenanceChange);
    };
  }, [user, dispatch]);

  // ✅ Check if counter user is logged in
  const isCounterLoggedIn = !!localStorage.getItem('counterToken');

  return (
    <BrowserRouter>
      <Toaster
        position="top-center"
        containerClassName="no-print toast-container toaster-container"
        toastOptions={{
          duration: 3000,
          style: {
            background: "#0f172a",
            color: "#ffffff",
            fontSize: "14px",
            fontWeight: "500",
            borderRadius: "12px",
            padding: "12px 20px",
            boxShadow:
              "0 10px 25px -5px rgba(15, 23, 42, 0.25), 0 8px 10px -6px rgba(15, 23, 42, 0.15)",
          },
          success: {
            iconTheme: {
              primary: "#10b981",
              secondary: "#ffffff",
            },
          },
          error: {
            iconTheme: {
              primary: "#ef4444",
              secondary: "#ffffff",
            },
          },
        }}
      />
      <Routes>
        {/* ✅ Root Route */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              user?.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : user?.role === 'staff' ? (
                <Navigate to="/staff" replace />
              ) : isCounterLoggedIn ? (
                <Navigate to="/consumer" replace />
              ) : (
                <Navigate to="/login" replace />
              )
            ) : isCounterLoggedIn ? (
              <Navigate to="/consumer" replace />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ✅ Maintenance Page */}
        <Route path="/maintenance" element={<MaintenancePage />} />

        {/* ✅ Consumer Page - Protected with counter token & MaintenanceGuard */}
        <Route
          path="/consumer"
          element={
            <MaintenanceGuard>
              {isCounterLoggedIn ? (
                <ConsumerPage />
              ) : (
                <Navigate to="/login" replace />
              )}
            </MaintenanceGuard>
          }
        />

        {/* ✅ Login Page */}
        <Route path="/login" element={<LoginPage />} />

        {/* ✅ Staff Routes */}
        <Route
          path="/staff"
          element={
            <MaintenanceGuard>
              <ProtectedRoute roles={["staff"]}>
                <Layout><StaffPage /></Layout>
              </ProtectedRoute>
            </MaintenanceGuard>
          }
        />

        {/* ✅ Admin Routes */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/dashboard"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminProductsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/categories"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminCategoriesPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/stock-refill"
          element={
            <MaintenanceGuard>
              <ProtectedRoute roles={["admin", "staff"]}>
                <Layout><StockRefillPage /></Layout>
              </ProtectedRoute>
            </MaintenanceGuard>
          }
        />
        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminOrdersPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminStaffPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminAlertsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/insights"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><InsightsPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/reports"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><SalesReportPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/counters"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminCountersPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/settings"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout><AdminSettingsPage /></Layout>
            </ProtectedRoute>
          }
        />


        {/* ✅ 404 - Not Found */}
        <Route
          path="*"
          element={
            <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] flex items-center justify-center">
              <div className="text-center">
                <h1 className="text-6xl font-bold text-gray-800 dark:text-white">404</h1>
                <p className="text-gray-500 dark:text-gray-400 mt-2">Page not found</p>
                <a 
                  href="/" 
                  className="mt-4 inline-block px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
                >
                  Go Home
                </a>
              </div>
            </div>
          }
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
