import React from 'react';

interface BadgeProps {
  children: React.ReactNode;
  variant?: 'success' | 'warning' | 'neutral' | 'error';
  className?: string;
}

const Badge: React.FC<BadgeProps> = ({ children, variant = 'neutral', className = '' }) => {
  const variants = {
    success: 'bg-green-100 text-green-800 border-green-200',
    warning: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    neutral: 'bg-gray-100 text-gray-800 border-gray-200',
    error: 'bg-red-100 text-red-800 border-red-200',
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${variants[variant]} ${className}`}>
      {children}
    </span>
  );
};

export default Badge;
