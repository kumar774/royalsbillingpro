import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Star, Loader2, Store, Search, Bike, Clock } from 'lucide-react';
import { useRestaurants } from '../context/RestaurantContext';
import LandingPageComponent from '../components/LandingPage';
import { doc, getDoc, collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useCart } from '../context/CartContext';

const isRestaurantOpen = (openingHoursStr: string) => {
  if (!openingHoursStr) return true;
  try {
    const parts = openingHoursStr.split('-');
    if (parts.length !== 2) return true;
    
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    const parseTime = (timeStr: string) => {
      const clean = timeStr.trim().toUpperCase();
      const match = clean.match(/(\d+):(\d+)\s*(AM|PM)/);
      if (!match) return 0;
      let hours = parseInt(match[1]);
      const minutes = parseInt(match[2]);
      const ampm = match[3];
      if (ampm === 'PM' && hours < 12) hours += 12;
      if (ampm === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };
    
    const openTime = parseTime(parts[0]);
    const closeTime = parseTime(parts[1]);
    
    if (closeTime > openTime) {
      return currentTime >= openTime && currentTime <= closeTime;
    } else {
      return currentTime >= openTime || currentTime <= closeTime;
    }
  } catch (err) {
    console.error("Error parsing hours:", err);
    return true;
  }
};

const LandingPage: React.FC = () => {
  const { restaurants, loading: restaurantsLoading } = useRestaurants();
  const { addItem } = useCart();
  const [homeViewMode, setHomeViewMode] = useState<'Landing Page' | 'Default List'>('Landing Page');
  const [settingsLoading, setSettingsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCuisine, setSelectedCuisine] = useState('All');
  const [allMenuItems, setAllMenuItems] = useState<any[]>([]);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'settings', 'landingPage');
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          if (data.homeViewMode) {
            setHomeViewMode(data.homeViewMode);
          }
        }
      } catch (err) {
        console.error("Error loading landing page settings:", err);
      } finally {
        setSettingsLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const activeRestaurants = useMemo(() => {
    return restaurants.filter(r => r.isActive === true);
  }, [restaurants]);

  // Dynamically listen to menus of all active restaurants for global item search
  useEffect(() => {
    if (activeRestaurants.length === 0) return;

    const unsubscribes = activeRestaurants.map(restaurant => {
      const menuRef = collection(db, 'restaurants', restaurant.id, 'menu');
      return onSnapshot(menuRef, (snap) => {
        const items = snap.docs.map(doc => ({
          id: doc.id,
          restaurantId: restaurant.id,
          restaurantName: restaurant.name,
          restaurantSlug: restaurant.slug,
          ...doc.data()
        }));
        
        setAllMenuItems(prev => {
          const filtered = prev.filter(item => item.restaurantId !== restaurant.id);
          return [...filtered, ...items];
        });
      });
    });

    return () => {
      unsubscribes.forEach(unsub => unsub());
    };
  }, [activeRestaurants]);

  // Cuisines extraction
  const allCuisines = useMemo(() => {
    const cuisines = new Set<string>();
    activeRestaurants.forEach(r => {
      if (r.cuisine) {
        r.cuisine.forEach(c => cuisines.add(c.trim()));
      }
    });
    return ['All', ...Array.from(cuisines)];
  }, [activeRestaurants]);

  const filteredRestaurants = useMemo(() => {
    return activeRestaurants.filter(r => {
      const nameMatch = r.name.toLowerCase().includes(searchTerm.toLowerCase());
      const cuisineMatch = r.cuisine && r.cuisine.some(c => c.toLowerCase().includes(searchTerm.toLowerCase()));
      const matchesSearch = nameMatch || cuisineMatch;
      
      const matchesCuisine = selectedCuisine === 'All' || (r.cuisine && r.cuisine.includes(selectedCuisine));
      return matchesSearch && matchesCuisine;
    });
  }, [activeRestaurants, searchTerm, selectedCuisine]);

  // Filter global menu items matching the search term
  const filteredMenuItems = useMemo(() => {
    if (!searchTerm.trim()) return [];
    return allMenuItems.filter(item => {
      const nameMatch = item.name?.toLowerCase().includes(searchTerm.toLowerCase());
      const descMatch = item.description?.toLowerCase().includes(searchTerm.toLowerCase());
      return nameMatch || descMatch;
    });
  }, [allMenuItems, searchTerm]);

  if (restaurantsLoading || settingsLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <Loader2 className="animate-spin h-8 w-8 text-orange-600" />
      </div>
    );
  }

  if (homeViewMode === 'Landing Page') {
    return <LandingPageComponent />;
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
      {/* Top Banner and Search */}
      <div className="bg-gradient-to-r from-orange-500 to-red-650 rounded-[2rem] p-8 md:p-12 text-white shadow-xl relative overflow-hidden mb-10">
         <div className="relative z-10 max-w-2xl space-y-4">
            <h1 className="text-3xl md:text-5xl font-extrabold leading-tight">
              Order from the best <span className="text-yellow-350 block sm:inline">local favorites</span>
            </h1>
            <p className="text-orange-50 text-sm md:text-base font-medium">
              Search dishes across outlets or select a restaurant to view their full menu.
            </p>
            
            {/* Search Input */}
            <div className="relative text-gray-800 pt-2">
               <input 
                 type="text" 
                 placeholder="Search for food items (e.g. pizza, burger)..."
                 value={searchTerm}
                 onChange={e => setSearchTerm(e.target.value)}
                 className="w-full pl-11 pr-4 py-3 bg-white rounded-xl shadow focus:ring-2 focus:ring-orange-350 outline-none text-sm font-medium border-0"
               />
               <Search className="h-5 w-5 text-gray-400 absolute left-4 top-5" />
            </div>
         </div>
         
         {/* Decorative elements */}
         <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white/10 blur-xl pointer-events-none" />
         <div className="absolute bottom-0 right-0 -mr-10 -mb-10 w-48 h-48 rounded-full bg-black/15 blur-xl pointer-events-none" />
      </div>

      {/* Conditional Rendering: Global Search Results vs Restaurant Grid */}
      {searchTerm.trim() !== '' ? (
        /* Global Menu Items Search Grid */
        <div className="space-y-6">
           <div className="flex items-center justify-between border-b pb-4">
              <h2 className="text-xl font-bold text-gray-800">
                 Dishes matching &quot;{searchTerm}&quot;
              </h2>
              <span className="text-sm font-bold text-gray-500">{filteredMenuItems.length} items found</span>
           </div>

           {filteredMenuItems.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-3xl border border-dashed border-gray-250 max-w-md mx-auto">
                 <Store className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                 <p className="text-gray-500 text-sm font-medium">No dishes found matching your search. Try another keyword!</p>
              </div>
           ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                 {filteredMenuItems.map((item) => (
                    <div key={`${item.id}-${item.restaurantId}`} className="bg-white rounded-2xl border border-gray-150 overflow-hidden shadow-sm hover:shadow-md transition flex flex-col justify-between">
                       {/* Top section: Info */}
                       <div className="p-4 flex gap-4">
                          <div className="flex-1 space-y-1.5 text-left">
                             <span className="text-[10px] font-extrabold text-orange-750 bg-orange-50 border border-orange-100 px-2.5 py-0.5 rounded-lg inline-block">
                                🏠 Served by: {item.restaurantName}
                             </span>
                             <h4 className="text-sm font-bold text-gray-900 line-clamp-1">{item.name}</h4>
                             <p className="text-[11px] text-gray-400 font-medium line-clamp-2 leading-relaxed">{item.description}</p>
                             <div className="text-xs font-extrabold text-gray-900 pt-1">₹{item.price}</div>
                          </div>
                          {item.image && (
                             <div className="h-20 w-20 rounded-xl overflow-hidden bg-gray-100 flex-shrink-0">
                                <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                             </div>
                          )}
                       </div>

                       {/* Bottom Action Footer */}
                       <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex justify-between items-center">
                          <Link to={`/restaurant/${item.restaurantSlug}`} className="text-[10px] text-gray-500 hover:text-orange-600 font-bold">
                             View Full Menu &rarr;
                          </Link>
                          <button
                            onClick={() => addItem(item, item.restaurantId)}
                            className="bg-orange-600 hover:bg-orange-700 text-white font-bold text-[10px] px-3.5 py-1.5 rounded-lg transition cursor-pointer border-0 outline-none"
                          >
                             Add To Cart
                          </button>
                       </div>
                    </div>
                 ))}
              </div>
           )}
        </div>
      ) : (
        /* Default Restaurant Grid View */
        <>
          {/* Cuisine Pills */}
          {allCuisines.length > 1 && (
            <div className="flex overflow-x-auto whitespace-nowrap no-scrollbar gap-2 mb-8 pb-1">
               {allCuisines.map(cuisine => (
                  <button
                    key={cuisine}
                    onClick={() => setSelectedCuisine(cuisine)}
                    className={`px-4 py-2 rounded-full text-xs font-bold transition shadow-sm cursor-pointer border ${
                      selectedCuisine === cuisine 
                        ? 'bg-orange-655 text-white border-orange-655' 
                        : 'bg-white hover:bg-gray-50 border-gray-200 text-gray-600'
                    }`}
                  >
                    {cuisine}
                  </button>
               ))}
            </div>
          )}

          {/* Restaurants List */}
          {filteredRestaurants.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-dashed border-gray-250 shadow-sm max-w-xl mx-auto">
               <div className="bg-gray-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 border border-gray-100">
                 <Store className="h-10 w-10 text-gray-400" />
               </div>
               <h3 className="text-lg font-bold text-gray-900 mb-2">No active outlets found</h3>
               <p className="text-gray-500 mb-6 text-sm">Please try modifying your search or filters.</p>
               <button 
                 onClick={() => { setSelectedCuisine('All'); setSearchTerm(''); }}
                 className="inline-flex items-center text-orange-600 font-bold hover:text-orange-700 hover:underline text-sm cursor-pointer"
               >
                 Clear All Filters
               </button>
            </div>
          ) : (
            <div className={`grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8 ${filteredRestaurants.length < 3 ? 'max-w-4xl mx-auto' : ''}`}>
              {filteredRestaurants.map((restaurant) => {
                const isOpen = isRestaurantOpen(restaurant.openingHours);
                return (
                  <Link to={`/restaurant/${restaurant.slug}`} key={restaurant.id} className="group block h-full">
                    <div className="bg-white rounded-3xl overflow-hidden shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border border-gray-150 h-full flex flex-col relative">
                      {/* Banner Image */}
                      <div className="relative h-48 overflow-hidden bg-gray-250">
                        <img 
                          src={restaurant.bannerImage} 
                          alt={restaurant.name} 
                          className="w-full h-full object-cover transform group-hover:scale-105 transition-transform duration-500"
                          onError={(e) => {
                            (e.target as HTMLImageElement).src = 'https://picsum.photos/seed/banner/1200/400';
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-90" />
                        
                        {/* Status badge */}
                        <div className="absolute top-4 left-4 z-10">
                          <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-[10px] font-bold shadow ${
                            isOpen ? 'bg-green-600 text-white' : 'bg-red-650 text-white'
                          }`}>
                            {isOpen ? '🟢 Open Now' : '🔴 Closed'}
                          </span>
                        </div>

                        {/* Delivery Time Badge */}
                        {restaurant.deliveryTime && (
                          <div className="absolute bottom-4 left-4 z-10 bg-white/20 backdrop-blur-md border border-white/20 px-2.5 py-1 rounded-lg text-white">
                             <span className="font-extrabold text-xs flex items-center gap-1">
                               <Clock className="h-3.5 w-3.5" /> {restaurant.deliveryTime}
                             </span>
                          </div>
                        )}
                      </div>
                      
                      {/* Body Content */}
                      <div className="p-6 flex-1 flex flex-col">
                        <div className="flex justify-between items-start mb-2">
                           <h3 className="text-xl font-bold text-gray-900 group-hover:text-orange-600 transition-colors">
                             {restaurant.name}
                           </h3>
                           <span className="flex items-center bg-green-50 text-green-700 border border-green-200 text-xs font-bold px-2 py-0.5 rounded-lg">
                             {(restaurant as any).rating || '5.0'} <Star className="h-3 w-3 ml-1 fill-current text-green-600" />
                           </span>
                        </div>
                        
                        <p className="text-gray-500 text-sm mb-4 line-clamp-2 font-medium">
                          {restaurant.cuisine ? restaurant.cuisine.join(' • ') : 'Various Cuisines'}
                        </p>
                        
                        <div className="mt-auto pt-4 border-t border-gray-100 flex items-center justify-between">
                           <span className="text-xs text-gray-400 font-bold truncate max-w-[150px]">{restaurant.location}</span>
                           <span className="text-orange-655 text-sm font-extrabold flex-shrink-0 flex items-center gap-1 group-hover:gap-2 transition-all">
                             View Menu &rarr;
                           </span>
                        </div>
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default LandingPage;