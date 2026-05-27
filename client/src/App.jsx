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
  const { user } = useSelector((state) => state.auth);

  // Detect PWA mode
  const [isPWA, setIsPWA] = useState(false);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone;

    setIsPWA(standalone);
  }, []);

  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Toaster position="top-right" />

      <Routes>

        {/* ROOT ROUTE */}
        <Route
          path="/"
          element={
            isPWA ? (
              <Navigate to="/login" replace />
            ) : (
              <ConsumerPage />
            )
          }
        />

        {/* LOGIN */}
        <Route path="/login" element={<LoginPage />} />

        {/* STAFF */}
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

        {/* PRODUCTS */}
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

        {/* CATEGORIES */}
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

        {/* ORDERS */}
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

        {/* ALERTS */}
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

        {/* INSIGHTS */}
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

      </Routes>
    </BrowserRouter>
  );
}

export default App;