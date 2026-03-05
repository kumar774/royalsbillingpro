import React, { useState } from 'react';
import Modal from 'react-modal';
import { Star } from 'lucide-react';
import { MenuItem } from '../types';
import { useCart } from '../context/CartContext';


interface MenuItemCardProps {
  item: MenuItem;
  restaurantId: string;
  onSelectVariant?: (item: MenuItem, selectedVariant: { name: string; price: number }) => void; // New prop to handle variant selection (optional)
}

// Set app element for react-modal
Modal.setAppElement('#root'); // Assuming your root element has id 'root'

const MenuItemCard: React.FC<MenuItemCardProps> = ({ item, restaurantId, onSelectVariant }) => {
  const { addItem, updateQuantity, getItemQuantity } = useCart();
  const [showVariantModal, setShowVariantModal] = useState(false);
  const [selectedVariant, setSelectedVariant] = useState<{ name: string; price: number } | null>(null);

  const quantity = getItemQuantity(item.id);

  const addToCart = () => {
    if (item.variants && item.variants.length > 1) {
      setShowVariantModal(true);
    } else if (item.variants && item.variants.length === 1) {
      // Add the single variant directly
      const variant = item.variants[0];
      addItem({ ...item, selectedVariant: variant, price: variant.price }, restaurantId);
    } else {
      addItem(item, restaurantId);
    }
  };

  const removeFromCart = () => {
    // For items without variants, cartItemId is just item.id
    // For items with variants, this logic might need to be more specific if we want to decrement a specific one
    // but usually MenuItemCard for items with variants just shows "Add"
    const cartItemId = item.id + (selectedVariant?.name ? `-${selectedVariant.name}` : '');
    updateQuantity(cartItemId, -1);
  };

  const handleSelectVariantAndAddToCart = (variant: { name: string; price: number }) => {
    setSelectedVariant(variant);
    if (onSelectVariant) {
      onSelectVariant(item, variant);
    } else {
      addItem({ ...item, selectedVariant: variant, price: variant.price }, restaurantId);
    }
    setShowVariantModal(false);
  };

  return (
    <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100 hover:shadow-md transition-shadow flex justify-between gap-4 h-full">
      <div className="flex flex-col justify-between flex-1">
        <div>
          <div className="flex items-start space-x-2">
            
            {item.isBestseller && (
              <span className="text-xs font-bold text-yellow-600 bg-yellow-50 px-1.5 py-0.5 rounded">
                Bestseller
              </span>
            )}
          </div>
          
          <h3 className="font-bold text-gray-900 mt-2 text-sm">{item.name}</h3>
          <div className="font-semibold text-gray-700 mt-1">₹{item.price.toFixed(2)}</div>
          
          {item.rating && (
            <div className="flex items-center mt-1">
               <div className="flex text-xs text-yellow-500">
                 {[...Array(5)].map((_, i) => (
                   <Star key={i} className={`h-3 w-3 ${i < Math.round(item.rating!) ? 'fill-current' : 'text-gray-300'}`} />
                 ))}
               </div>
               <span className="text-xs text-gray-400 ml-1">({item.votes})</span>
            </div>
          )}

          <p className="text-gray-500 text-sm mt-3 line-clamp-2">{item.description}</p>
        </div>
      </div>

      <div className="flex flex-col items-center space-y-3 relative w-25 flex-shrink-0">
        <div className="w-20 h-16 rounded-xl overflow-hidden relative bg-gray-100">
           <img src={item.image} className="w-full h-full object-cover" />
        </div>
        
        <div className="absolute -bottom-3 w-24 shadow-lg bg-white rounded-lg overflow-hidden border border-gray-100">
          {item.variants && item.variants.length > 0 ? (
            <button 
              onClick={addToCart}
              className="w-full py-2 text-green-600 font-bold text-sm hover:bg-green-50 uppercase"
            >
              Add
            </button>
          ) : quantity === 0 ? (
            <button 
              onClick={addToCart}
              className="w-full py-2 text-green-600 font-bold text-sm hover:bg-green-50 uppercase"
            >
              Add
            </button>
          ) : (
            <div className="flex items-center justify-between bg-white w-full">
              <button 
                onClick={removeFromCart}
                className="px-3 py-2 text-gray-500 hover:text-green-600 hover:bg-green-50 font-bold text-lg"
              >
                -
              </button>
              <span className="text-sm font-bold text-green-700">{quantity}</span>
              <button 
                onClick={addToCart}
                className="px-3 py-2 text-green-600 hover:bg-green-50 font-bold text-lg"
              >
                +
              </button>
            </div>
          )}
        </div>
      </div>

      <Modal
        isOpen={showVariantModal}
        onRequestClose={() => setShowVariantModal(false)}
        className="fixed inset-0 z-50 flex items-center justify-center p-4"
        overlayClassName="fixed inset-0 bg-black/60 backdrop-blur-sm"
      >
        <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center animate-fade-in">
          <h3 className="text-xl font-bold text-gray-900 mb-4">Select Size for {item.name}</h3>
          <div className="space-y-3 mb-6">
            {item.variants?.map((variant, idx) => (
              <button
                key={idx}
                onClick={() => handleSelectVariantAndAddToCart(variant)}
                className="w-full flex items-center justify-between p-3 rounded-lg border border-gray-200 hover:bg-gray-50 transition"
              >
                <span className="font-medium text-gray-800">{variant.name}</span>
                <span className="font-semibold text-gray-900">₹{variant.price.toFixed(2)}</span>
              </button>
            ))}
          </div>
          <button
            onClick={() => setShowVariantModal(false)}
            className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
          >
            Cancel
          </button>
        </div>
      </Modal>
    </div>
  );
};

export default MenuItemCard;