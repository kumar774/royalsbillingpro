import React, { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useRestaurants } from '../context/RestaurantContext';
import { Edit, Plus, Loader2, ExternalLink, AlertTriangle, Settings } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-hot-toast';

const RestaurantList: React.FC = () => {
  const { restaurants, loading } = useRestaurants();
  const navigate = useNavigate();
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);






  const handleStatusChange = async (id: string, currentStatus: boolean | undefined) => {
    setUpdatingStatus(id);
    const newStatus = currentStatus === undefined ? false : !currentStatus;
    try {
      const restaurantRef = doc(db, 'restaurants', id);
      await updateDoc(restaurantRef, { isActive: newStatus });
      toast.success(`Restaurant status updated to ${newStatus ? 'Active' : 'Disabled'}.`);
    } catch (err) {
      toast.error('Failed to update status: ' + (err as Error).message);
    } finally {
      setUpdatingStatus(null);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Restaurant Management</h2>
          <p className="text-gray-500 text-sm">View and manage all registered restaurants.</p>
        </div>
        <div className="flex gap-2">
            <button 
            onClick={() => navigate(`/dashboard/${restaurantId}/restaurants/new`)}
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition shadow-sm"
            >
            <Plus className="h-4 w-4 mr-2" /> Add Restaurant
            </button>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Restaurant</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Location</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Contact</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Live Link</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
               {restaurants.map((r) => (
                 <tr key={r.id} className="hover:bg-gray-50 transition">
                   <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                         <div className="h-10 w-10 flex-shrink-0">
                            <img className="h-10 w-10 rounded-full object-cover border border-gray-200 bg-gray-100" src={r.logo} alt="" />
                         </div>
                         <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{r.name}</div>
                            <div className="text-xs text-gray-500">ID: {r.id.substring(0,6)}...</div>
                         </div>
                      </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {r.location}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {r.contact || 'N/A'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-orange-600">
                      <a href={`#/restaurant/${r.slug}`} target="_blank" rel="noreferrer" className="flex items-center hover:underline">
                         View <ExternalLink className="h-3 w-3 ml-1" />
                      </a>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <div className="flex items-center justify-end gap-4">
                        {/* Status Toggle */}
                        <button
                          onClick={() => handleStatusChange(r.id, r.isActive)}
                          disabled={updatingStatus === r.id}
                          className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-orange-500 focus:ring-offset-2 ${
                            r.isActive ? 'bg-green-600' : 'bg-gray-200'
                          }`}
                        >
                          {updatingStatus === r.id ? (
                            <Loader2 className="h-5 w-5 animate-spin text-white p-0.5" />
                          ) : (
                            <span
                              className={`inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                                r.isActive ? 'translate-x-5' : 'translate-x-0'
                              }`}
                            />
                          )}
                        </button>

                        {/* Settings Button */}
                        <button 
                          onClick={() => navigate(`/dashboard/${restaurantId}/restaurants/config/${r.id}`)}
                          className="text-gray-600 hover:text-gray-900"
                          title="Settings"
                        >
                          <Settings className="h-4 w-4" />
                        </button>

                        {/* Edit Button */}
                        <button 
                          onClick={() => navigate(`/dashboard/${restaurantId}/restaurants/edit/${r.id}`)}
                          className="text-indigo-600 hover:text-indigo-900"
                          title="Edit"
                        >
                          <Edit className="h-4 w-4" />
                        </button>
                      </div>
                   </td>
                 </tr>
               ))}
               {restaurants.length === 0 && (
                   <tr>
                       <td colSpan={5} className="px-6 py-10 text-center text-gray-500">
                           <div className="flex flex-col items-center justify-center p-4">
                               <AlertTriangle className="h-8 w-8 text-yellow-500 mb-2" />
                               <p>No restaurants found.</p>
                           </div>
                       </td>
                   </tr>
               )}
             </tbody>
           </table>
        </div>
      </div>
    </div>
  );
};

export default RestaurantList;