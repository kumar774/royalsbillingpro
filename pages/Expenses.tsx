import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, addDoc, onSnapshot, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Expense, ExpenseItem, RolePermissions } from '../types';
import { Plus, Trash2, DollarSign, Tag, Calendar, FileText, Edit2, Info, ShoppingCart, Users, Home, Zap, Wrench, Megaphone, X, ChevronDown, ChevronUp, Download, Search, Filter } from 'lucide-react';
import { toast } from 'react-hot-toast';

interface ExpensesProps {
  permissions?: RolePermissions;
}

const Expenses: React.FC<ExpensesProps> = ({ permissions }) => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [isItemized, setIsItemized] = useState(false);
  const [itemizedRows, setItemizedRows] = useState<ExpenseItem[]>([{ name: '', amount: 0 }]);

  // Filters State
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Expandable row state
  const [expandedExpenseIds, setExpandedExpenseIds] = useState<Set<string>>(new Set());

  // Delete safety state
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

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
      const data = snapshot.docs.map(doc => {
        const item = doc.data();
        return {
          id: doc.id,
          ...item,
          // Format date to local standard
          date: item.date ? (item.date.includes('T') ? item.date : new Date(item.date).toISOString()) : new Date().toISOString()
        } as Expense;
      });
      setExpenses(data);
    });

    return () => unsubscribe();
  }, [restaurantId]);

  // Overall totals
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);
  
  const thisMonthExpenses = expenses
    .filter(e => {
      const expDate = new Date(e.date);
      const now = new Date();
      return expDate.getMonth() === now.getMonth() && expDate.getFullYear() === now.getFullYear();
    })
    .reduce((acc, e) => acc + e.amount, 0);

  const todayExpenses = expenses
    .filter(e => new Date(e.date).toDateString() === new Date().toDateString())
    .reduce((acc, e) => acc + e.amount, 0);

  const itemizedTotal = itemizedRows.reduce((acc, row) => acc + (parseFloat(row.amount.toString()) || 0), 0);

  // Filters Logic
  const filteredExpenses = expenses.filter(e => {
    const matchesSearch = e.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          (e.note && e.note.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const matchesCategory = selectedCategory === 'All' || e.category === selectedCategory;

    const expDateStr = new Date(e.date).toISOString().split('T')[0];
    const matchesStartDate = !startDate || expDateStr >= startDate;
    const matchesEndDate = !endDate || expDateStr <= endDate;

    return matchesSearch && matchesCategory && matchesStartDate && matchesEndDate;
  });

  const filteredTotal = filteredExpenses.reduce((acc, e) => acc + e.amount, 0);

  // Category summary calculations for progress bars
  const categorySummary = React.useMemo(() => {
    const summary: Record<string, number> = {};
    expenses.forEach(e => {
      summary[e.category] = (summary[e.category] || 0) + e.amount;
    });
    return Object.entries(summary)
      .map(([name, amount]) => ({
        name,
        amount,
        percentage: totalExpenses > 0 ? (amount / totalExpenses) * 100 : 0
      }))
      .sort((a, b) => b.amount - a.amount);
  }, [expenses, totalExpenses]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!restaurantId) return;

    if (permissions) {
      if (editingId && !permissions.expenses.edit) {
        toast.error("You do not have permission to edit expenses.");
        return;
      }
      if (!editingId && !permissions.expenses.add) {
        toast.error("You do not have permission to add expenses.");
        return;
      }
    }

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
    } catch (error: any) {
      console.error("Error saving expense", error);
      toast.error("Failed to save expense: " + error.message, { id: toastId });
    }
  };

  const handleEdit = (expense: Expense) => {
    if (permissions && !permissions.expenses.edit) {
      toast.error("You do not have permission to edit expenses.");
      return;
    }
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
    if (permissions && !permissions.expenses.delete) {
      toast.error("You do not have permission to delete expenses.");
      return;
    }
    if (!restaurantId) return;
    const toastId = toast.loading("Deleting expense...");
    try {
        await deleteDoc(doc(db, 'restaurants', restaurantId, 'expenses', id));
        toast.success("Expense deleted", { id: toastId });
    } catch {
        toast.error("Failed to delete expense", { id: toastId });
    }
  };

  const toggleRow = (id: string) => {
    const newExpanded = new Set(expandedExpenseIds);
    if (newExpanded.has(id)) {
      newExpanded.delete(id);
    } else {
      newExpanded.add(id);
    }
    setExpandedExpenseIds(newExpanded);
  };

  const handleExportCSV = () => {
    if (filteredExpenses.length === 0) {
      toast.error("No expenses to export.");
      return;
    }

    const headers = ["Date", "Title", "Category", "Note", "Is Itemized", "Amount (INR)"];
    const rows = filteredExpenses.map(e => [
      new Date(e.date).toLocaleDateString(),
      `"${e.title.replace(/"/g, '""')}"`,
      e.category,
      e.note ? `"${e.note.replace(/"/g, '""')}"` : "",
      e.isItemized ? "Yes" : "No",
      e.amount.toFixed(2)
    ]);

    const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(r => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `expenses_${restaurantId || 'export'}_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("CSV exported successfully");
  };

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Inventory': return <ShoppingCart className="h-4 w-4" />;
      case 'Salary':
      case 'Staff Salary': return <Users className="h-4 w-4" />;
      case 'Staff Advance': return <DollarSign className="h-4 w-4" />;
      case 'Rent': return <Home className="h-4 w-4" />;
      case 'Utilities': return <Zap className="h-4 w-4" />;
      case 'Maintenance': return <Wrench className="h-4 w-4" />;
      case 'Marketing': return <Megaphone className="h-4 w-4" />;
      default: return <Tag className="h-4 w-4" />;
    }
  };

  const uniqueCategories = Array.from(new Set(expenses.map(e => e.category)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Expense Management</h2>
          <p className="text-gray-500 text-sm">Track your daily operational costs.</p>
        </div>
        <div className="flex items-center gap-3">
          <button 
            onClick={handleExportCSV}
            className="border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 px-4 py-2 rounded-lg font-medium flex items-center transition text-sm cursor-pointer shadow-sm"
          >
            <Download className="h-4 w-4 mr-2 text-gray-500" /> Export CSV
          </button>
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
            className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg font-medium flex items-center transition text-sm cursor-pointer shadow-sm"
          >
            {isAdding ? <X className="h-4 w-4 mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
            {isAdding ? 'Close Form' : 'Log Expense'}
          </button>
        </div>
      </div>

      {/* Summary Section: Stats + Visual Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Stats Cards */}
        <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Expenses</p>
            <h3 className="text-2xl font-black text-gray-900 mt-2">₹{totalExpenses.toFixed(2)}</h3>
            <span className="text-[10px] text-gray-400 mt-4 block">Lifetime operational costs</span>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">This Month</p>
            <h3 className="text-2xl font-black text-orange-600 mt-2">₹{thisMonthExpenses.toFixed(2)}</h3>
            <span className="text-[10px] text-orange-400 mt-4 block">Current calendar month</span>
          </div>
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col justify-between">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Today</p>
            <h3 className="text-2xl font-black text-red-600 mt-2">₹{todayExpenses.toFixed(2)}</h3>
            <span className="text-[10px] text-red-400 mt-4 block">Total logged today</span>
          </div>
        </div>

        {/* Category Breakdown Progress Bars */}
        <div className="bg-white p-5 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Expenses by Category</h4>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-[160px] pr-1 no-scrollbar">
            {categorySummary.map(item => (
              <div key={item.name} className="space-y-1">
                <div className="flex justify-between text-xs font-medium text-gray-700">
                  <span className="flex items-center gap-1.5 capitalize">
                    {getCategoryIcon(item.name)} {item.name}
                  </span>
                  <span>₹{item.amount.toFixed(0)} ({item.percentage.toFixed(0)}%)</span>
                </div>
                <div className="w-full bg-gray-100 h-2 rounded-full overflow-hidden">
                  <div className="bg-orange-500 h-full rounded-full" style={{ width: `${item.percentage}%` }} />
                </div>
              </div>
            ))}
            {categorySummary.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-6">No data logged yet.</p>
            )}
          </div>
        </div>
      </div>

      {/* Form Section */}
      {isAdding && (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 animate-fade-in">
          <div className="flex justify-between items-center mb-6">
            <h3 className="text-lg font-bold text-gray-900">{editingId ? 'Edit Expense Log' : 'Log New Expense'}</h3>
            <div className="flex items-center gap-2 bg-gray-100 p-1.5 rounded-lg">
              <button 
                type="button"
                onClick={() => setIsItemized(false)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${!isItemized ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Single
              </button>
              <button 
                type="button"
                onClick={() => setIsItemized(true)}
                className={`px-3 py-1 text-xs font-bold rounded-md transition-all cursor-pointer ${isItemized ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-500 hover:text-gray-800'}`}
              >
                Itemized List
              </button>
            </div>
          </div>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="col-span-1 md:col-span-2">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Expense Title</label>
                <div className="relative">
                  <FileText className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                  <input 
                    required
                    type="text" 
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="e.g. Weekly Vegetable Supply"
                    value={formData.title}
                    onChange={e => setFormData({...formData, title: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Category</label>
                <div className="relative">
                  <Tag className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                  <select 
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none bg-white cursor-pointer"
                    value={formData.category}
                    onChange={e => setFormData({...formData, category: e.target.value})}
                  >
                    <option>Inventory</option>
                    <option>Rent</option>
                    <option>Utilities</option>
                    <option>Maintenance</option>
                    <option>Marketing</option>
                    <option>Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Date</label>
                <div className="relative">
                  <Calendar className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                  <input 
                    type="date" 
                    required
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none cursor-pointer"
                    value={formData.date}
                    onChange={e => setFormData({...formData, date: e.target.value})}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1">Note (Optional)</label>
                <input 
                  type="text" 
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                  placeholder="Additional details..."
                  value={formData.note}
                  onChange={e => setFormData({...formData, note: e.target.value})}
                />
              </div>
            </div>

            {isItemized ? (
              <div className="space-y-3 bg-gray-50 p-4 rounded-xl border border-gray-200">
                <div className="flex justify-between items-center">
                  <h4 className="text-xs font-bold text-gray-500 uppercase tracking-wider">Itemized List</h4>
                  <button 
                    type="button"
                    onClick={() => setItemizedRows([...itemizedRows, { name: '', amount: 0 }])}
                    className="text-xs font-bold text-orange-600 hover:text-orange-700 flex items-center cursor-pointer"
                  >
                    <Plus className="h-3.5 w-3.5 mr-1" /> Add Row
                  </button>
                </div>
                {itemizedRows.map((row, index) => (
                  <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-3 items-end">
                    <div>
                      <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Item Name</label>
                      <input 
                        required
                        type="text"
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
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
                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Amount (₹)</label>
                        <input 
                          required
                          type="number"
                          step="0.01"
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none text-sm"
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
                          className="p-2 text-gray-400 hover:text-red-600 mt-6 cursor-pointer"
                        >
                          <Trash2 className="h-4.5 w-4.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                <div className="pt-3 border-t border-gray-200 flex justify-end">
                  <div className="text-right">
                    <p className="text-xs font-semibold text-gray-400">Total Calculated Amount</p>
                    <p className="text-lg font-black text-gray-900">₹{itemizedTotal.toFixed(2)}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="md:w-1/3">
                <label className="block text-sm font-semibold text-gray-700 mb-1">Amount (₹)</label>
                <div className="relative">
                  <DollarSign className="absolute left-3 top-2.5 h-4.5 w-4.5 text-gray-400" />
                  <input 
                    required
                    type="number" 
                    step="0.01"
                    className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="0.00"
                    value={formData.amount}
                    onChange={e => setFormData({...formData, amount: e.target.value})}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4 border-t border-gray-100">
               <button 
                 type="button" 
                 onClick={() => {
                   setIsAdding(false);
                   setEditingId(null);
                 }}
                 className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg font-medium cursor-pointer"
               >
                 Cancel
               </button>
               <button 
                 type="submit"
                 className="px-6 py-2 bg-orange-600 text-white font-medium rounded-lg hover:bg-orange-700 shadow-sm cursor-pointer"
               >
                 {editingId ? 'Update Expense' : 'Save Log'}
               </button>
            </div>
          </form>
        </div>
      )}

      {/* Filters & Control Bar */}
      <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 space-y-4">
        <div className="flex items-center space-x-2 text-xs font-bold text-gray-400 uppercase tracking-wider">
          <Filter className="h-3.5 w-3.5" /> <span>Filters & Search</span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Search title or notes..."
              value={searchTerm}
              onChange={e => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-500"
            />
          </div>

          {/* Category Filter */}
          <div>
            <select
              value={selectedCategory}
              onChange={e => setSelectedCategory(e.target.value)}
              className="w-full px-3 py-2 text-xs border border-gray-200 rounded-lg outline-none focus:border-orange-500 bg-white cursor-pointer"
            >
              <option value="All">All Categories</option>
              <option value="Inventory">Inventory</option>
              <option value="Staff Salary">Staff Salary</option>
              <option value="Staff Advance">Staff Advance</option>
              <option value="Rent">Rent</option>
              <option value="Utilities">Utilities</option>
              <option value="Maintenance">Maintenance</option>
              <option value="Marketing">Marketing</option>
              {uniqueCategories
                .filter(cat => !['Inventory', 'Staff Salary', 'Staff Advance', 'Rent', 'Utilities', 'Maintenance', 'Marketing'].includes(cat))
                .map(cat => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              <option value="Other">Other</option>
            </select>
          </div>

          {/* Start Date */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase w-fit shrink-0">From:</span>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none cursor-pointer"
            />
          </div>

          {/* End Date */}
          <div className="flex items-center space-x-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase w-fit shrink-0">To:</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="w-full px-2 py-1.5 text-xs border border-gray-200 rounded-lg outline-none cursor-pointer"
            />
          </div>
        </div>

        {/* Filters Reset & Helper Indicator */}
        {(searchTerm || selectedCategory !== 'All' || startDate || endDate) && (
          <div className="flex flex-wrap justify-between items-center bg-orange-50 p-2.5 rounded-xl border border-orange-100 gap-2">
            <span className="text-xs font-medium text-orange-700">
              Found **{filteredExpenses.length}** records matching filters (Filtered Total: **₹{filteredTotal.toFixed(2)}**)
            </span>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('All');
                setStartDate('');
                setEndDate('');
              }}
              className="text-xs font-bold text-orange-600 hover:text-orange-700 bg-white border border-orange-200 px-3 py-1 rounded-lg cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Expense List */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
         <div className="overflow-x-auto">
           <table className="min-w-full divide-y divide-gray-150">
             <thead className="bg-gray-50">
               <tr>
                 <th className="w-10 px-4 py-3"></th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Date</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Title</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Category</th>
                 <th className="px-6 py-3 text-left text-xs font-bold text-gray-400 uppercase tracking-wider">Note</th>
                 <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Amount</th>
                 <th className="px-6 py-3 text-right text-xs font-bold text-gray-400 uppercase tracking-wider">Action</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-150">
               {filteredExpenses.map((expense) => {
                 const isExpanded = expandedExpenseIds.has(expense.id);
                 return (
                   <React.Fragment key={expense.id}>
                     <tr className="hover:bg-gray-50 group transition-colors duration-150">
                       {/* Dropdown Chevron */}
                       <td className="px-4 py-4 text-center">
                         {expense.isItemized && (
                           <button
                             onClick={() => toggleRow(expense.id)}
                             className="p-1 hover:bg-gray-150 rounded text-gray-500 cursor-pointer"
                           >
                             {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                           </button>
                         )}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600 font-medium">
                         {new Date(expense.date).toLocaleDateString()}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex flex-col">
                           <span className="text-sm font-semibold text-gray-800">{expense.title}</span>
                           {expense.isItemized && expense.items && (
                             <span className="text-[10px] text-orange-600 uppercase font-extrabold tracking-wider mt-0.5">
                               {expense.items.length} items logged
                             </span>
                           )}
                         </div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap">
                         <div className="flex items-center gap-2 px-2.5 py-1 text-xs rounded-full bg-gray-50 text-gray-600 border border-gray-200 w-fit font-medium">
                           {getCategoryIcon(expense.category)}
                           <span>{expense.category}</span>
                         </div>
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                         {expense.note ? (
                           <span className="max-w-[200px] truncate block text-gray-600 font-medium">{expense.note}</span>
                         ) : (
                           <span className="text-gray-300">-</span>
                         )}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-sm font-extrabold text-red-600 text-right">
                         -₹{expense.amount.toFixed(2)}
                       </td>
                       <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                         <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                           <button 
                             onClick={() => handleEdit(expense)} 
                             className="p-1.5 text-gray-400 hover:text-orange-600 hover:bg-orange-50 rounded-lg transition cursor-pointer"
                             title="Edit Expense"
                           >
                             <Edit2 className="h-4 w-4" />
                           </button>
                           <button 
                             onClick={() => setDeleteConfirmId(expense.id)} 
                             className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition cursor-pointer"
                             title="Delete Expense"
                           >
                             <Trash2 className="h-4 w-4" />
                           </button>
                         </div>
                       </td>
                     </tr>

                     {/* Expanded Row Content */}
                     {isExpanded && expense.isItemized && expense.items && (
                       <tr className="bg-gray-50">
                         <td colSpan={7} className="px-12 py-3">
                           <div className="bg-white rounded-xl border border-gray-150 p-4 space-y-2.5 shadow-inner">
                             <div className="text-[10px] font-bold text-gray-400 uppercase tracking-widest border-b border-gray-100 pb-1">
                               Itemized Breakdown
                             </div>
                             <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-1.5">
                               {expense.items.map((item, idx) => (
                                 <div key={idx} className="flex justify-between items-center text-xs border-b border-gray-50 pb-1 last:border-0">
                                   <span className="font-semibold text-gray-600">{item.name}</span>
                                   <span className="font-bold text-gray-800">₹{item.amount.toFixed(2)}</span>
                                 </div>
                               ))}
                             </div>
                             <div className="flex justify-between items-center pt-2 border-t border-gray-100 text-xs">
                               <span className="font-bold text-gray-500">Calculated Subtotal</span>
                               <span className="font-black text-gray-900 text-sm">₹{expense.amount.toFixed(2)}</span>
                             </div>
                           </div>
                         </td>
                       </tr>
                     )}
                   </React.Fragment>
                 );
               })}
               {filteredExpenses.length === 0 && (
                 <tr>
                   <td colSpan={7} className="px-6 py-12 text-center text-gray-400">
                     <Info className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                     <p className="text-sm font-medium">No expenses match the current criteria.</p>
                   </td>
                 </tr>
               )}
             </tbody>
           </table>
         </div>
      </div>

      {/* Safety Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-6 animate-scale-in">
            <div className="text-center mb-5">
              <div className="bg-red-50 p-3 rounded-full text-red-600 w-fit mx-auto mb-3">
                <Trash2 className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Expense?</h3>
              <p className="text-sm text-gray-500 mt-1">Are you sure you want to delete this expense record? This action cannot be undone.</p>
            </div>
            <div className="flex space-x-3">
              <button 
                onClick={() => setDeleteConfirmId(null)}
                className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-semibold text-sm transition cursor-pointer"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  handleDelete(deleteConfirmId);
                  setDeleteConfirmId(null);
                }}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold text-sm shadow-sm transition cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
