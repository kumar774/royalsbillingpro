import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Building2, Save, Loader2, Image as ImageIcon, Share2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Restaurant, SocialLinks } from '../types';
import { toast } from 'react-hot-toast';
import { deleteRestaurantWithAllData } from '../src/utils/dbCleanup';
const ManageRestaurants: React.FC = () => {
  const navigate = useNavigate();
  const { restaurantId, editId } = useParams<{ restaurantId: string; editId?: string }>();
  
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    cuisine: '', 
    location: '',
    logo: 'https://picsum.photos/seed/restaurant/100/100',
    bannerImage: 'https://picsum.photos/seed/banner/1200/400',
    isActive: true,
    socialLinks: {
        instagram: '',
        facebook: '',
        twitter: ''
    } as SocialLinks
  });

  useEffect(() => {
    if (editId) {
        const fetchRestaurant = async () => {
            const docRef = doc(db, 'restaurants', editId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data() as Restaurant;
                
                // Fetch config for social media
                let socialLinks = { instagram: '', facebook: '', twitter: '' };
                try {
                    const configRef = doc(db, 'restaurants', editId, 'config', 'main');
                    const configSnap = await getDoc(configRef);
                    if (configSnap.exists()) {
                        const configData = configSnap.data();
                        if (configData.socialLinks) {
                            socialLinks = { ...socialLinks, ...configData.socialLinks };
                        }
                    }
                } catch (err) {
                    console.error("Error fetching config:", err);
                }

                setFormData({
                    name: data.name,
                    cuisine: data.cuisine.join(', '),
                    location: data.location,
                    logo: data.logo,
                    bannerImage: data.bannerImage,
                    isActive: data.isActive !== undefined ? data.isActive : true,
                    socialLinks: socialLinks
                });
            }
        };
        fetchRestaurant();
    }
  }, [editId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const toastId = toast.loading("Saving restaurant...");

    try {
      const slug = formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
      
      const restaurantData = {
        name: formData.name,
        slug: slug,
        cuisine: formData.cuisine.split(',').map(c => c.trim()),
        location: formData.location,
        bannerImage: formData.bannerImage,
        logo: formData.logo,
        isActive: formData.isActive
      };

      let targetId = editId;

      if (editId) {
        const docRef = doc(db, 'restaurants', editId);
        await updateDoc(docRef, restaurantData);
      } else {
        const docRef = await addDoc(collection(db, 'restaurants'), {
            ...restaurantData,
            menu: [] 
        });
        targetId = docRef.id;
        await setDoc(doc(db, 'restaurants', targetId), { ...restaurantData, id: targetId, menu: [] }, {merge: true});
      }

      // Save to config/main
      if (targetId) {
          const configRef = doc(db, 'restaurants', targetId, 'config', 'main');
          const configUpdate: Record<string, unknown> = {
              socialLinks: formData.socialLinks
          };
          
          // If new restaurant, initialize order numbering
          if (!editId) {
              configUpdate.nextOrderNumber = 1;
              configUpdate.orderIdPrefix = 'ORD-';
          }

          await setDoc(configRef, configUpdate, { merge: true });
      }

      toast.success(editId ? "Restaurant updated successfully" : "New restaurant created!", { id: toastId });
      
      if (editId) {
          navigate(`/dashboard/${restaurantId}/restaurants`);
      } else {
          navigate(`/dashboard/${targetId}`);
      }

    } catch (error) {
      console.error("Error saving restaurant:", error);
      toast.error("Failed to save: " + (error as Error).message, { id: toastId });
    } finally {
      setLoading(false);
    }
  };

  const generatedSlug = formData.name
    ? formData.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '')
    : 'your-restaurant-name';

  const [deletingId, setDeletingId] = useState<string | null>(null);

const handleDelete = async (restaurantId: string, restaurantName: string) => {
  const confirmDelete = window.confirm(
    `Kya aap "${restaurantName}" restaurant aur usse जुड़ा SARA data (Orders, Menu, Staff, Expenses) hamesha ke liye delete karna chahte hain?`
  );
  if (!confirmDelete) return;

  try {
    setDeletingId(restaurantId);
    await deleteRestaurantWithAllData(restaurantId);
    alert(`"${restaurantName}" aur uska sara data successfully delete kar diya gaya hai.`);
    // Agar aapke component me local state hai jo restaurants list ko hold karti hai, toh use update karein:
    // setRestaurants(prev => prev.filter(r => r.id !== restaurantId));
    window.location.reload(); // Page refresh karke list update karne ke liye
  } catch (error) {
    console.error("Delete failed:", error);
    alert("Restaurant delete karne me koi error aaya hai.");
  } finally {
    setDeletingId(null);
  }
};

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{editId ? 'Edit Restaurant Profile' : 'Add New Restaurant'}</h2>
        
        <p className="text-gray-500">{editId ? 'Update existing restaurant details.' : 'Create a new restaurant profile to manage.'}</p>
        <button
    type="button"
    onClick={(e) => {
      e.stopPropagation();
      handleDelete(restaurant.id, restaurant.name);
    }}
    disabled={deletingId === restaurant.id}
    title="Delete Restaurant & All Data"
    style={{
      background: '#fee2e2',
      color: '#dc2626',
      border: 'none',
      padding: '6px 10px',
      borderRadius: '6px',
      cursor: 'pointer',
      marginLeft: '8px'
    }}
  >
    {deletingId === restaurant.id ? 'Deleting...' : '🗑️ Delete'}
  </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Basic Details */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-6 space-y-6">
          <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b border-gray-100 flex items-center">
             <Building2 className="h-5 w-5 mr-2 text-orange-500" /> Basic Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
              <input 
                type="text" 
                required
                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="e.g. Burger King"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
              <p className="text-xs text-orange-600 mt-1.5 font-bold flex items-center gap-1">
                <span>Public Link:</span>
                <span className="bg-orange-50 px-1.5 py-0.5 rounded border border-orange-100 font-mono">#/restaurant/{generatedSlug}</span>
              </p>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuisines (comma separated)</label>
              <input 
                type="text" 
                required
                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="e.g. Fast Food, Burgers, American"
                value={formData.cuisine}
                onChange={e => setFormData({...formData, cuisine: e.target.value})}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Location / Address</label>
              <input 
                type="text" 
                required
                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="e.g. 123 Main St, New York"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
              />
            </div>

            {/* Is Active Status Switch */}
            <div className="flex items-center pt-6">
              <label className="flex items-center cursor-pointer">
                <input 
                  type="checkbox"
                  className="sr-only peer"
                  checked={formData.isActive}
                  onChange={(e) => setFormData({...formData, isActive: e.target.checked})}
                />
                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                <span className="ms-3 text-sm font-bold text-gray-700">Publish Restaurant (Is Active)</span>
              </label>
            </div>
          </div>
        </div>

        {/* Branding & Image Previews */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-6 space-y-6">
           <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b border-gray-100 flex items-center">
             <ImageIcon className="h-5 w-5 mr-2 text-orange-500" /> Branding & Previews
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Logo Image URL</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                  value={formData.logo}
                  onChange={e => setFormData({...formData, logo: e.target.value})}
                />
                {formData.logo && (
                  <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-200 w-fit">
                    <img 
                      src={formData.logo} 
                      alt="Logo preview" 
                      className="h-14 w-14 rounded-full object-cover border border-gray-300 bg-white" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                    <div className="text-left">
                      <span className="text-xs font-bold text-gray-500 block">Logo Image Preview</span>
                      <span className="text-[10px] text-gray-400">Loads dynamically from link</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-medium text-gray-700">Banner Image URL</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                  value={formData.bannerImage}
                  onChange={e => setFormData({...formData, bannerImage: e.target.value})}
                />
                {formData.bannerImage && (
                  <div className="bg-gray-50 p-3 rounded-xl border border-gray-200 space-y-1">
                    <img 
                      src={formData.bannerImage} 
                      alt="Banner preview" 
                      className="h-20 w-full rounded-lg object-cover border border-gray-300 bg-white" 
                      onError={(e) => { e.currentTarget.style.display = 'none'; }} 
                    />
                    <div className="flex justify-between items-center text-[10px] text-gray-400 font-bold">
                      <span>Banner Image Preview</span>
                      <span>1200x400 Ratio recommended</span>
                    </div>
                  </div>
                )}
              </div>
           </div>
        </div>

        {/* Social Media Links */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-150 p-6 space-y-6">
           <h3 className="text-lg font-semibold text-gray-900 pb-2 border-b border-gray-100 flex items-center">
             <Share2 className="h-5 w-5 mr-2 text-orange-500" /> Menu Page Social Links
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="https://instagram.com/..."
                  value={formData.socialLinks.instagram || ''}
                  onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facebook URL</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="https://facebook.com/..."
                  value={formData.socialLinks.facebook || ''}
                  onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twitter/X URL</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                  placeholder="https://twitter.com/..."
                  value={formData.socialLinks.twitter || ''}
                  onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, twitter: e.target.value}})}
                />
              </div>
           </div>
        </div>

        <div className="flex justify-end pt-4">
           <button
             type="submit"
             disabled={loading}
             className="flex items-center bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-8 rounded-xl transition shadow-lg shadow-orange-200 disabled:opacity-70 cursor-pointer"
           >
             {loading ? (
                <>
                  <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" /> Saving...
                </>
             ) : (
                <>
                  <Save className="mr-2 h-5 w-5" /> {editId ? 'Update Restaurant' : 'Create Restaurant'}
                </>
             )}
           </button>
        </div>
      </form>
    </div>
  );
};

export default ManageRestaurants;
