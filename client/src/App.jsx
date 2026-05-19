import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "react-hot-toast";
import { useSelector } from "react-redux";
import ConsumerPage from "./pages/ConsumerPage";
import StaffPage from "./pages/StaffPage";
import AdminPage from "./pages/AdminPage";
import AdminProductsPage from "./pages/AdminProductsPage";
import AdminCategoriesPage from "./pages/AdminCategoriesPage"; // 👈 new import
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

  return (
    <BrowserRouter
      future={{ v7_startTransition: true, v7_relativeSplatPath: true }}
    >
      <Toaster />
      <Routes>
        <Route path="/" element={<ConsumerPage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route
          path="/staff"
          element={
            <ProtectedRoute roles={["staff", "admin"]}>
              <Layout>
                <StaffPage />
              </Layout>
            </ProtectedRoute>
          }
        />
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
        {/* 👇 new categories route */}
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
        // Inside Routes, add:
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
        import InsightsPage from './pages/InsightsPage';
        <Route
          path="/admin/insights"
          element={
            <ProtectedRoute roles={["admin", "staff"]}>
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
