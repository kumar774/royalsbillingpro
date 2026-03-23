import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Expense, ExpenseItem } from '../types';
import { Plus, Trash2, DollarSign, Tag, Calendar, FileText, Edit2, Info, ShoppingCart, Users, Home, Zap, Wrench, Megaphone, X } from 'lucide-react';
import { toast } from 'react-hot-toast';

const Expenses: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isItemized, setIsItemized] = useState(false);
  const [itemizedRows, setItemizedRows] = useState<ExpenseItem[]>([{ name: '', amount: 0 }]);

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

  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  const thisMonthExpenses = expenses
    .filter(e => new Date(e.date).getMonth() === new Date().getMonth() && new Date(e.date).getFullYear() === new Date().getFullYear())
    .reduce((acc, e) => acc + e.amount, 0);
  const todayExpenses = expenses
    .filter(e => new Date(e.date).toDateString() === new Date().toDateString())
    .reduce((acc, e) => acc + e.amount, 0);

  const itemizedTotal = itemizedRows.reduce((acc, row) => acc + (parseFloat(row.amount.toString()) || 0), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;
    const toastId = toast.loading(editingId ? "Updating expense..." : "Adding expense...");

    try {
      const expenseData = {
        ...formData,
        amount: isItemized ? itemizedTotal : parseFloat(formData.amount),
        date: new Date(formData.date).toISOString(),
        isItemized,
        items: isItemized ? itemizedRows.map(row => ({ ...row, amount: parseFloat(row.amount.toString()) })) : []
      };

      if (editingId) {
        await updateDoc(doc(db, 'restaurants', restaurantId, 'expenses', editingId), expenseData);
        toast.success("Expense updated successfully", { id: toastId });
      } else {
        await addDoc(collection(db, 'restaurants', restaurantId, 'expenses'), expenseData);
        toast.success("Expense logged successfully", { id: toastId });
      }

      setIsAdding(false);
      setEditingId(null);
      setIsItemized(false);
      setItemizedRows([{ name: '', amount: 0 }]);
      setFormData({
        title: '',
        amount: '',
        category: 'Inventory',
        date: new Date().toISOString().split('T')[0],
        note: ''
      });
    } catch (error) {
      console.error("Error saving expense", error);
      toast.error("Failed to save expense: " + error.message, { id: toastId });
    }
  };

  const handleEdit = (expense: Expense) => {
    setEditingId(expense.id);
    setFormData({
      title: expense.title,
      amount: expense.amount.toString(),
      category: expense.category,
      date: new Date(expense.date).toISOString().split('T')[0],
      note: expense.note || ''
    });
    setIsItemized(expense.isItemized || false);
    if (expense.isItemized && expense.items) {
      setItemizedRows(expense.items);
    } else {
      setItemizedRows([{ name: '', amount: 0 }]);
    }
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!restaurantId) return;
    // Removed window.confirm as per guidelines to avoid iframe restrictions
    const toastId = toast.loading("Deleting expense...");
    try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'expenses', id));
        toast.success("Expense deleted", { id: toastId });
    } catch {
        toast.error("Failed to delete expense", { id: toastId });
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Inventory': return <ShoppingCart className="h-4 w-4" />;
      case 'Salary': return <Users className="h-4 w-4" />;
      case 'Rent': return <Home className="h-4 w-4" />;
      case 'Utilities': return <Zap className="h-4 w-4" />;
      case 'Maintenance': return <Wrench className="h-4 w-4" />;
      case 'Marketing': return <Megaphone className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
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
          onClick={() => {
            setIsAdding(!isAdding);
            if (isAdding) {
              setEditingId(null);
              setIsItemized(false);
              setItemizedRows([{ name: '', amount: 0 }]);
              setFormData({
                title: '',
                amount: '',
                category: 'Inventory',
                date: new Date().toISOString().split('T')[0],
                note: ''
              });
            }
          }}
          className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition"
        >
          {isAdding ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
          {isAdding ? 'Close Form' : 'Log Expense'}
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Total Expenses</p>
          <h3 className="text-xl font-bold text-gray-900 mt-1">₹{totalExpenses.toFixed(2)}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">This Month</p>
          <h3 className="text-xl font-bold text-orange-600 mt-1">₹{thisMonthExpenses.toFixed(2)}</h3>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wider">Today</p>
          <h3 className="text-xl font-bold text-red-600 mt-1">₹{todayExpenses.toFixed(2)}</h3>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 animate-fade-in">
          <div className="flex justify-between items-center mb-4">
            <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Expense' : 'Add New Expense'}</h3>
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-gray-600">Single</span>
              <button 
                type="button"
                onClick={() => setIsItemized(!isItemized)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${isItemized ? 'bg-red-600' : 'bg-gray-200'}`}
              >
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${isItemized ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
              <span className="text-sm font-medium text-gray-600">Itemized</span>
            </div>
          </div>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
            </div>

            {isItemized ? (
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center">
                  <h4 className="text-sm font-bold text-gray-700 uppercase tracking-wider">Itemized List</h4>
                  <button 
                    type="button"
                    onClick={() => setItemizedRows([...itemizedRows, { name: '', amount: 0 }])}
                    className="text-xs font-bold text-red-600 hover:text-red-700 flex items-center"
                  >
                    <Plus className="h-3 w-3 mr-1" /> Add Item
                  </button>
                </div>
                {itemizedRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Item Name</label>
                      <input 
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                        placeholder="e.g. Tomato"
                        value={row.name}
                        onChange={e => {
                          const newRows = [...itemizedRows];
                          newRows[index].name = e.target.value;
                          setItemizedRows(newRows);
                        }}
                      />
                    </div>
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <label className="block text-[10px] font-bold text-gray-500 uppercase mb-1">Amount (₹)</label>
                        <input 
                          required
                          type="number"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500 text-sm"
                          placeholder="0.00"
                          value={row.amount || ''}
                          onChange={e => {
                            const newRows = [...itemizedRows];
                            newRows[index].amount = parseFloat(e.target.value) || 0;
                            setItemizedRows(newRows);
                          }}
                        />
                      </div>
                      {itemizedRows.length > 1 && (
                        <button 
                          type="button"
                          onClick={() => setItemizedRows(itemizedRows.filter((_, i) => i !== index))}
                          className="p-2 text-gray-400 hover:text-red-600 mt-6"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-200 flex justify-end">
                  <div className="text-right">
                    <p className="text-xs font-medium text-gray-500">Total Amount</p>
                    <p className="text-lg font-bold text-gray-900">₹{itemizedTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="md:w-1/3">
                <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-red-500 focus:border-red-500"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
               <button 
                 type="button" 
                 onClick={() => {
                   setIsAdding(false);
                   setEditingId(null);
                 }}
                 className="px-4 py-2 text-gray-700 font-medium hover:bg-gray-100 rounded-lg"
               >
                 Cancel
               </button>
               <button 
                 type="submit"
                 className="px-6 py-2 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 shadow-sm"
               >
                 {editingId ? 'Update Expense' : 'Save Expense'}
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
                 <tr key={expense.id} className="hover:bg-gray-50 group">
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     {new Date(expense.date).toLocaleDateString()}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="flex flex-col">
                       <span className="text-sm font-medium text-gray-900">{expense.title}</span>
                       {expense.isItemized && expense.items && (
                         <span className="text-[10px] text-gray-400 uppercase font-bold">
                           {expense.items.length} items
                         </span>
                       )}
                     </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap">
                     <div className="flex items-center gap-2 px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-700 border border-gray-200 w-fit">
                       {getCategoryIcon(expense.category)}
                       {expense.category}
                     </div>
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                     {expense.note ? (
                       <div className="group/note relative flex items-center gap-1 cursor-help">
                         <Info className="h-4 w-4 text-blue-400" />
                         <span className="max-w-[150px] truncate">{expense.note}</span>
                         <div className="absolute bottom-full left-0 mb-2 hidden group-hover/note:block z-50 w-48 p-2 bg-gray-900 text-white text-[10px] rounded shadow-lg">
                           {expense.note}
                         </div>
                       </div>
                     ) : (
                       <span className="text-gray-300">-</span>
                     )}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-red-600 text-right">
                     -₹{expense.amount.toFixed(2)}
                   </td>
                   <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                     <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                       <button 
                         onClick={() => handleEdit(expense)} 
                         className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                         title="Edit Expense"
                       >
                         <Edit2 className="h-4 w-4" />
                       </button>
                       <button 
                         onClick={() => handleDelete(expense.id)} 
                         className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                         title="Delete Expense"
                       >
                         <Trash2 className="h-4 w-4" />
                       </button>
                     </div>
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
