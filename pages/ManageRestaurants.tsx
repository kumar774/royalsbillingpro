import React, { useState, useEffect } from 'react';
import { collection, addDoc, doc, setDoc, getDoc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Building2, Save, Loader2, Image as ImageIcon, Share2 } from 'lucide-react';
import { useNavigate, useParams } from 'react-router-dom';
import { Restaurant, SocialLinks } from '../types';
import { toast } from 'react-hot-toast';

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
    // rating: 5.0,
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
                    // rating: data.rating,
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
        // rating: formData.rating,
        bannerImage: formData.bannerImage,
        logo: formData.logo,
        // openingHours: '09:00 AM - 10:00 PM',
        // socialMedia removed from main doc
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

  return (
    <div className="max-w-4xl mx-auto">
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-gray-900">{editId ? 'Edit Restaurant' : 'Add New Restaurant'}</h2>
        <p className="text-gray-500">{editId ? 'Update existing restaurant details.' : 'Create a new restaurant profile to manage.'}</p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
             <Building2 className="h-5 w-5 mr-2 text-gray-400" /> Basic Details
          </h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Restaurant Name</label>
              <input 
                type="text" 
                required
                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g. Burger King"
                value={formData.name}
                onChange={e => setFormData({...formData, name: e.target.value})}
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Cuisines (comma separated)</label>
              <input 
                type="text" 
                required
                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
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
                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                placeholder="e.g. 123 Main St, New York"
                value={formData.location}
                onChange={e => setFormData({...formData, location: e.target.value})}
              />
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
           <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
             <ImageIcon className="h-5 w-5 mr-2 text-gray-400" /> Branding
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Logo URL</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  value={formData.logo}
                  onChange={e => setFormData({...formData, logo: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Banner Image URL</label>
                <input 
                  type="text" 
                  required
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  value={formData.bannerImage}
                  onChange={e => setFormData({...formData, bannerImage: e.target.value})}
                />
              </div>
           </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
           <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
             <Share2 className="h-5 w-5 mr-2 text-gray-400" /> Menu Page Social Links
           </h3>
           <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Instagram URL</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  placeholder="https://instagram.com/..."
                  value={formData.socialLinks.instagram || ''}
                  onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                  placeholder="https://facebook.com/..."
                  value={formData.socialLinks.facebook || ''}
                  onChange={e => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Twitter/X URL</label>
                <input 
                  type="text" 
                  className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
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
             className="flex items-center bg-orange-600 hover:bg-orange-700 text-white font-medium py-3 px-8 rounded-xl transition shadow-lg shadow-orange-200 disabled:opacity-70"
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