import React, { createContext, useContext, useState, useEffect, ReactNode, useMemo, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Restaurant } from '../types';

interface RestaurantContextType {
  restaurants: Restaurant[];
  selectedRestaurant: Restaurant | null;
  setSelectedRestaurant: (restaurant: Restaurant | null) => void;
  loading: boolean;
}

const RestaurantContext = createContext<RestaurantContextType | undefined>(undefined);

export const RestaurantProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [restaurants, setRestaurants] = useState<Restaurant[]>([]);
  const [selectedRestaurant, setSelectedRestaurantState] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);

  const setSelectedRestaurant = useCallback((restaurant: Restaurant | null) => {
    setSelectedRestaurantState(prev => {
      if (prev?.id === restaurant?.id) return prev;
      return restaurant;
    });
  }, []);

  useEffect(() => {
    const q = query(collection(db, 'restaurants'), orderBy('name'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      } as Restaurant));
      
      setRestaurants(data);

      setSelectedRestaurantState(prev => {
        if (prev) {
          const stillExists = data.find(r => r.id === prev.id);
          if (!stillExists) return null;
          
          // Deep comparison to allow real-time updates without loops
          // If content is identical, return prev to maintain reference stability
          const currentData = JSON.stringify(stillExists);
          const prevData = JSON.stringify(prev);
          if (currentData === prevData) return prev;
          
          return stillExists;
        }
        return prev;
      });

      setLoading(false);
    });

    return () => unsubscribe();
  }, []); // Removed selectedRestaurant from dependencies to fix loop

  const value = useMemo(() => ({
    restaurants,
    selectedRestaurant,
    setSelectedRestaurant,
    loading
  }), [restaurants, selectedRestaurant, loading]);

  return (
    <RestaurantContext.Provider value={value}>
      {children}
    </RestaurantContext.Provider>
  );
};

export const useRestaurants = () => {
  const context = useContext(RestaurantContext);
  if (!context) throw new Error('useRestaurants must be used within a RestaurantProvider');
  return context;
};
