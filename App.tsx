import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import RestaurantFrontPage from './pages/RestaurantFrontPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { RestaurantProvider } from './context/RestaurantContext';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute, GuestRoute } from './components/ProtectedRoute';

import LandingPage from './pages/LandingPage';
import PullToRefresh from './components/PullToRefresh';
import AppLicenseGuard from './components/AppLicenseGuard';

const App: React.FC = () => {
  const [showQrModal, setShowQrModal] = useState(false);
  const [qrCodeValue, setQrCodeValue] = useState('');
  return (
    <Router>
      <AppLicenseGuard>
        <ThemeProvider>
        <AuthProvider>
          <Toaster 
            position="top-right"
            toastOptions={{
              duration: 3000,
              style: {
                background: '#363636',
                color: '#fff',
              },
              success: {
                duration: 3000,
                style: {
                  background: '#22c55e',
                  color: 'white',
                },
              },
              error: {
                duration: 4000,
                style: {
                  background: '#ef4444',
                  color: 'white',
                },
              },
            }}
          />
          <PullToRefresh />
          <RestaurantProvider>
            <Routes>
              {/* Dynamic Shortcut Routes (Always resolve to active restaurant) */}
              <Route path="/dashboard" element={<Navigate to="/dashboard/current" replace />} />
              <Route path="/orders" element={<Navigate to="/dashboard/current/orders" replace />} />
              <Route path="/pos" element={<Navigate to="/dashboard/current/pos" replace />} />
              <Route path="/menu" element={<Navigate to="/dashboard/current/menu" replace />} />
              <Route path="/expenses" element={<Navigate to="/dashboard/current/expenses" replace />} />
              <Route path="/reports" element={<Navigate to="/dashboard/current/reports" replace />} />
              <Route path="/staff" element={<Navigate to="/dashboard/current/staff" replace />} />
              <Route path="/customers" element={<Navigate to="/dashboard/current/customers" replace />} />
              <Route path="/settings" element={<Navigate to="/dashboard/current/settings" replace />} />

              {/* Admin / Auth Routes */}
              <Route path="/login" element={
                <GuestRoute>
                  <Login />
                </GuestRoute>
              } />
              
              {/* Dashboard Routes with View Props */}
              <Route path="/dashboard/:restaurantId" element={<ProtectedRoute><Dashboard view="overview" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/menu" element={<ProtectedRoute><Dashboard view="menu" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/settings" element={<ProtectedRoute><Dashboard view="settings" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/pos" element={<ProtectedRoute><Dashboard view="pos" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/orders" element={<ProtectedRoute><Dashboard view="orders" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/expenses" element={<ProtectedRoute><Dashboard view="expenses" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/staff" element={<ProtectedRoute><Dashboard view="staff" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/reports" element={<ProtectedRoute><Dashboard view="reports" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/customers" element={<ProtectedRoute><Dashboard view="customers" /></ProtectedRoute>} />
              
              {/* Restaurant Management Routes */}
              <Route path="/dashboard/:restaurantId/restaurants" element={<ProtectedRoute><Dashboard view="restaurants" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/restaurants/new" element={<ProtectedRoute><Dashboard view="restaurants-new" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/restaurants/edit/:editId" element={<ProtectedRoute><Dashboard view="restaurants-edit" /></ProtectedRoute>} />
              <Route path="/dashboard/:restaurantId/restaurants/config/:configId" element={<ProtectedRoute><Dashboard view="restaurants-config" /></ProtectedRoute>} />
    
              {/* Customer Routes Wrapped in MainLayout */}
              <Route path="*" element={
                <MainLayout 
                  setShowQrModal={setShowQrModal} 
                  setQrCodeValue={setQrCodeValue}
                  showQrModal={showQrModal}
                  qrCodeValue={qrCodeValue}
                >
                  <Routes>
                    <Route path="/" element={<LandingPage />} />
                    <Route path="/restaurant/:slug" element={<RestaurantFrontPage />} />
                    <Route path="/restaurant/:slug/menu" element={<RestaurantFrontPage isMenuOnly={true} />} />
                    {/* Fallback for unknown customer routes */}
                    <Route path="*" element={<Navigate to="/" replace />} />
                  </Routes>
                </MainLayout>
              } />
            </Routes>
          </RestaurantProvider>
        </AuthProvider>
      </ThemeProvider>
      </AppLicenseGuard>
    </Router>
  );
};

export default App;
