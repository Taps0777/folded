import React, { useEffect } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AppProvider } from './context/AppContext';
import { ThemeProvider } from './context/ThemeContext';
import { Navbar } from './components/layout/Navbar';
import { Footer } from './components/layout/Footer';
import { HomePage } from './pages/home/HomePage';
import { BookingPage } from './pages/booking/BookingPage';
import { CustomerDashboardPage } from './pages/dashboard/CustomerDashboardPage';
import { OrderTrackingPage } from './pages/tracking/OrderTrackingPage';
import { StaffPortalPage } from './pages/staff/StaffPortalPage';
import { AdminDashboardPage } from './pages/admin/AdminDashboardPage';
import { LoginPage } from './pages/auth/LoginPage';
import { RoleBasedRoute, CustomerRoute, StaffRoute, AdminRoute } from './components/auth/RoleBasedRoute';
import { ErrorBoundary } from './components/ErrorBoundary';

// Scroll to top automatically when route changes
const ScrollToTop: React.FC = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
};

// Route-level boundary: keying on pathname remounts it on navigation so a crash
// on one page doesn't persist when the user clicks away.
const AppRoutes: React.FC = () => {
  const { pathname } = useLocation();
  return (
    <ErrorBoundary key={pathname}>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/booking" element={<BookingPage />} />

        {/* Customer-only routes */}
        <Route
          path="/dashboard"
          element={
            <CustomerRoute>
              <CustomerDashboardPage />
            </CustomerRoute>
          }
        />

        {/* Staff-only routes */}
        <Route
          path="/staff"
          element={
            <StaffRoute>
              <StaffPortalPage />
            </StaffRoute>
          }
        />

        {/* Admin-only routes */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminDashboardPage />
            </AdminRoute>
          }
        />

        {/* Order tracking - accessible to all authenticated users */}
        <Route
          path="/track/:orderId"
          element={
            <RoleBasedRoute allowedRoles={['customer', 'admin', 'pickup_staff', 'laundry_staff', 'delivery_staff']}>
              <OrderTrackingPage />
            </RoleBasedRoute>
          }
        />

        <Route path="*" element={<HomePage />} />
      </Routes>
    </ErrorBoundary>
  );
};

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider>
        <AppProvider>
          <BrowserRouter>
            <ScrollToTop />
            <div className="min-h-screen flex flex-col bg-cream text-foreground selection:bg-mint-soft selection:text-mint-dark dark:bg-ink dark:text-cream">
              <Navbar />
              <main className="flex-1">
                <AppRoutes />
              </main>
              <Footer />
            </div>
          </BrowserRouter>
        </AppProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;