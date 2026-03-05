import React from 'react';
import { UtensilsCrossed } from 'lucide-react';

interface AuthLayoutProps {
  children: React.ReactNode;
}

const AuthLayout: React.FC<AuthLayoutProps> = ({ children }) => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8 font-sans">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="flex justify-center">
          <div className="bg-orange-600 p-3 rounded-xl shadow-lg">
            <UtensilsCrossed className="h-8 w-8 text-white" />
          </div>
        </div>
        <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900 tracking-tight">
          Partner Admin Portal
        </h2>
        <p className="mt-2 text-center text-sm text-gray-600">
          Manage your restaurant, menu, and orders.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-gray-100 rounded-xl sm:px-10 border border-gray-100">
          {children}
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;
