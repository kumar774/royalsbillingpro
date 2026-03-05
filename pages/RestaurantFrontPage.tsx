import React, { useState, useEffect, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { collection, query, where, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../firebase/config';
import RestaurantHero from '../components/RestaurantHero';
import MenuItemCard from '../components/MenuItemCard';
import MenuSkeleton from '../components/MenuSkeleton';
import { MenuItem, Restaurant, ThemeSettings } from '../types';
import { Search, ChevronLeft, AlertCircle } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useRestaurants } from '../context/RestaurantContext';

interface RestaurantFrontPageProps {
  isMenuOnly?: boolean;
}

const RestaurantFrontPage: React.FC<RestaurantFrontPageProps> = () => {
  const { slug } = useParams<{ slug: string }>();
  const [activeCategoryGroup, setActiveCategoryGroup] = useState<string | 'All'>('All');
  const [searchTerm, setSearchTerm] = useState('');
  
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(false);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [globalHomeViewMode, setGlobalHomeViewMode] = useState<'Landing Page' | 'Default List'>('Landing Page');
  const { updateTheme, resetTheme } = useTheme();
  const { restaurants, selectedRestaurant: restaurantFromContext, setSelectedRestaurant } = useRestaurants();
  const restaurantFromContextRef = React.useRef(restaurantFromContext);

  // Derive unique category groups
  const categoryGroups = useMemo(() => {
    if (!restaurant?.menu) return ['All'];
    const menuCategories = Array.from(new Set(restaurant.menu.map(item => item.categoryGroup).filter(Boolean) as string[]));
    
    if (!restaurant?.categoryOrder) {
        return ['All', ...menuCategories.sort()];
    }

    const orderedGroups = restaurant?.categoryOrder?.filter(group => 
        menuCategories.includes(group)
    );
    const remainingGroups = menuCategories.filter(group => !orderedGroups?.includes(group)).sort();
    
    return ['All', ...orderedGroups, ...remainingGroups];
  }, [restaurant?.menu, restaurant?.categoryOrder]);

  const filteredMenu = useMemo(() => {
    if (!restaurant?.menu) return [];
    return restaurant.menu.filter(item => {
      const matchesCategoryGroup = activeCategoryGroup === 'All' || item.categoryGroup === activeCategoryGroup;
      const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                            item.description.toLowerCase().includes(searchTerm.toLowerCase());
      return matchesCategoryGroup && matchesSearch;
    });
  }, [restaurant?.menu, activeCategoryGroup, searchTerm]);

  useEffect(() => {
    restaurantFromContextRef.current = restaurantFromContext;
  }, [restaurantFromContext]);

  useEffect(() => {
    return () => resetTheme();
  }, [slug, resetTheme]);

  useEffect(() => {
    if (restaurant) {
        setSelectedRestaurant(restaurant);
    }
  }, [restaurant, setSelectedRestaurant]);

  useEffect(() => {
    const unsubGlobal = onSnapshot(doc(db, 'settings', 'landingPage'), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            if (data.homeViewMode) {
                setGlobalHomeViewMode(data.homeViewMode);
            }
        }
    });
    return () => unsubGlobal();
  }, []);

  useEffect(() => {
    if (!slug) return;
    
    setIsLoading(true);
    const q = query(collection(db, 'restaurants'), where('slug', '==', slug));
    const unsubscribe = onSnapshot(q, (snapshot) => {
        if (!snapshot.empty) {
            setRestaurantId(snapshot.docs[0].id);
        } else {
            console.log("Restaurant not found");
            setError(true);
            setRestaurant(null);
            setIsLoading(false);
        }
    }, (err) => {
        console.error("Error fetching restaurant by slug:", err);
        setError(true);
        setIsLoading(false);
    });
    
    return () => unsubscribe();
  }, [slug]);

  useEffect(() => {
    if (!restaurantId) return;

    // A. Basic Data
    const unsubRestaurant = onSnapshot(doc(db, 'restaurants', restaurantId), (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data() as Restaurant;
            setRestaurant(prev => ({
                ...(prev || {} as Restaurant),
                id: restaurantId,
                ...data,
                menu: prev?.menu || []
            }));
        }
    });

    // B. Config Data
    const unsubConfig = onSnapshot(doc(db, 'restaurants', restaurantId, 'config', 'main'), (docSnap) => {
        if (docSnap.exists()) {
            const configData = docSnap.data();
            setRestaurant(prev => {
                if (!prev) return null;
                const mergedTheme = { ...(prev.theme || {}), ...(configData.theme || {}) };
                updateTheme(mergedTheme as ThemeSettings);
                return {
                    ...prev,
                    ...configData,
                    theme: mergedTheme as ThemeSettings
                };
            });
        }
    });

    // C. Menu Data
    const unsubMenu = onSnapshot(collection(db, 'restaurants', restaurantId, 'menu'), (snapshot) => {
        const menuItems = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as MenuItem));
        setRestaurant(prev => {
            if (!prev) return null;
            return { ...prev, menu: menuItems };
        });
        setIsLoading(false);
    });

    return () => {
        unsubRestaurant();
        unsubConfig();
        unsubMenu();
    };
  }, [restaurantId, updateTheme]);



  // Handle Error State (e.g. Deleted while viewing or invalid slug)
  if (!slug && !restaurantFromContext) {
    if (globalHomeViewMode === 'Landing Page') {
        const LandingPage = React.lazy(() => import('../components/LandingPage'));
        return (
            <React.Suspense fallback={<div className="p-8 text-center">Loading...</div>}>
                <LandingPage />
            </React.Suspense>
        );
    }

    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Our Restaurants</h1>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {restaurants.filter(r => r.isActive).map(r => (
            <Link key={r.id} to={`/restaurant/${r.slug}`} className="group bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transform hover:-translate-y-2 transition-transform duration-300">
              <div className="h-48 overflow-hidden">
                <img src={r.bannerImage} alt={r.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
              </div>
              <div className="p-6">
                <div className="flex items-start gap-4">
                  <img src={r.logo} alt={`${r.name} logo`} className="h-12 w-12 rounded-full border-2 border-white -mt-12 shadow-md" />
                  <div>
                    <h3 className="text-xl font-bold text-gray-900">{r.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{r.cuisine.join(', ')}</p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 text-center max-w-md w-full animate-fade-in">
           <div className="bg-red-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
              <AlertCircle className="h-8 w-8 text-red-500" />
           </div>
           <h2 className="text-2xl font-bold text-gray-900 mb-2">Restaurant Unavailable</h2>
           <p className="text-gray-500 mb-6">The restaurant you are looking for does not exist or has been closed.</p>
           <Link to="/" className="inline-flex items-center justify-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-orange-600 hover:bg-orange-700 transition">
             <ChevronLeft className="h-5 w-5 mr-2" />
             Browse Restaurants
           </Link>
        </div>
      </div>
    );
  }

  // Handle Loading State
  if (isLoading || !restaurant) {
    return (
      <div className="min-h-screen pb-20 bg-gray-50">
        {/* Hero Skeleton */}
        <div className="relative pb-6">
          <div className="h-48 md:h-64 bg-gray-200 animate-pulse w-full"></div>
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative -mt-16">
            <div className="bg-white rounded-xl shadow-lg p-6 h-48 animate-pulse border border-gray-100">
               <div className="flex gap-6">
                  <div className="h-24 w-24 bg-gray-200 rounded-lg flex-shrink-0" />
                  <div className="flex-1 space-y-4 pt-2">
                     <div className="h-6 bg-gray-200 rounded w-1/3" />
                     <div className="h-4 bg-gray-200 rounded w-1/4" />
                     <div className="h-4 bg-gray-200 rounded w-1/2" />
                  </div>
               </div>
            </div>
          </div>
        </div>
        
        {/* Menu Grid Skeleton */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 mt-8">
           <div className="h-8 bg-gray-200 rounded w-48 mb-6 animate-pulse" />
           <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
            {[...Array(6)].map((_, index) => (
              <div key={index} className="h-full">
                <MenuSkeleton />
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  const primaryColor = restaurant.theme?.primaryColor || '#ea580c';

  // Group menu items by category
  const groupedMenu = filteredMenu.reduce((acc, item) => {
    const categoryGroup = item.categoryGroup || 'Uncategorized';
    if (!acc[categoryGroup]) {
      acc[categoryGroup] = [];
    }
    acc[categoryGroup].push(item);
    return acc;
  }, {} as Record<string, MenuItem[]>);

  return (
    <div className="min-h-screen pb-20">
      <RestaurantHero restaurant={restaurant} deliveryTime={(restaurant as unknown as import('../types').RestaurantSettings).deliveryTime} />
      
      {/* Sticky Menu Navigation */}
      <div className="sticky top-0 z-0 bg-white shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
           <div className="flex items-center justify-between py-4 gap-4">
              <div className="flex flex-wrap gap-2 md:gap-8">
                 {categoryGroups.map((cat) => (
                    <button
                      key={cat}
                      onClick={() => setActiveCategoryGroup(cat)}
                      style={{ 
                          color: activeCategoryGroup === cat ? primaryColor : undefined,
                          borderColor: activeCategoryGroup === cat ? primaryColor : undefined
                      }}
                      className={`text-sm font-medium pb-2 border-b-2 transition-colors ${
                        activeCategoryGroup === cat 
                        ? '' // Style applied via inline style for dynamic color
                        : 'border-transparent text-gray-500 hover:text-gray-900'
                      }`}
                    >
                      {cat}
                    </button>
                 ))}
              </div>

              <div className="hidden lg:block relative">
                 <input 
                   type="text" 
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                   placeholder="Search menu..."
                   className="pl-9 pr-4 py-1.5 bg-gray-100 rounded-full text-sm focus:ring-1 outline-none w-48"
                   style={{ '--tw-ring-color': primaryColor } as React.CSSProperties}
                 />
                 <Search className="h-3.5 w-3.5 text-gray-400 absolute left-3 top-2.5" />
              </div>
           </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-6 flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
                {activeCategoryGroup === 'All' ? 'Full Menu' : `${activeCategoryGroup} Menu`}
            </h2>
            <span className="text-gray-500 text-sm">{filteredMenu.length} items</span>
        </div>
        
        {filteredMenu.length > 0 ? (
            categoryGroups.filter(cat => cat !== 'All' && groupedMenu[cat]).map(categoryGroup => (
                <div key={categoryGroup} className="mb-8">
                    <h3 className="text-xl font-bold text-gray-800 mb-4 border-b pb-2 border-gray-200">{categoryGroup}</h3>
                    <div className="grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 md:gap-8">
                        {groupedMenu[categoryGroup].map(item => (
                            <div key={item.id} className="h-full">
                                <MenuItemCard item={item} restaurantId={restaurant.id} />
                            </div>
                        ))}
                    </div>
                </div>
            ))
        ) : (
            <div className="text-center py-20">
                <p className="text-gray-500 text-lg">No items found matching your criteria.</p>
                <button 
                  onClick={() => {setActiveCategoryGroup('All'); setSearchTerm('');}}
                  style={{ color: primaryColor }}
                  className="mt-4 font-medium hover:underline"
                >
                    Clear filters
                </button>
            </div>
        )}
      </div>
      
      <div className="fixed bottom-6 left-6 z-30">
        <Link to="/" className="bg-white p-3 rounded-full shadow-lg border border-gray-200 text-gray-600 hover:text-gray-900 transition flex items-center justify-between">
            <ChevronLeft className="h-6 w-6" />
        </Link>
      </div>


    </div>
  );
};

export default RestaurantFrontPage;