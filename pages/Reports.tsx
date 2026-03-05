import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Expense, Order } from '../types';
import { Printer, TrendingUp, TrendingDown, DollarSign, Download, BarChart3, PieChart as PieChartIcon } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';
import * as XLSX from 'xlsx';

const Reports: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Date Filters
  const [range, setRange] = useState<'today' | 'week' | 'month' | 'custom'>('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');

  useEffect(() => {
    if (!restaurantId) return;

    // Fetch All Data (Client-side filtering for flexibility on reports)
    const unsubOrders = onSnapshot(collection(db, 'restaurants', restaurantId, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ id: d.id, ...d.data() } as Order)));
    });

    const unsubExpenses = onSnapshot(collection(db, 'restaurants', restaurantId, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => ({ id: d.id, ...d.data() } as Expense)));
    });

    return () => { unsubOrders(); unsubExpenses(); };
  }, [restaurantId]);

  // Filtering Logic
  const getFilteredData = () => {
    const now = new Date();
    const start = new Date();
    const end = new Date();

    if (range === 'today') {
      start.setHours(0,0,0,0);
      end.setHours(23,59,59,999);
    } else if (range === 'week') {
      start.setDate(now.getDate() - 7);
      end.setHours(23,59,59,999);
    } else if (range === 'month') {
      start.setDate(1); // First day of month
      end.setHours(23,59,59,999);
    } else if (range === 'custom' && customStart && customEnd) {
      const s = new Date(customStart);
      const e = new Date(customEnd);
      e.setHours(23,59,59,999);
      return { start: s, end: e };
    }

    return { start, end };
  };

  const { start, end } = getFilteredData();

  const filteredOrders = orders.filter(o => {
    const d = new Date(o.createdAt);
    return d >= start && d <= end && o.status !== 'Cancelled';
  });

  const filteredExpenses = expenses.filter(e => {
    const d = new Date(e.date);
    return d >= start && d <= end;
  });

  // Calculations
  const totalRevenue = filteredOrders.reduce((sum, o) => sum + o.total, 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + e.amount, 0);
  const netProfit = totalRevenue - totalExpenses;

  // Top Selling Items Logic
  const itemSalesMap = new Map<string, { name: string, quantity: number, revenue: number }>();
  filteredOrders.forEach(order => {
    order.items.forEach(item => {
      const existing = itemSalesMap.get(item.id) || { name: item.name, quantity: 0, revenue: 0 };
      existing.quantity += item.quantity;
      existing.revenue += (item.price * item.quantity);
      itemSalesMap.set(item.id, existing);
    });
  });

  const topItemsData = Array.from(itemSalesMap.values())
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const handlePrint = () => {
    window.print();
  };

  const exportToExcel = () => {
    // Sheet 1: Summary
    const summaryData = [
      ['Financial Summary Report'],
      ['Restaurant', restaurantId],
      ['Period', `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`],
      [''],
      ['Metric', 'Value'],
      ['Total Revenue', totalRevenue],
      ['Total Orders', filteredOrders.length],
      ['Total Expenses', totalExpenses],
      ['Net Profit', netProfit],
    ];
    const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);

    // Sheet 2: Sales
    const salesData = [
      ['Date', 'Order ID', 'Customer', 'Phone Number', 'Items', 'Amount', 'Payment Mode', 'Status'],
      ...filteredOrders.map(o => [
        new Date(o.createdAt).toLocaleString(),
        o.customId || o.id,
        o.customerName,
        o.customerPhone || 'N/A',
        o.items.map(i => `${i.quantity}x ${i.name}`).join(', '),
        o.total,
        o.paymentMethod,
        o.status
      ])
    ];
    const wsSales = XLSX.utils.aoa_to_sheet(salesData);

    // Sheet 3: Expenses
    const expensesData = [
      ['Date', 'Title', 'Category', 'Amount'],
      ...filteredExpenses.map(e => [
        new Date(e.date).toLocaleDateString(),
        e.title,
        e.category,
        e.amount
      ])
    ];
    const wsExpenses = XLSX.utils.aoa_to_sheet(expensesData);

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, wsSummary, "Summary");
    XLSX.utils.book_append_sheet(wb, wsSales, "Sales");
    XLSX.utils.book_append_sheet(wb, wsExpenses, "Expenses");
    
    XLSX.writeFile(wb, `Restaurant_Report_${range}_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8 print:p-0 print:space-y-4">
      {/* Header & Controls (Hidden on Print) */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Financial Reports</h2>
          <p className="text-gray-500 text-sm">Analyze your profit and loss statements.</p>
        </div>
        
        <div className="flex flex-wrap gap-2 items-center">
           <div className="flex bg-white border border-gray-200 rounded-lg overflow-hidden">
              <button onClick={() => setRange('today')} className={`px-3 py-1.5 text-sm ${range === 'today' ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}`}>Today</button>
              <button onClick={() => setRange('week')} className={`px-3 py-1.5 text-sm ${range === 'week' ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}`}>7 Days</button>
              <button onClick={() => setRange('month')} className={`px-3 py-1.5 text-sm ${range === 'month' ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}`}>This Month</button>
              <button onClick={() => setRange('custom')} className={`px-3 py-1.5 text-sm ${range === 'custom' ? 'bg-gray-100 font-bold' : 'hover:bg-gray-50'}`}>Custom</button>
           </div>
           
           {range === 'custom' && (
             <div className="flex gap-2">
               <input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="text-sm border rounded px-2 py-1" />
               <input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="text-sm border rounded px-2 py-1" />
             </div>
           )}

           <button onClick={handlePrint} className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium flex items-center border border-gray-200">
             <Printer className="h-4 w-4 mr-2" /> Print
           </button>

           <button onClick={exportToExcel} className="bg-orange-600 hover:bg-orange-700 text-white px-4 py-2 rounded-lg text-sm font-medium flex items-center shadow-sm">
             <Download className="h-4 w-4 mr-2" /> Excel Export
           </button>
        </div>
      </div>

      {/* Printable Header */}
      <div className="hidden print:block text-center mb-6">
        <h1 className="text-3xl font-bold text-gray-900">Restaurant Performance Report</h1>
        <p className="text-gray-500">Period: {start.toLocaleDateString()} - {end.toLocaleDateString()}</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 print:grid-cols-3">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:border-gray-300">
           <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{totalRevenue.toFixed(2)}</h3>
              </div>
              <div className="bg-green-100 p-2 rounded-lg">
                <TrendingUp className="h-5 w-5 text-green-600" />
              </div>
           </div>
           <p className="text-xs text-gray-400 mt-2">{filteredOrders.length} orders</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:border-gray-300">
           <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                <h3 className="text-2xl font-bold text-red-600 mt-1">₹{totalExpenses.toFixed(2)}</h3>
              </div>
              <div className="bg-red-100 p-2 rounded-lg">
                <TrendingDown className="h-5 w-5 text-red-600" />
              </div>
           </div>
           <p className="text-xs text-gray-400 mt-2">{filteredExpenses.length} records</p>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 print:border-gray-300">
           <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-500">Net Profit</p>
                <h3 className={`text-2xl font-bold mt-1 ${netProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  ₹{netProfit.toFixed(2)}
                </h3>
              </div>
              <div className="bg-blue-100 p-2 rounded-lg">
                <DollarSign className="h-5 w-5 text-blue-600" />
              </div>
           </div>
           <p className="text-xs text-gray-400 mt-2">Revenue - Expenses</p>
        </div>
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:hidden">
        {/* Top Selling Items Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center">
              <BarChart3 className="h-5 w-5 mr-2 text-orange-600" /> Top Selling Items
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topItemsData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="name" fontSize={10} />
                <YAxis fontSize={10} />
                <Tooltip 
                  contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }}
                />
                <Bar dataKey="quantity" fill="#FF5722" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Revenue vs Expenses Pie Chart */}
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-6">
            <h3 className="font-bold text-gray-900 flex items-center">
              <PieChartIcon className="h-5 w-5 mr-2 text-orange-600" /> Revenue vs Expenses
            </h3>
          </div>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={[
                    { name: 'Revenue', value: totalRevenue },
                    { name: 'Expenses', value: totalExpenses }
                  ]}
                  cx="50%"
                  cy="50%"
                  innerRadius={60}
                  outerRadius={80}
                  paddingAngle={5}
                  dataKey="value"
                >
                  <Cell fill="#4CAF50" />
                  <Cell fill="#F44336" />
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-6 mt-4">
              <div className="flex items-center text-xs font-medium text-gray-600">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-2"></div> Revenue
              </div>
              <div className="flex items-center text-xs font-medium text-gray-600">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-2"></div> Expenses
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Tables */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 print:grid-cols-1 print:gap-4">
        {/* Income Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-gray-300">
           <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
             <h3 className="font-bold text-gray-900">Income Breakdown (Top 10)</h3>
           </div>
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Total</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 text-sm">
               {filteredOrders.slice(0, 10).map(o => (
                 <tr key={o.id}>
                   <td className="px-6 py-3 text-gray-900 font-mono text-xs">#{o.id.slice(0,6)}</td>
                   <td className="px-6 py-3 text-gray-500">{new Date(o.createdAt).toLocaleDateString()}</td>
                   <td className="px-6 py-3 text-right font-medium text-green-600">+₹{o.total.toFixed(2)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>

        {/* Expense Table */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:border-gray-300">
           <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
             <h3 className="font-bold text-gray-900">Expense Breakdown</h3>
           </div>
           <table className="min-w-full divide-y divide-gray-200">
             <thead className="bg-gray-50">
               <tr>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Title</th>
                 <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                 <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
               </tr>
             </thead>
             <tbody className="divide-y divide-gray-200 text-sm">
               {filteredExpenses.map(e => (
                 <tr key={e.id}>
                   <td className="px-6 py-3 text-gray-900">{e.title}</td>
                   <td className="px-6 py-3 text-gray-500">{e.category}</td>
                   <td className="px-6 py-3 text-right font-medium text-red-600">-₹{e.amount.toFixed(2)}</td>
                 </tr>
               ))}
             </tbody>
           </table>
        </div>
      </div>
      
      <div className="hidden print:block text-center text-sm text-gray-400 mt-8">
        Generated by CraveWave POS System on {new Date().toLocaleString()}
      </div>
    </div>
  );
};

export default Reports;
