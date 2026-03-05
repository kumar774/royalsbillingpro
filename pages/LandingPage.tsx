import React from 'react';
import { Link } from 'react-router-dom';
import { Star, Loader2, Store } from 'lucide-react';
import { useRestaurants } from '../context/RestaurantContext';
import LandingPageComponent from '../components/LandingPage';

const LandingPage: React.FC = () => {
  const { restaurants, loading } = useRestaurants();
  const activeRestaurants = restaurants.filter(r => r.isActive === true);

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center bg-gray-50"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>;
  }

  // Check if the first active restaurant has homeViewMode set to 'Landing Page'
  const firstRestaurant = activeRestaurants[0] || restaurants[0];
  if (firstRestaurant && firstRestaurant.homeViewMode === 'Landing Page') {
    return <LandingPageComponent />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="text-center mb-12">
        <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight sm:text-5xl mb-4">
          Order from the best <span className="text-orange-600">local favorites</span>
        </h1>
        <p className="text-xl text-gray-500 max-w-2xl mx-auto">
          Select a restaurant to view their menu and start your order.
        </p>
      </div>

      {activeRestaurants.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-2xl border border-dashed border-gray-200 shadow-sm">
           <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
             <Store className="h-10 w-10 text-gray-400" />
           </div>
           <h3 className="text-lg font-bold text-gray-900 mb-2">No restaurants available</h3>
           <p className="text-gray-500 mb-6">It looks like no restaurants have been added yet.</p>
           <Link to="/login" className="inline-flex items-center text-orange-600 font-bold hover:text-orange-700 hover:underline">
             Are you a restaurant owner? Join us!
           </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {activeRestaurants.map((restaurant) => (
            <Link to={`/restaurant/${restaurant.slug}`} key={restaurant.id} className="group block h-full">
              <div className="bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition-all duration-300 border border-gray-100 h-full flex flex-col">
                <div className="relative h-48 overflow-hidden bg-gray-200">
                  <img 
                    src={restaurant.bannerImage} 
                    alt={restaurant.name} 
                    className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/banner/1200/400';
                    }}
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent opacity-60" />
                  <div className="absolute bottom-4 left-4 right-4 flex justify-between items-end text-white">
                     <div className="bg-white/20 backdrop-blur-sm px-3 py-1 rounded-lg">
                        <span className="font-bold text-sm">{restaurant.deliveryTime}</span>
                     </div>
                  </div>
                </div>
                
                <div className="p-6 flex-1 flex flex-col">
                  <div className="flex justify-between items-start mb-2">
                     <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                       {restaurant.name}
                     </h3>
                     <span className="flex items-center bg-green-100 text-green-800 text-xs font-bold px-2 py-1 rounded">
                       {restaurant.rating} <Star className="h-3 w-3 ml-1 fill-current" />
                     </span>
                  </div>
                  
                  <p className="text-gray-500 text-sm mb-4 line-clamp-2">
                    {restaurant.cuisine ? restaurant.cuisine.join(' • ') : 'Various Cuisines'}
                  </p>
                  
                  <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                     <span className="text-xs text-gray-400 font-medium truncate max-w-[150px]">{restaurant.location}</span>
                     <span className="text-orange-600 text-sm font-bold flex-shrink-0">View Menu &rarr;</span>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
};

export default LandingPage;