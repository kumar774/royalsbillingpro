import React from 'react';

const MenuSkeleton: React.FC = () => {
  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 animate-pulse flex justify-between gap-4 h-full">
      <div className="flex flex-col justify-between flex-1">
        <div>
          {/* Veg/Non-veg icon placeholder */}
          <div className="w-4 h-4 bg-gray-200 rounded-sm" />
          
          {/* Title placeholder */}
          <div className="h-6 bg-gray-200 rounded w-3/4 mt-2" />
          
          {/* Price placeholder */}
          <div className="h-5 bg-gray-200 rounded w-16 mt-2" />
          
          {/* Rating placeholder */}
          <div className="flex items-center mt-2 space-x-1">
             <div className="h-3 w-3 bg-gray-200 rounded-full" />
             <div className="h-3 w-3 bg-gray-200 rounded-full" />
             <div className="h-3 w-3 bg-gray-200 rounded-full" />
             <div className="h-3 w-3 bg-gray-200 rounded-full" />
             <div className="h-3 w-3 bg-gray-200 rounded-full" />
             <div className="h-3 w-8 bg-gray-200 rounded ml-1" />
          </div>

          {/* Description placeholder */}
          <div className="mt-4 space-y-2">
            <div className="h-3 bg-gray-200 rounded w-full" />
            <div className="h-3 bg-gray-200 rounded w-5/6" />
          </div>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-3 relative w-32 flex-shrink-0">
        {/* Image placeholder */}
        <div className="w-32 h-28 bg-gray-200 rounded-xl" />
        
        {/* Add button placeholder */}
        <div className="absolute -bottom-3 w-24 h-9 bg-gray-200 rounded-lg border border-gray-100" />
      </div>
    </div>
  );
};

export default MenuSkeleton;
