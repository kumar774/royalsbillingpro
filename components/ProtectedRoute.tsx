import React from 'react';
import { Navigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Loader2 } from 'lucide-react';

export const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, loading } = useAuth();
  const { restaurantId } = useParams<{ restaurantId: string }>();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="animate-spin h-10 w-10 text-orange-500" />
          <p className="text-gray-500 font-semibold text-sm">Authenticating session...</p>
        </div>
      </div>
    );
  }

  if (!user || !userProfile) {
    return <Navigate to="/login" replace />;
  }

  // Tenant Isolation: Redirect non-admin to their assigned restaurant if URL doesn't match
  if (userProfile.role !== 'admin' && userProfile.restaurantId) {
    if (restaurantId && restaurantId !== userProfile.restaurantId) {
      return <Navigate to={`/dashboard/${userProfile.restaurantId}`} replace />;
    }
  }

  return <>{children}</>;
};

export const GuestRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, userProfile, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="animate-spin h-10 w-10 text-orange-500" />
          <p className="text-gray-500 font-semibold text-sm">Loading session...</p>
        </div>
      </div>
    );
  }

  if (user && userProfile) {
    if (userProfile.role === 'admin' && userProfile.restaurantId) {
      return <Navigate to={`/dashboard/${userProfile.restaurantId}`} replace />;
    }
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
};
