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
  
  // Check authentication from Redux state (already loaded from storage)
  const isAuthenticated = !!token && !!user;
  
  // Detect PWA mode
  const [isPWA, setIsPWA] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    setIsPWA(standalone);
    setIsLoading(false);
  }, []);

  // Show loading while checking PWA mode
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 dark:bg-[#0B1120] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
      </div>
    );
  }

  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Toaster 
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: {
            background: '#363636',
            color: '#fff',
          },
          success: {
            duration: 2000,
            iconTheme: {
              primary: '#10b981',
              secondary: '#fff',
            },
          },
          error: {
            duration: 3000,
            iconTheme: {
              primary: '#ef4444',
              secondary: '#fff',
            },
          },
        }}
      />

      <Routes>
        {/* ROOT ROUTE - Redirect based on auth and PWA */}
        <Route
          path="/"
          element={
            isAuthenticated ? (
              // If logged in, redirect to respective dashboard
              user?.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : user?.role === 'staff' ? (
                <Navigate to="/staff" replace />
              ) : (
                <ConsumerPage />
              )
            ) : isPWA ? (
              // PWA mode and not logged in -> login page
              <Navigate to="/login" replace />
            ) : (
              // Web mode and not logged in -> consumer page
              <ConsumerPage />
            )
          }
        />

        {/* LOGIN PAGE - Redirect if already logged in */}
        <Route
          path="/login"
          element={
            isAuthenticated ? (
              user?.role === 'admin' ? (
                <Navigate to="/admin" replace />
              ) : user?.role === 'staff' ? (
                <Navigate to="/staff" replace />
              ) : (
                <LoginPage />
              )
            ) : (
              <LoginPage />
            )
          }
        />

        {/* STAFF DASHBOARD */}
        <Route
          path="/staff"
          element={
            <ProtectedRoute roles={["staff"]}>
              <Layout>
                <StaffPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* STAFF ORDERS (same as staff page) */}
        <Route
          path="/staff/orders"
          element={
            <ProtectedRoute roles={["staff"]}>
              <Layout>
                <StaffPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ADMIN DASHBOARD */}
        <Route
          path="/admin"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <AdminPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ADMIN PRODUCTS */}
        <Route
          path="/admin/products"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <AdminProductsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ADMIN CATEGORIES */}
        <Route
          path="/admin/categories"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <AdminCategoriesPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* STOCK REFILL */}
        <Route
          path="/admin/stock-refill"
          element={
            <ProtectedRoute roles={["admin", "staff"]}>
              <Layout>
                <StockRefillPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* SALES REPORT */}
        <Route
          path="/admin/sales-report"
          element={
            <ProtectedRoute roles={["admin", "staff"]}>
              <Layout>
                <SalesReportPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ADMIN ORDERS */}
        <Route
          path="/admin/orders"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <AdminOrdersPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* STAFF MANAGEMENT */}
        <Route
          path="/admin/staff"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <AdminStaffPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* ADMIN ALERTS */}
        <Route
          path="/admin/alerts"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <AdminAlertsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* INSIGHTS / ANALYTICS */}
        <Route
          path="/admin/insights"
          element={
            <ProtectedRoute roles={["admin"]}>
              <Layout>
                <InsightsPage />
              </Layout>
            </ProtectedRoute>
          }
        />

        {/* CATCH ALL - 404 PAGE */}
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