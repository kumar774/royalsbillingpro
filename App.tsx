import React, { useState } from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import MainLayout from './layouts/MainLayout';
import RestaurantFrontPage from './pages/RestaurantFrontPage';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import { RestaurantProvider } from './context/RestaurantContext';
import { Toaster } from 'react-hot-toast';
import { ThemeProvider } from './context/ThemeContext';

const App: React.FC = () => {
  const [, setShowQrModal] = useState(false);
  const [, setQrCodeValue] = useState('');
  return (
    <Router>
      <ThemeProvider>
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
        <RestaurantProvider>
          <Routes>
            {/* Admin / Auth Routes */}
            <Route path="/login" element={<Login />} />
            
            {/* Dashboard Routes with View Props */}
            <Route path="/dashboard/:restaurantId" element={<Dashboard view="overview" />} />
            <Route path="/dashboard/:restaurantId/menu" element={<Dashboard view="menu" />} />
            <Route path="/dashboard/:restaurantId/settings" element={<Dashboard view="settings" />} />
            <Route path="/dashboard/:restaurantId/pos" element={<Dashboard view="pos" />} />
            <Route path="/dashboard/:restaurantId/orders" element={<Dashboard view="orders" />} />
            <Route path="/dashboard/:restaurantId/expenses" element={<Dashboard view="expenses" />} />
            <Route path="/dashboard/:restaurantId/reports" element={<Dashboard view="reports" />} />
            <Route path="/dashboard/:restaurantId/customers" element={<Dashboard view="customers" />} />
            
            {/* Restaurant Management Routes */}
            <Route path="/dashboard/:restaurantId/restaurants" element={<Dashboard view="restaurants" />} />
            <Route path="/dashboard/:restaurantId/restaurants/new" element={<Dashboard view="restaurants-new" />} />
            <Route path="/dashboard/:restaurantId/restaurants/edit/:editId" element={<Dashboard view="restaurants-edit" />} />
            <Route path="/dashboard/:restaurantId/restaurants/config/:configId" element={<Dashboard view="restaurants-config" />} />
  
            {/* Customer Routes Wrapped in MainLayout */}
            <Route path="*" element={
              <MainLayout setShowQrModal={setShowQrModal} setQrCodeValue={setQrCodeValue}>
                <Routes>
                  <Route path="/" element={<RestaurantFrontPage />} />
                  <Route path="/restaurant/:slug" element={<RestaurantFrontPage />} />
                  <Route path="/restaurant/:slug/menu" element={<RestaurantFrontPage isMenuOnly={true} />} />
                  {/* Fallback for unknown customer routes */}
                  <Route path="*" element={<Navigate to="/" replace />} />
                </Routes>
              </MainLayout>
            } />
          </Routes>
        </RestaurantProvider>
      </ThemeProvider>
    </Router>
  );
};

export default App;