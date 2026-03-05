import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Expense } from '../types';
import { Plus, Trash2, DollarSign, Tag, Calendar, FileText } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Expenses: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAdding, setIsAdding] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    category: 'Inventory',
    date: new Date().toISOString().split('T')[0],
    note: ''
  });

  useEffect(() => {
    if (!restaurantId) return;

    const q = query(collection(db, 'restaurants', restaurantId, 'expenses'), orderBy('date', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Expense));
      setExpenses(data);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const toastId = toast.loading("Adding expense...");

    try {
      await addDoc(collection(db, 'restaurants', restaurantId, 'expenses'), {
        ...formData,
        amount: parseFloat(formData.amount),
        date: new Date(formData.date).toISOString()
      });
      setIsAdding(false);
      setFormData({
        title: '',
        amount: '',
        category: 'Inventory',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });
      toast.success("Expense logged successfully", { id: toastId });
    } catch (error) {
      console.error("Error adding expense", error);
      toast.error("Failed to add expense: " + error.message, { id: toastId });
    }
  };

  const handleDelete = async (id: string) => {
    if (!restaurantId) return;
    // Direct delete or use confirmation
    try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'expenses', id));
        toast.success("Expense deleted");
    } catch {
        toast.error("Failed to delete expense");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expense Management</h2>
          <p className="text-gray-500 text-sm">Track your daily operational costs.</p>
        </div>
        <button 
          onClick={() => setIsAdding(!isAdding)}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition"
        >
          <Plus className="h-4 w-4 mr-2" /> Log Expense
        </button>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in">
          <h3 className="text-lg font-bold text-gray-900 mb-4">Add New Expense</h3>
          <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="col-span-1 md:col-span-2">
               <label className="block text-sm font-medium text-gray-700 mb-1">Expense Title</label>
               <div className="relative">
                 <FileText className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                 <input 
                   required
                   type="text" 
                   className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                   placeholder="e.g. Weekly Vegetable Supply"
                   value={formData.title}
                   onChange={e => setFormData({...formData, title: e.target.value})}
                 />
               </div>
            </div>
            
            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
               <div className="relative">
                 <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                 <input 
                   required
                   type="number" 
                   step="0.01"
                   className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                   placeholder="0.00"
                   value={isNaN(parseFloat(formData.amount)) ? '0' : formData.amount}
                   onChange={e => setFormData({...formData, amount: e.target.value === '' ? '0' : (parseFloat(e.target.value) || 0).toString()})}
                 />
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
               <div className="relative">
                 <Tag className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                 <select 
                   className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                   value={formData.category}
                   onChange={e => setFormData({...formData, category: e.target.value})}
                 >
                   <option>Inventory</option>
                   <option>Salary</option>
                   <option>Rent</option>
                   <option>Utilities</option>
                   <option>Maintenance</option>
                   <option>Marketing</option>
                   <option>Other</option>
                 </select>
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
               <div className="relative">
                 <Calendar className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                 <input 
                   type="date" 
                   required
                   className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                   value={formData.date}
                   onChange={e => setFormData({...formData, date: e.target.value})}
                 />
               </div>
            </div>

            <div>
               <label className="block text-sm font-medium text-gray-700 mb-1">Note (Optional)</label>
               <input 
                 type="text" 
                 className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                 placeholder="Additional details..."
                 value={formData.note}
                 onChange={e => setFormData({...formData, note: e.target.value})}
               />
            </div>

            <div className="md:col-span-3 flex justify-end gap-3 mt-2">
               <button 
                 type="button" 
                 onClick={() => setIsAdding(false)}
                 className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
               >
                 Cancel
               </button>
               <button 
                 type="submit"
                 className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm"
               >
                 Save Expense
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Expense List */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Note</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Action</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200">
               {expenses.map((expense) => (
                 <tr key={expense.id} className="hover:bg-gray-50">
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     {new Date(expense.date).toLocaleDateString()}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                     {expense.title}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200">
                       {expense.category}
                     </span>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 max-w-xs truncate">
                     {expense.note || '-'}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                     -₹{expense.amount.toFixed(2)}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                     <button onClick={() => handleDelete(expense.id)} className="text-gray-400 hover:text-red-600">
                       <Trash2 className="h-4 w-4" />
                     </button>
                   </td>
                 </tr>
               ))}
               {expenses.length === 0 && (
                 <tr>
                   <td colSpan={6} className="px-6 py-10 text-center text-gray-500">
                     No expenses recorded.
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

export default Expenses;