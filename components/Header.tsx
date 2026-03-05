import React, { useState, useRef, useEffect } from 'react';
import { ShoppingBag, Search, UtensilsCrossed, ChevronDown, Store } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { Link, useNavigate } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { useRestaurants } from '../context/RestaurantContext';
import { Restaurant } from '../types';

const Header: React.FC = () => {
  const { totalItems, toggleCart } = useCart();
  const { theme } = useTheme();
  const { restaurants, selectedRestaurant, setSelectedRestaurant } = useRestaurants();
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const navigate = useNavigate();

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleRestaurantSelect = (restaurant: Restaurant | null) => {
    setSelectedRestaurant(restaurant);
    setIsDropdownOpen(false);
    if (restaurant) {
      navigate(`/restaurant/${restaurant.slug}`);
    } else {
      navigate('/');
    }
  };

  const visibleRestaurants = restaurants.filter(r => r.isActive === true);

  return (
    <header 
      className="sticky top-0 z-50 shadow-sm border-b border-gray-100 transition-colors duration-300"
      style={{ backgroundColor: theme.headerColor || '#ffffff' }}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo & Location */}
          <div className="flex items-center space-x-6">
            <Link to="/" className="flex items-center space-x-2 group">
              {selectedRestaurant ? (
                selectedRestaurant.logo ? (
                  <img 
                    src={selectedRestaurant.logo} 
                    alt={selectedRestaurant.name} 
                    className="h-10 w-10 object-contain rounded" 
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="bg-orange-600 p-2 rounded-lg group-hover:bg-orange-700 transition-colors">
                     <UtensilsCrossed className="h-6 w-6 text-white" />
                  </div>
                )
              ) : theme?.logoUrl ? (
                <img 
                  src={theme.logoUrl} 
                  alt="Logo" 
                  className="h-10 w-10 object-contain rounded" 
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="bg-orange-600 p-2 rounded-lg group-hover:bg-orange-700 transition-colors">
                   <UtensilsCrossed className="h-6 w-6 text-white" />
                </div>
              )}
              <span className="text-xl font-bold text-gray-900 tracking-tight">
                {selectedRestaurant ? selectedRestaurant.name : (theme?.headerText || 'CraveWave')}
              </span>
            </Link>
            
            <div className="relative" ref={dropdownRef}>
              <button 
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                className="hidden md:flex items-center space-x-2 text-sm text-gray-700 bg-gray-50 py-1.5 px-3 rounded-full hover:bg-gray-100 cursor-pointer transition border border-gray-200 font-medium"
              >
                <Store className="h-4 w-4 text-orange-600" />
                <span>{selectedRestaurant?.name || 'Select Restaurant'}</span>
                <ChevronDown className={`h-4 w-4 text-gray-400 transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
              </button>

              {isDropdownOpen && (
                <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Our Restaurants</div>
                  <div className="max-h-64 overflow-y-auto no-scrollbar">
                    <button 
                      onClick={() => handleRestaurantSelect(null)}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-orange-50 transition ${!selectedRestaurant ? 'bg-orange-50' : ''}`}
                    >
                      <Store className="h-8 w-8 p-1.5 rounded-full bg-gray-200 text-gray-600 object-cover border border-gray-100" />
                      <span className={`text-sm font-medium ${!selectedRestaurant ? 'text-orange-700' : 'text-gray-700'}`}>None / Home</span>
                    </button>
                    {visibleRestaurants.map(r => (
                      <button 
                        key={r.id}
                        onClick={() => handleRestaurantSelect(r)}
                        className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-orange-50 transition ${selectedRestaurant?.id === r.id ? 'bg-orange-50' : ''}`}
                      >
                        <img src={r.logo} className="h-8 w-8 rounded-full bg-gray-200 object-cover border border-gray-100" alt="" />
                        <span className={`text-sm font-medium ${selectedRestaurant?.id === r.id ? 'text-orange-700' : 'text-gray-700'}`}>{r.name}</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Search Bar - Hidden on mobile, visible on desktop */}
          <div className="hidden md:flex flex-1 max-w-lg mx-8">
            <div className="relative w-full">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Search className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-full leading-5 bg-gray-50 placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 sm:text-sm transition-shadow"
                placeholder="Search for food or restaurants..."
              />
            </div>
          </div>

          {/* Right Actions */}
          <div className="flex items-center space-x-4">
             <Link to="/login" className="hidden sm:block text-gray-500 hover:text-gray-900 font-medium text-sm">
                Sign In
             </Link>
             
             <button 
                onClick={toggleCart}
                className="relative p-2 text-gray-600 hover:text-orange-600 transition-colors rounded-full hover:bg-orange-50"
             >
               <ShoppingBag className="h-6 w-6" />
               {totalItems > 0 && (
                 <span className="absolute top-0 right-0 inline-flex items-center justify-center px-2 py-1 text-xs font-bold leading-none text-white transform translate-x-1/4 -translate-y-1/4 bg-orange-600 rounded-full">
                   {totalItems}
                 </span>
               )}
             </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
