import React from 'react';
import { Star, Clock, MapPin, Search } from 'lucide-react';
import { Restaurant } from '../types';

interface RestaurantHeroProps {
  restaurant: Restaurant;
  deliveryTime?: string;
}

const RestaurantHero: React.FC<RestaurantHeroProps> = ({ restaurant, deliveryTime }) => {
  const settings = restaurant.restaurantPageSettings;
  const oldTheme = restaurant.theme || {};
  
  const primaryColor = settings?.theme.primaryColor || oldTheme.primaryColor || '#ea580c'; // default orange
  const bannerImage = settings?.header.bannerImage || restaurant.bannerImage;
  const address = settings?.header.address || restaurant.location;
  // Phone is available in settings?.header.phone but not currently displayed in the hero, maybe add it?
  // The user asked for "Header/Footer: Allow full content management (Address, Phone, Banner Images)"
  // So I should probably display the phone number if available.

  return (
    <div className="relative bg-white shadow-sm pb-6">
      {/* Banner Image */}
      <div className="h-48 md:h-64 w-full relative overflow-hidden bg-gray-200">
        <img 
          src={bannerImage} 
          alt={restaurant.name} 
          className="w-full h-full object-cover object-center"
          referrerPolicy="no-referrer"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
      </div>

      {/* Restaurant Info Overlay/Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-16">
        <div className="bg-white rounded-xl shadow-lg p-6 flex flex-col md:flex-row md:items-start md:justify-between gap-6">
          <div className="flex flex-col md:flex-row gap-6 items-start">
             {/* Logo */}
             <div className="h-24 w-24 rounded-lg overflow-hidden border-4 border-white shadow-sm flex-shrink-0 bg-white">
                <img src={restaurant.logo} alt="logo" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
             </div>

             {/* Text Info */}
             <div>
               <h1 className="text-2xl md:text-3xl font-bold text-gray-900">
                   {restaurant.name}
               </h1>
               <p className="text-gray-500 mt-1 text-lg">
                   {restaurant.cuisine.join(', ')}
               </p>
               
               <div className="flex items-center space-x-4 mt-4 text-sm">
                 <div className="flex items-center text-gray-600">
                     <MapPin className="h-4 w-4 mr-1" /> {address}
                 </div>
                 {settings?.header.phone && (
                     <div className="flex items-center text-gray-600">
                         <span className="font-semibold mr-1">Tel:</span> {settings.header.phone}
                     </div>
                 )}
               </div>
               
               <div className="flex items-center space-x-6 mt-3">
                 <div className="flex items-center bg-green-50 px-2 py-1 rounded text-green-700 font-bold text-sm border border-green-100">
                   <Star className="h-4 w-4 mr-1 fill-current" />
                   {restaurant.rating}
                 </div>
                 {deliveryTime && (
                   <div className="flex items-center text-gray-700 text-sm font-medium">
                     <Clock className="h-4 w-4 mr-1.5" style={{ color: primaryColor }} />
                     {deliveryTime}
                   </div>
                 )}
               </div>
             </div>
          </div>

          {/* In-Restaurant Search */}
          <div className="w-full md:w-auto md:min-w-[300px] mt-2 md:mt-0">
             <div className="relative">
               <input 
                 type="text" 
                 placeholder={`Search in ${restaurant.name}...`}
                 className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:border-transparent outline-none bg-gray-50 transition-all"
                 style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
               />
               <Search className="h-4 w-4 text-gray-400 absolute left-3 top-2.5" />
             </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RestaurantHero;