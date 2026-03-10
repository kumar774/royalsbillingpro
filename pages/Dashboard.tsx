import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, LayoutDashboard, Menu, Settings as SettingsIcon, LogOut, ExternalLink, Calculator, ShoppingBag, TrendingUp, PieChart, FileText, Wallet, Store, ChevronDown, PlusCircle } from 'lucide-react';
import { auth, db } from '../firebase/config';
import { collection, onSnapshot } from 'firebase/firestore';
import { Order, Expense } from '../types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, PieChart as RePie, Pie, Cell, Legend } from 'recharts';
import MenuManager from './MenuManager';
import Settings from './Settings';
import POS from './POS';
import Orders from './Orders';
import Expenses from './Expenses';
import Reports from './Reports';
import CRM from './CRM';
import ManageRestaurants from './ManageRestaurants';
import RestaurantList from './RestaurantList';
import { useRestaurants } from '../context/RestaurantContext';
import RestaurantConfig from './RestaurantConfig';

interface DashboardProps {
  view: 'overview' | 'menu' | 'settings' | 'pos' | 'orders' | 'expenses' | 'reports' | 'restaurants' | 'restaurants-new' | 'restaurants-edit' | 'restaurants-config' | 'customers';
}

const Dashboard: React.FC<DashboardProps> = ({ view }) => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { restaurants } = useRestaurants();

  // Analytics State
  const [orders, setOrders] = useState<Order[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  
  // Colors for Charts
  const COLORS = ['#ea580c', '#f97316', '#fb923c', '#fdba74', '#ffedd5'];

  useEffect(() => {
    if (view !== 'overview' || !restaurantId) return;

    const unsubOrders = onSnapshot(collection(db, 'restaurants', restaurantId, 'orders'), (snap) => {
      setOrders(snap.docs.map(d => ({ ...d.data() } as Order)));
    });
    
    const unsubExpenses = onSnapshot(collection(db, 'restaurants', restaurantId, 'expenses'), (snap) => {
      setExpenses(snap.docs.map(d => ({ ...d.data() } as Expense)));
    });

    return () => { unsubOrders(); unsubExpenses(); };
  }, [restaurantId, view]);

  const handleSignOut = () => {
    auth.signOut().then(() => navigate('/login'));
  };

  const NavItem = ({ to, icon: Icon, label, active }: { to: string, icon: React.ElementType, label: string, active: boolean }) => (
    <Link 
      to={to} 
      className={`flex items-center px-4 py-3 rounded-lg font-medium transition mb-1
        ${active 
            ? 'bg-orange-50 text-orange-600' 
            : 'text-gray-600 hover:bg-gray-50'}`}
    >
      <Icon className={`h-5 w-5 mr-3 ${active ? 'text-orange-600' : 'text-gray-400'}`} /> 
      {label}
    </Link>
  );

  const activeRestaurant = restaurants.find(r => r.id === restaurantId);

  // --- Calculations for Overview ---
  // --- Calculations for Overview ---
  const today = new Date().toDateString();
  
  // Sales & Revenue
  const todayOrders = orders.filter(o => new Date(o.createdAt).toDateString() === today);
  const todaySale = todayOrders.reduce((acc, o) => acc + o.total, 0);
  const totalRevenue = orders.reduce((acc, o) => acc + o.total, 0);

  // Expenses
  const todayExpensesAmount = expenses
    .filter(e => new Date(e.date).toDateString() === today) // Note: types.ts ke hisaab se e.date use hota hai
    .reduce((acc, e) => acc + e.amount, 0);
  const totalExpenses = expenses.reduce((acc, e) => acc + e.amount, 0);

  // Helper for Chart
  const getDailySales = (dateStr: string) => orders.filter(o => new Date(o.createdAt).toDateString() === dateStr).reduce((acc, o) => acc + o.total, 0);

  // Weekly Trend Data
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });
  
  const trendData = last7Days.map(date => ({
    name: date.toLocaleDateString('en-US', { weekday: 'short' }),
    sales: getDailySales(date.toDateString())
  }));

  // Category Data
  const categoryDataRaw: Record<string, number> = {};
  orders.forEach(o => {
    o.items.forEach(i => {
      categoryDataRaw[i.category] = (categoryDataRaw[i.category] || 0) + i.quantity;
    });
  });
  const categoryData = Object.keys(categoryDataRaw).map(k => ({ name: k, value: categoryDataRaw[k] }));

  // Rev vs Exp Data
  const financialData = [
    { name: 'Total', Revenue: totalRevenue, Expenses: totalExpenses }
  ];

  return (
    <div className="min-h-screen bg-gray-100 flex font-sans">
      {/* Sidebar */}
      <aside className="w-64 bg-white shadow-xl shadow-gray-200/50 flex-shrink-0 hidden md:flex flex-col z-10 print:hidden">
        <div className="p-6 flex items-center space-x-2 border-b border-gray-100">
          <div className="bg-orange-600 p-1.5 rounded-lg">
             <UtensilsCrossed className="h-5 w-5 text-white" />
          </div>
          <span className="text-xl font-bold text-gray-800 tracking-tight">Admin Portal</span>
        </div>
        
        <nav className="flex-1 p-4 space-y-1">
          <NavItem to={`/dashboard/${restaurantId}`} icon={LayoutDashboard} label="Dashboard" active={view === 'overview'} />
          <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Operations</div>
          <NavItem to={`/dashboard/${restaurantId}/pos`} icon={Calculator} label="POS System" active={view === 'pos'} />
          <NavItem to={`/dashboard/${restaurantId}/orders`} icon={ShoppingBag} label="Live Orders" active={view === 'orders'} />
          <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Management</div>
          <NavItem to={`/dashboard/${restaurantId}/menu`} icon={Menu} label="Menu Manager" active={view === 'menu'} />
          <NavItem to={`/dashboard/${restaurantId}/expenses`} icon={Wallet} label="Expenses" active={view === 'expenses'} />
          <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Admin</div>
          <NavItem to={`/dashboard/${restaurantId}/restaurants`} icon={Store} label="Restaurants" active={view === 'restaurants' || view === 'restaurants-new' || view === 'restaurants-edit'} />
          <NavItem to={`/dashboard/${restaurantId}/reports`} icon={FileText} label="Reports" active={view === 'reports'} />
          <NavItem to={`/dashboard/${restaurantId}/customers`} icon={FileText} label="CRM & Analytics" active={view === 'customers'} />
          <NavItem to={`/dashboard/${restaurantId}/settings`} icon={SettingsIcon} label="Settings" active={view === 'settings'} />
        </nav>

        <div className="p-4 border-t border-gray-100">
           <button onClick={handleSignOut} className="flex items-center w-full px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 rounded-lg transition">
             <LogOut className="h-4 w-4 mr-3" /> Sign Out
           </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Header */}
        <header className="bg-white shadow-sm h-16 flex items-center px-8 justify-between z-10 print:hidden">
           {/* Restaurant Switcher */}
           <div className="flex items-center space-x-4">
             <div className="relative group">
               <button className="flex items-center space-x-3 hover:bg-gray-50 p-2 rounded-lg transition border border-transparent hover:border-gray-200">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-gray-100 border border-gray-200">
                     {activeRestaurant?.logo ? (
                       <img src={activeRestaurant.logo} alt="Logo" className="h-full w-full object-cover" />
                     ) : (
                       <Store className="h-5 w-5 m-1.5 text-gray-400" />
                     )}
                  </div>
                  <div className="text-left">
                     <p className="text-sm font-bold text-gray-900 leading-none">{activeRestaurant?.name || 'Select Restaurant'}</p>
                     <p className="text-xs text-gray-500 mt-0.5">ID: {restaurantId?.substring(0,8)}...</p>
                  </div>
                  <ChevronDown className="h-4 w-4 text-gray-400" />
               </button>

               {/* Dropdown Menu */}
               <div className="absolute top-full left-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 py-2 hidden group-hover:block animate-fade-in z-50">
                  <div className="px-4 py-2 text-xs font-semibold text-gray-400 uppercase tracking-wider">Switch Restaurant</div>
                  {restaurants.map(r => (
                    <button 
                      key={r.id}
                      onClick={() => navigate(`/dashboard/${r.id}`)}
                      className={`w-full text-left px-4 py-3 flex items-center space-x-3 hover:bg-gray-50 transition ${r.id === restaurantId ? 'bg-orange-50' : ''}`}
                    >
                      <img src={r.logo} className="h-6 w-6 rounded-full bg-gray-200 object-cover" alt="" />
                      <span className={`text-sm font-medium ${r.id === restaurantId ? 'text-orange-700' : 'text-gray-700'}`}>{r.name}</span>
                    </button>
                  ))}
                  <div className="border-t border-gray-100 mt-2 pt-2 px-2">
                     <button 
                       onClick={() => navigate(`/dashboard/${restaurantId}/restaurants/new`)}
                       className="w-full flex items-center justify-center space-x-2 bg-gray-900 text-white py-2 rounded-lg text-sm font-medium hover:bg-gray-800 transition"
                     >
                       <PlusCircle className="h-4 w-4" /> <span>Add New Restaurant</span>
                     </button>
                  </div>
               </div>
             </div>
           </div>

           <div className="flex items-center space-x-4">
              <Link to={`/restaurant/${activeRestaurant?.slug}`} target="_blank" className="text-sm text-orange-600 hover:underline flex items-center">
                 View Live Page <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
              <div className="h-8 w-8 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-xs">
                AD
              </div>
           </div>
        </header>

        {/* Scrollable Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50">
           {view === 'overview' && (
             <div className="space-y-6 animate-fade-in">
                <div className="flex justify-between items-center">
                   <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                   <span className="text-sm text-gray-500">Last updated: {new Date().toLocaleTimeString()}</span>
                </div>

                {/* Summary Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                    {/* Today's Sales Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Today's Sales</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{todaySale.toFixed(2)}</h3>
                            </div>
                            <div className="p-2 bg-green-50 rounded-lg">
                                <TrendingUp className="h-6 w-6 text-green-600" />
                            </div>
                        </div>
                        <div className="mt-4 flex items-center text-xs text-green-600">
                            <span className="font-medium">Avg order: ₹{(todaySale / (todayOrders.length || 1)).toFixed(2)}</span>
                        </div>
                    </div>

                    {/* Total Orders Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Orders</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">{orders.length}</h3>
                            </div>
                            <div className="p-2 bg-blue-50 rounded-lg">
                                <ShoppingBag className="h-6 w-6 text-blue-600" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs font-medium text-blue-600">
                            Today: {todayOrders.length} orders
                        </div>
                    </div>

                    {/* Total Revenue Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Revenue</p>
                                <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{totalRevenue.toFixed(2)}</h3>
                            </div>
                            <div className="p-2 bg-orange-50 rounded-lg">
                                <PieChart className="h-6 w-6 text-orange-600" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs font-medium text-orange-600">
                            Today: ₹{todaySale.toFixed(2)}
                        </div>
                    </div>

                    {/* Total Expenses Card */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-start">
                            <div>
                                <p className="text-sm font-medium text-gray-500">Total Expenses</p>
                                <h3 className="text-2xl font-bold text-red-600 mt-1">₹{totalExpenses.toFixed(2)}</h3>
                            </div>
                            <div className="p-2 bg-red-50 rounded-lg">
                                <Wallet className="h-6 w-6 text-red-600" />
                            </div>
                        </div>
                        <div className="mt-4 text-xs font-medium text-red-600">
                            Today: ₹{todayExpensesAmount.toFixed(2)}
                        </div>
                    </div>
                </div>

                {/* Charts */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Sales Trend */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Sales Trend (Last 7 Days)</h3>
                        <div className="w-full min-h-[320px]">
                            <ResponsiveContainer width="100%" height={300}>
                                <LineChart data={trendData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                                    <Tooltip formatter={(value: number) => [`₹${value}`, 'Sales']} />
                                    <Line type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={3} dot={{ r: 4, fill: '#ea580c' }} />
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Revenue vs Expense */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                         <h3 className="text-lg font-bold text-gray-900 mb-4">Financial Overview</h3>
                         <div className="w-full min-h-[320px]">
                            <ResponsiveContainer width="100%" height={300}>
                                <BarChart data={financialData}>
                                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                    <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                    <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                                    <Tooltip cursor={{ fill: '#f3f4f6' }} />
                                    <Legend />
                                    <Bar dataKey="Revenue" fill="#22c55e" radius={[4, 4, 0, 0]} />
                                    <Bar dataKey="Expenses" fill="#ef4444" radius={[4, 4, 0, 0]} />
                                </BarChart>
                            </ResponsiveContainer>
                         </div>
                    </div>

                    {/* Top Categories */}
                    <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                        <h3 className="text-lg font-bold text-gray-900 mb-4">Sales by Category</h3>
                        <div className="w-full min-h-[320px] flex justify-center">
                            <ResponsiveContainer width="100%" height={300}>
                                <RePieChart>
                                    <Pie
                                        data={categoryData}
                                        cx="50%"
                                        cy="50%"
                                        labelLine={false}
                                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                                        outerRadius={80}
                                        fill="#8884d8"
                                        dataKey="value"
                                    >
                                        {categoryData.map((entry, index) => (
                                            <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                        ))}
                                    </Pie>
                                    <Tooltip />
                                </RePieChart>
                            </ResponsiveContainer>
                        </div>
                    </div>
                </div>
             </div>
           )}

           {view === 'menu' && <MenuManager />}
           {view === 'settings' && <Settings />}
           {view === 'pos' && <POS />}
           {view === 'orders' && <Orders />}
           {view === 'expenses' && <Expenses />}
           {view === 'reports' && <Reports />}
           {view === 'restaurants' && <RestaurantList />}
           {view === 'restaurants-new' && <ManageRestaurants />}
           {view === 'restaurants-edit' && <ManageRestaurants />}
           {view === 'restaurants-config' && <RestaurantConfig />}
           {view === 'customers' && <CRM />}
        </main>
      </div>
    </div>
  );
};

// Simple Wrapper for Recharts PieChart to avoid naming conflict
const RePieChart = RePie;

export default Dashboard;
