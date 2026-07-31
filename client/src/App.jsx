import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useSelector } from "react-redux";
import { useEffect, useState } from "react";

import ConsumerPage from "./pages/ConsumerPage";
import StaffPage from "./pages/StaffPage";
import AdminPage from "./pages/AdminPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage";
import LoginPage from "./pages/LoginPage";
import ProtectedRoute from "./components/ProtectedRoute";
import Layout from "./components/Layout";
import StockRefillPage from "./pages/StockRefillPage";
import SalesReportPage from "./pages/SalesReportPage";
import AdminOrdersPage from "./pages/AdminOrdersPage";
import AdminStaffPage from "./pages/AdminStaffPage";
import AdminAlertsPage from "./pages/AdminAlertsPage";
import InsightsPage from "./pages/InsightsPage";

function App() {
  const { user, token } = useSelector((state) => state.auth);
  const isAuthenticated = !!token && !!user;
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const standalone = window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone;
    setIsPWA(standalone);
  }, []);

  // ✅ Check if counter user is logged in
  const isCounterLoggedIn = !!localStorage.getItem('counterToken');

  return (
    <BrowserRouter>
      <Toaster position="top-right" />
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

        {/* ✅ Consumer Page - Protected with counter token */}
        <Route
          path="/consumer"
          element={
            isCounterLoggedIn ? (
              <ConsumerPage />
            ) : (
              <Navigate to="/login" replace />
            )
          }
        />

        {/* ✅ Login Page */}
        <Route path="/login" element={<LoginPage />} />

        {/* ✅ Staff Routes */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute roles={["staff"]}>
              <Layout><StaffPage /></Layout>
            </ProtectedRoute>
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
            <ProtectedRoute roles={["admin", "staff"]}>
              <Layout><StockRefillPage /></Layout>
            </ProtectedRoute>
          }
        />
        <Route
          path="/admin/sales-report"
          element={
            <ProtectedRoute roles={["admin", "staff"]}>
              <Layout><SalesReportPage /></Layout>
            </ProtectedRoute>
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