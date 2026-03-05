import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { CartItem, MenuItem } from '../types';

interface CartContextType {
  items: CartItem[];
  restaurantId: string | null;
  addItem: (item: MenuItem, restaurantId: string) => void;
  removeItem: (cartItemId: string) => void;
  updateQuantity: (cartItemId: string, delta: number) => void;
  getItemQuantity: (itemId: string) => number;
  clearCart: () => void;
  totalItems: number;
  totalPrice: number;
  isOpen: boolean;
  toggleCart: () => void;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  // Load cart from local storage
  useEffect(() => {
    const savedCart = localStorage.getItem('cravewave_cart');
    const savedRestId = localStorage.getItem('cravewave_cart_rid');
    if (savedCart) {
      try {
        setItems(JSON.parse(savedCart));
      } catch (e) {
        console.error("Failed to parse cart", e);
      }
    }
    if (savedRestId) setRestaurantId(savedRestId);
  }, []);

  // Save to local storage
  useEffect(() => {
    localStorage.setItem('cravewave_cart', JSON.stringify(items));
    if (restaurantId) {
      localStorage.setItem('cravewave_cart_rid', restaurantId);
    } else {
      localStorage.removeItem('cravewave_cart_rid');
    }
  }, [items, restaurantId]);

  const addItem = (item: MenuItem, rid: string) => {
    // If adding from a different restaurant, clear previous cart (Simple logic)
    if (restaurantId && restaurantId !== rid) {
      if (window.confirm("Start a new basket? You have items from another restaurant.")) {
        setItems([]); // Clear existing items
        setRestaurantId(rid);
        // Proceed to add the new item after clearing
      } else {
        return; // User cancelled, do not add item
      }
    }

    if (!restaurantId) setRestaurantId(rid);

    setItems(prev => {
      const cartItemId = item.id + (item.selectedVariant?.size ? `-${item.selectedVariant.size}` : '');

      const existing = prev.find(i => i.cartItemId === cartItemId);

      if (existing) {
        return prev.map(i => 
          i.cartItemId === cartItemId
            ? { ...i, quantity: i.quantity + 1 } 
            : i
        );
      }
      return [...prev, { 
        ...item, 
        cartItemId, // Add the unique identifier
        quantity: 1, 
        price: item.selectedVariant?.price || item.price 
      }];
    });
    setIsOpen(true);
  };

  const removeItem = (cartItemId: string) => {
    setItems(prev => {
      const newItems = prev.filter(i => i.cartItemId !== cartItemId);
      if (newItems.length === 0) setRestaurantId(null);
      return newItems;
    });
  };

  const updateQuantity = (cartItemId: string, delta: number) => {
    setItems(prev => {
      const updatedItems = prev.map(i => {
        if (i.cartItemId === cartItemId) {
          const newQty = i.quantity + delta;
          return { ...i, quantity: newQty };
        }
        return i;
      }).filter(i => i.quantity > 0);

      if (updatedItems.length === 0) {
        setRestaurantId(null);
      }
      return updatedItems;
    });
  };

  const getItemQuantity = (itemId: string) => {
    return items.filter(i => i.id === itemId).reduce((sum, i) => sum + i.quantity, 0);
  };

  const clearCart = () => {
    setItems([]);
    setRestaurantId(null);
  };

  const toggleCart = () => setIsOpen(prev => !prev);

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + ((item.selectedVariant?.price || item.price) * item.quantity), 0);

  return (
    <CartContext.Provider value={{ items, restaurantId, addItem, removeItem, updateQuantity, getItemQuantity, clearCart, totalItems, totalPrice, isOpen, toggleCart }}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) throw new Error('useCart must be used within a CartProvider');
  return context;
};
