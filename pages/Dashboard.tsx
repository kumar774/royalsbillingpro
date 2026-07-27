import React, { useState, useEffect, useRef } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { UtensilsCrossed, LayoutDashboard, Menu, Settings as SettingsIcon, LogOut, ExternalLink, Calculator, ShoppingBag, TrendingUp, PieChart, FileText, Wallet, Store, Mail, Key, RefreshCcw, X, Users, Loader2 } from 'lucide-react';
import { auth, db } from '../firebase/config';
import { updateEmail, updatePassword, sendPasswordResetEmail } from 'firebase/auth';
import { useAuth } from '../context/AuthContext';
import { collection, onSnapshot, doc, getDoc } from 'firebase/firestore';
import { toast } from 'react-hot-toast';
import { Order, Expense, RolePermissions } from '../types';
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
import StaffManager from './StaffManager';
import { playOrderNotificationSound, requestNotificationPermission, sendBrowserNotification } from '../services/notificationSound';

interface DashboardProps {
  view: 'overview' | 'menu' | 'settings' | 'pos' | 'orders' | 'expenses' | 'staff' | 'reports' | 'restaurants' | 'restaurants-new' | 'restaurants-edit' | 'restaurants-config' | 'customers';
}

const DEFAULT_PERMISSIONS: Record<string, RolePermissions> = {
  admin: {
    dashboard: { view: true, add: true, edit: true, delete: true },
    pos: { view: true, add: true, edit: true, delete: true },
    orders: { view: true, add: true, edit: true, delete: true },
    menu: { view: true, add: true, edit: true, delete: true },
    expenses: { view: true, add: true, edit: true, delete: true },
    staff: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    customers: { view: true, add: true, edit: true, delete: true },
    settings: { view: true, add: true, edit: true, delete: true }
  },
  manager: {
    dashboard: { view: true, add: true, edit: true, delete: true },
    pos: { view: true, add: true, edit: true, delete: true },
    orders: { view: true, add: true, edit: true, delete: true },
    menu: { view: true, add: true, edit: true, delete: true },
    expenses: { view: true, add: true, edit: true, delete: true },
    staff: { view: true, add: true, edit: true, delete: true },
    reports: { view: true, add: true, edit: true, delete: true },
    customers: { view: true, add: true, edit: true, delete: true },
    settings: { view: true, add: true, edit: true, delete: true }
  },
  chef: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: false, add: false, edit: false, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: true, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  waiter: {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: true, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  'delivery boy': {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: false, add: false, edit: false, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: false, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  cashier: {
    dashboard: { view: true, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: true, edit: true, delete: false },
    menu: { view: true, add: false, edit: false, delete: false },
    expenses: { view: true, add: true, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: true, add: false, edit: false, delete: false },
    customers: { view: true, add: true, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  cleaner: {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: false, add: false, edit: false, delete: false },
    orders: { view: false, add: false, edit: false, delete: false },
    menu: { view: false, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  },
  other: {
    dashboard: { view: false, add: false, edit: false, delete: false },
    pos: { view: true, add: true, edit: true, delete: false },
    orders: { view: true, add: false, edit: true, delete: false },
    menu: { view: false, add: false, edit: false, delete: false },
    expenses: { view: false, add: false, edit: false, delete: false },
    staff: { view: false, add: false, edit: false, delete: false },
    reports: { view: false, add: false, edit: false, delete: false },
    customers: { view: false, add: false, edit: false, delete: false },
    settings: { view: false, add: false, edit: false, delete: false }
  }
};

const Dashboard: React.FC<DashboardProps> = ({ view }) => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const navigate = useNavigate();
  const { restaurants } = useRestaurants();

  // Profile Menu State
  const [isProfileOpen, setIsProfileOpen] = useState(false);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [newEmail, setNewEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const profileRef = useRef<HTMLDivElement>(null);

  // Auth & Permissions State
  const { userProfile, logout } = useAuth();
  const [permissions, setPermissions] = useState<RolePermissions | null>(null);
  const [loadingPermissions, setLoadingPermissions] = useState(true);

  // Analytics State
  const [allRestaurantsData, setAllRestaurantsData] = useState<Record<string, { orders: Order[], expenses: Expense[] }>>({});
  const [isMergedView, setIsMergedView] = useState(false);
  const [timeframe, setTimeframe] = useState<'today' | '7days' | 'month' | 'all'>('today');
  
  // Colors for Charts
  const COLORS = [
    '#ea580c', // Orange
    '#3b82f6', // Blue
    '#10b981', // Green
    '#8b5cf6', // Purple
    '#ef4444', // Red
    '#f59e0b', // Amber/Yellow
    '#ec4899', // Pink
    '#06b6d4', // Cyan
    '#6366f1', // Indigo
    '#14b8a6'  // Teal
  ];

  useEffect(() => {
    if (view !== 'overview' || restaurants.length === 0) return;

    const unsubs: (() => void)[] = [];

    restaurants.forEach(r => {
      const unsubOrders = onSnapshot(collection(db, 'restaurants', r.id, 'orders'), (snap) => {
        const fetchedOrders = snap.docs.map(d => ({ ...d.data(), id: d.id } as Order));
        setAllRestaurantsData(prev => ({
          ...prev,
          [r.id]: {
            orders: fetchedOrders,
            expenses: prev[r.id]?.expenses || []
          }
        }));
      });
      
      const unsubExpenses = onSnapshot(collection(db, 'restaurants', r.id, 'expenses'), (snap) => {
        const fetchedExpenses = snap.docs.map(d => ({ ...d.data(), id: d.id } as Expense));
        setAllRestaurantsData(prev => ({
          ...prev,
          [r.id]: {
            orders: prev[r.id]?.orders || [],
            expenses: fetchedExpenses
          }
        }));
      });

      unsubs.push(unsubOrders, unsubExpenses);
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [restaurants, view]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(event.target as Node)) {
        setIsProfileOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // ============================================================
  // GLOBAL ORDER NOTIFICATION SYSTEM
  // Works on ALL admin pages, not just Orders page
  // ============================================================

  // Request browser notification permission on Dashboard load
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  // Track known order IDs per restaurant
  const knownOrderIdsRef = useRef<Record<string, Set<string>>>({});
  const isInitialLoadRef = useRef<Record<string, boolean>>({});

  // Global listener for new online orders across ALL restaurants
  useEffect(() => {
    if (restaurants.length === 0) return;

    const unsubs: (() => void)[] = [];

    restaurants.forEach(restaurant => {
      // Initialize tracking for this restaurant if not already done
      if (!knownOrderIdsRef.current[restaurant.id]) {
        knownOrderIdsRef.current[restaurant.id] = new Set();
        isInitialLoadRef.current[restaurant.id] = true;
      }

      const ordersRef = collection(db, 'restaurants', restaurant.id, 'orders');

      const unsub = onSnapshot(ordersRef, (snapshot) => {
        const fetchedOrders = snapshot.docs.map(d => ({
          id: d.id,
          ...d.data()
        })) as Order[];

        const currentIds = new Set(fetchedOrders.map(o => o.id));

        if (isInitialLoadRef.current[restaurant.id]) {
          // First load for this restaurant: silently populate known IDs
          knownOrderIdsRef.current[restaurant.id] = currentIds;
          isInitialLoadRef.current[restaurant.id] = false;
        } else {
          // Subsequent updates: detect genuinely new online orders
          const newOnlineOrders = fetchedOrders.filter(
            o => !knownOrderIdsRef.current[restaurant.id].has(o.id) && o.source === 'Online'
          );

          if (newOnlineOrders.length > 0) {
            // 1. Play LOUD notification sound
            playOrderNotificationSound();

            // 2. Show in-app toast with restaurant name
            newOnlineOrders.forEach(order => {
              toast(
                `\ud83d\udd14 New Order #${order.formattedId || order.id.slice(-5)} from ${order.customerName || 'Guest'} — ${restaurant.name}`,
                {
                  duration: 8000,
                  style: {
                    background: '#1e40af',
                    color: '#fff',
                    fontWeight: 'bold',
                    padding: '16px',
                    borderRadius: '12px',
                    fontSize: '14px',
                  },
                  icon: '\ud83d\uded2',
                }
              );

              // 3. Send browser push notification (works in background tabs)
              sendBrowserNotification(
                `\ud83d\udd14 New Order — ${restaurant.name}`,
                `Order #${order.formattedId || order.id.slice(-5)} from ${order.customerName || 'Guest'} • \u20b9${order.total?.toFixed(2) || '0.00'}`
              );
            });
          }

          // Update known IDs for this restaurant
          knownOrderIdsRef.current[restaurant.id] = currentIds;
        }
      });

      unsubs.push(unsub);
    });

    return () => {
      unsubs.forEach(unsub => unsub());
    };
  }, [restaurants]);

  useEffect(() => {
    if (!userProfile) return;

    const fetchPermissions = async () => {
      setLoadingPermissions(true);
      try {
        // Fetch permissions for their role
        const activeRestId = userProfile.role === 'admin' ? restaurantId : userProfile.restaurantId;
        if (activeRestId) {
          const permDocRef = doc(db, 'restaurants', activeRestId, 'config', 'permissions');
          const permDoc = await getDoc(permDocRef);
          
          let rolePerms: RolePermissions | null = null;
          
          if (permDoc.exists()) {
            const data = permDoc.data();
            const roleKey = userProfile.role.toLowerCase();
            if (data[roleKey]) {
              rolePerms = data[roleKey] as RolePermissions;
            }
          }
          
          if (!rolePerms) {
            const roleKey = userProfile.role.toLowerCase();
            rolePerms = DEFAULT_PERMISSIONS[roleKey] || DEFAULT_PERMISSIONS['other'];
          }
          
          setPermissions(rolePerms);
        } else {
          setPermissions(DEFAULT_PERMISSIONS['admin']);
        }
      } catch (err) {
        console.error("Error loading permissions:", err);
        toast.error("Error loading user credentials.");
      } finally {
        setLoadingPermissions(false);
      }
    };

    fetchPermissions();
  }, [restaurantId, userProfile]);

  const handleSignOut = () => {
    logout().then(() => navigate('/login'));
  };

  const handleForgetPassword = async () => {
    if (!auth.currentUser?.email) return;
    try {
      await sendPasswordResetEmail(auth, auth.currentUser.email);
      toast.success('Password reset email sent!');
      setIsProfileOpen(false);
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to send reset email';
      toast.error(errorMessage);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    const toastId = toast.loading('Updating email...');
    try {
      await updateEmail(auth.currentUser, newEmail);
      toast.success('Email updated successfully!', { id: toastId });
      setShowEmailModal(false);
      setNewEmail('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update email. You may need to re-authenticate.';
      toast.error(errorMessage, { id: toastId });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!auth.currentUser) return;
    const toastId = toast.loading('Updating password...');
    try {
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Password updated successfully!', { id: toastId });
      setShowPasswordModal(false);
      setNewPassword('');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to update password. You may need to re-authenticate.';
      toast.error(errorMessage, { id: toastId });
    }
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
  const isWithinTimeframe = (dateStr: string, tf: typeof timeframe) => {
    const date = new Date(dateStr);
    const now = new Date();
    
    switch (tf) {
      case 'today':
        return date.toDateString() === now.toDateString();
      case '7days': {
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(now.getDate() - 7);
        sevenDaysAgo.setHours(0,0,0,0);
        return date >= sevenDaysAgo;
      }
      case 'month': {
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);
        return date >= startOfMonth;
      }
      case 'all':
      default:
        return true;
    }
  };

  const today = new Date().toDateString();
  const last7Days = [...Array(7)].map((_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d;
  });

  // Dynamic Label
  const timeframeLabel = timeframe === 'today' ? "Today" : timeframe === '7days' ? "7 Days" : timeframe === 'month' ? "This Month" : "All Time";

  // Helpers for restaurant data
  const getRestStats = (rOrders: Order[], rExpenses: Expense[]) => {
    const activeOrders = rOrders.filter(o => o.status !== 'Cancelled');
    const tfOrders = activeOrders.filter(o => isWithinTimeframe(o.createdAt, timeframe));
    const tfExpenses = rExpenses.filter(e => isWithinTimeframe(e.date, timeframe));

    const totalSales = tfOrders.reduce((acc, o) => acc + o.total, 0);
    const totalOrdersCount = tfOrders.length;
    const totalExp = tfExpenses.reduce((acc, e) => acc + e.amount, 0);
    const avgOrderValue = totalOrdersCount > 0 ? totalSales / totalOrdersCount : 0;

    return {
      sales: totalSales,
      ordersCount: totalOrdersCount,
      expenses: totalExp,
      avg: avgOrderValue,
      rawOrders: rOrders,
      tfOrders,
      tfExpenses
    };
  };

  // 1. Active Single Restaurant Data
  const activeData = allRestaurantsData[restaurantId!] || { orders: [], expenses: [] };
  const singleStats = getRestStats(activeData.orders, activeData.expenses);

  const getDailySalesForRest = (restOrders: Order[], dateStr: string) => 
    restOrders
      .filter(o => o.status !== 'Cancelled' && new Date(o.createdAt).toDateString() === dateStr)
      .reduce((acc, o) => acc + o.total, 0);

  const singleTrendData = last7Days.map(date => ({
    name: date.toLocaleDateString('en-US', { weekday: 'short' }),
    sales: getDailySalesForRest(activeData.orders, date.toDateString())
  }));

  const singleCategoryDataRaw: Record<string, number> = {};
  singleStats.tfOrders.forEach(o => {
    o.items.forEach(i => {
      const cat = i.customCategory || i.categoryGroup || 'Other';
      singleCategoryDataRaw[cat] = (singleCategoryDataRaw[cat] || 0) + i.quantity;
    });
  });
  const singleCategoryData = Object.keys(singleCategoryDataRaw).map(k => ({ name: k, value: singleCategoryDataRaw[k] }));

  const singleFinancialData = [
    { name: 'Total', Revenue: singleStats.sales, Expenses: singleStats.expenses }
  ];

  // 2. Merged/Combined View Data
  const mergedTrendData = last7Days.map(date => {
    const name = date.toLocaleDateString('en-US', { weekday: 'short' });
    const row: any = { name };
    restaurants.forEach(r => {
      const rOrders = allRestaurantsData[r.id]?.orders || [];
      row[r.name] = getDailySalesForRest(rOrders, date.toDateString());
    });
    return row;
  });

  const mergedCategoryDataRaw: Record<string, number> = {};
  restaurants.forEach(r => {
    const rData = allRestaurantsData[r.id] || { orders: [], expenses: [] };
    const rStats = getRestStats(rData.orders, rData.expenses);
    rStats.tfOrders.forEach(o => {
      o.items.forEach(i => {
        const cat = i.customCategory || i.categoryGroup || 'Other';
        mergedCategoryDataRaw[cat] = (mergedCategoryDataRaw[cat] || 0) + i.quantity;
      });
    });
  });
  const mergedCategoryData = Object.keys(mergedCategoryDataRaw).map(k => ({ name: k, value: mergedCategoryDataRaw[k] }));

  const mergedFinancialData = restaurants.map(r => {
    const rData = allRestaurantsData[r.id] || { orders: [], expenses: [] };
    const rStats = getRestStats(rData.orders, rData.expenses);
    return {
      name: r.name,
      Revenue: rStats.sales,
      Expenses: rStats.expenses
    };
  });

  // Dynamic Variable Resolution
  const trendData = isMergedView ? mergedTrendData : singleTrendData;
  const categoryData = isMergedView ? mergedCategoryData : singleCategoryData;
  const financialData = isMergedView ? mergedFinancialData : singleFinancialData;

  const hasAccess = (() => {
    if (!permissions) return true;
    if (userProfile?.role === 'admin') return true;
    
    switch (view) {
      case 'overview': return permissions.dashboard.view;
      case 'pos': return permissions.pos.view;
      case 'orders': return permissions.orders.view;
      case 'menu': return permissions.menu.view;
      case 'expenses': return permissions.expenses.view;
      case 'staff': return permissions.staff.view;
      case 'reports': return permissions.reports.view;
      case 'customers': return permissions.customers.view;
      case 'settings': return permissions.settings.view;
      default: return true;
    }
  })();

  if (loadingPermissions) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="flex flex-col items-center space-y-3">
          <Loader2 className="animate-spin h-10 w-10 text-orange-500" />
          <p className="text-gray-500 font-semibold text-sm">Loading permissions...</p>
        </div>
      </div>
    );
  }

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
          {(!permissions || permissions.dashboard.view) && (
            <NavItem to={`/dashboard/${restaurantId}`} icon={LayoutDashboard} label="Dashboard" active={view === 'overview'} />
          )}
          
          {(!permissions || permissions.pos.view || permissions.orders.view) && (
            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Operations</div>
          )}
          {(!permissions || permissions.pos.view) && (
            <NavItem to={`/dashboard/${restaurantId}/pos`} icon={Calculator} label="POS System" active={view === 'pos'} />
          )}
          {(!permissions || permissions.orders.view) && (
            <NavItem to={`/dashboard/${restaurantId}/orders`} icon={ShoppingBag} label="Live Orders" active={view === 'orders'} />
          )}
          
          {(!permissions || permissions.menu.view || permissions.expenses.view || permissions.staff.view) && (
            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Management</div>
          )}
          {(!permissions || permissions.menu.view) && (
            <NavItem to={`/dashboard/${restaurantId}/menu`} icon={Menu} label="Menu Manager" active={view === 'menu'} />
          )}
          {(!permissions || permissions.expenses.view) && (
            <NavItem to={`/dashboard/${restaurantId}/expenses`} icon={Wallet} label="Expenses" active={view === 'expenses'} />
          )}
          {(!permissions || permissions.staff.view) && (
            <NavItem to={`/dashboard/${restaurantId}/staff`} icon={Users} label="Staff Management" active={view === 'staff'} />
          )}
          
          {(!permissions || permissions.reports.view || permissions.customers.view || permissions.settings.view || userProfile?.role === 'admin') && (
            <div className="pt-4 pb-2 text-xs font-semibold text-gray-400 uppercase tracking-wider pl-4">Admin</div>
          )}
          {userProfile?.role === 'admin' && (
            <NavItem to={`/dashboard/${restaurantId}/restaurants`} icon={Store} label="Restaurants" active={view === 'restaurants' || view === 'restaurants-new' || view === 'restaurants-edit'} />
          )}
          {(!permissions || permissions.reports.view) && (
            <NavItem to={`/dashboard/${restaurantId}/reports`} icon={FileText} label="Reports" active={view === 'reports'} />
          )}
          {(!permissions || permissions.customers.view) && (
            <NavItem to={`/dashboard/${restaurantId}/customers`} icon={FileText} label="CRM & Analytics" active={view === 'customers'} />
          )}
          {(!permissions || permissions.settings.view) && (
            <NavItem to={`/dashboard/${restaurantId}/settings`} icon={SettingsIcon} label="Settings" active={view === 'settings'} />
          )}
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
        <header className="relative bg-white shadow-sm h-16 flex items-center px-8 justify-between z-40 print:hidden">
            {/* Restaurant Switcher - Horizontal List */}
            <div className="flex items-center overflow-x-auto no-scrollbar max-w-[60%] font-sans">
               <div className="flex items-center space-x-6 whitespace-nowrap">
                 {userProfile?.role === 'admin' ? (
                   restaurants.map((r, index) => (
                     <React.Fragment key={r.id}>
                       <button 
                         onClick={() => navigate(`/dashboard/${r.id}`)}
                         className={`text-sm transition-colors ${r.id === restaurantId ? 'font-bold text-orange-600' : 'text-gray-500 hover:text-gray-900 font-medium'}`}
                       >
                         {r.name}
                       </button>
                       {index < restaurants.length - 1 && (
                         <span className="text-gray-300">|</span>
                       )}
                     </React.Fragment>
                   ))
                 ) : (
                   <span className="text-sm font-bold text-orange-600 flex items-center gap-1.5">
                     <Store className="h-4.5 w-4.5 text-orange-500" /> {activeRestaurant?.name || 'My Restaurant'}
                   </span>
                 )}
               </div>
            </div>

           <div className="flex items-center space-x-6">
              <Link to={`/restaurant/${activeRestaurant?.slug}`} target="_blank" className="text-sm text-orange-600 hover:underline flex items-center font-medium">
                 View Live Page <ExternalLink className="h-3 w-3 ml-1" />
              </Link>
              
              {/* Profile Menu */}
              <div className="relative" ref={profileRef}>
                <button 
                  onClick={() => setIsProfileOpen(!isProfileOpen)}
                  className="h-9 w-9 bg-orange-100 rounded-full flex items-center justify-center text-orange-700 font-bold text-sm hover:bg-orange-200 transition-colors border-2 border-white shadow-sm"
                >
                  {auth.currentUser?.email?.substring(0, 2).toUpperCase() || 'AD'}
                </button>

                {isProfileOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white rounded-xl shadow-xl border border-gray-100 py-2 z-50 animate-fade-in">
                    <div className="px-4 py-2 border-b border-gray-50 mb-1">
                      <p className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Account Settings</p>
                      <p className="text-sm font-medium text-gray-700 truncate">{auth.currentUser?.email}</p>
                    </div>
                    <button 
                      onClick={() => { setShowEmailModal(true); setIsProfileOpen(false); }}
                      className="w-full text-left px-4 py-2.5 flex items-center space-x-3 hover:bg-gray-50 transition text-gray-600 text-sm"
                    >
                      <Mail className="h-4 w-4 text-gray-400" />
                      <span>Change Email</span>
                    </button>
                    <button 
                      onClick={() => { setShowPasswordModal(true); setIsProfileOpen(false); }}
                      className="w-full text-left px-4 py-2.5 flex items-center space-x-3 hover:bg-gray-50 transition text-gray-600 text-sm"
                    >
                      <Key className="h-4 w-4 text-gray-400" />
                      <span>Change Password</span>
                    </button>
                    <button 
                      onClick={handleForgetPassword}
                      className="w-full text-left px-4 py-2.5 flex items-center space-x-3 hover:bg-gray-50 transition text-gray-600 text-sm"
                    >
                      <RefreshCcw className="h-4 w-4 text-gray-400" />
                      <span>Forget Password</span>
                    </button>
                    <div className="border-t border-gray-50 mt-1 pt-1">
                      <button 
                        onClick={handleSignOut}
                        className="w-full text-left px-4 py-2.5 flex items-center space-x-3 hover:bg-red-50 transition text-red-600 text-sm"
                      >
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
           </div>
        </header>

        {/* Modals */}
        {showEmailModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Change Email</h3>
                <button onClick={() => setShowEmailModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleChangeEmail} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Email Address</label>
                  <input 
                    type="email" 
                    required
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Enter new email"
                  />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowEmailModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium shadow-sm"
                  >
                    Update Email
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {showPasswordModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-scale-in">
              <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                <h3 className="text-lg font-bold text-gray-900">Change Password</h3>
                <button onClick={() => setShowPasswordModal(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-5 w-5" />
                </button>
              </div>
              <form onSubmit={handleChangePassword} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
                  <input 
                    type="password" 
                    required
                    minLength={6}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-orange-500 outline-none"
                    placeholder="Enter new password"
                  />
                </div>
                <div className="flex space-x-3 pt-2">
                  <button 
                    type="button"
                    onClick={() => setShowPasswordModal(false)}
                    className="flex-1 px-4 py-2 border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 font-medium"
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 font-medium shadow-sm"
                  >
                    Update Password
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Scrollable Area */}
        <main className="flex-1 overflow-auto p-4 md:p-8 bg-gray-50">
          {!hasAccess ? (
            <div className="flex flex-col items-center justify-center p-12 bg-white rounded-2xl shadow-sm border border-gray-150 min-h-[50vh] text-center space-y-4 font-sans max-w-xl mx-auto my-12 animate-fade-in">
              <div className="bg-red-50 p-6 rounded-full text-red-500">
                <X className="h-10 w-10" />
              </div>
              <h3 className="text-xl font-bold text-gray-900">Access Denied</h3>
              <p className="text-sm text-gray-500 max-w-md">Your user account role does not have authorization to view this module. Please contact your restaurant administrator to request permission.</p>
            </div>
          ) : (
            <>
              {view === 'overview' && (
              <div className="space-y-6 animate-fade-in">
                 <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-4">
                    <div>
                      <h2 className="text-2xl font-bold text-gray-900">Dashboard Overview</h2>
                      <p className="text-sm text-gray-500 mt-1">Last updated: {new Date().toLocaleTimeString()}</p>
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      {/* Timeframe Dropdown */}
                      <div className="flex items-center space-x-2 bg-white px-3 py-2 rounded-xl border border-gray-100 shadow-sm">
                        <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Timeframe:</span>
                        <select
                          value={timeframe}
                          onChange={(e) => setTimeframe(e.target.value as any)}
                          className="text-sm font-semibold text-gray-700 outline-none cursor-pointer bg-transparent border-none pr-1"
                        >
                          <option value="today">Today</option>
                          <option value="7days">Last 7 Days</option>
                          <option value="month">This Month</option>
                          <option value="all">All Time</option>
                        </select>
                      </div>

                      {/* Merge Toggle */}
                      {restaurants.length > 1 && (
                        <div className="flex items-center space-x-3 bg-white px-4 py-2 rounded-xl border border-gray-100 shadow-sm">
                          <span className="text-sm font-bold text-gray-700">Merge Dashboards</span>
                          <button
                            onClick={() => setIsMergedView(!isMergedView)}
                            className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${isMergedView ? 'bg-orange-600' : 'bg-gray-200'}`}
                          >
                            <span className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${isMergedView ? 'translate-x-5' : 'translate-x-0'}`} />
                          </button>
                        </div>
                      )}
                    </div>
                 </div>

                 {/* Single view cards or Merged layout */}
                 {!isMergedView ? (
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="text-sm font-medium text-gray-500">{timeframeLabel}&apos;s Sales</p>
                                   <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{singleStats.sales.toFixed(2)}</h3>
                               </div>
                               <div className="p-2 bg-green-50 rounded-lg">
                                   <TrendingUp className="h-6 w-6 text-green-600" />
                               </div>
                           </div>
                           <div className="mt-4 flex items-center text-xs text-green-600">
                               <span className="font-medium">Avg Value: ₹{singleStats.avg.toFixed(2)}</span>
                           </div>
                       </div>

                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="text-sm font-medium text-gray-500">{timeframeLabel}&apos;s Orders</p>
                                   <h3 className="text-2xl font-bold text-gray-900 mt-1">{singleStats.ordersCount}</h3>
                               </div>
                               <div className="p-2 bg-blue-50 rounded-lg">
                                   <ShoppingBag className="h-6 w-6 text-blue-600" />
                               </div>
                           </div>
                           <div className="mt-4 text-xs text-blue-600 font-medium">
                             Total active orders in this period
                           </div>
                       </div>

                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="text-sm font-medium text-gray-500">{timeframeLabel}&apos;s Revenue</p>
                                   <h3 className="text-2xl font-bold text-gray-900 mt-1">₹{singleStats.sales.toFixed(2)}</h3>
                               </div>
                               <div className="p-2 bg-orange-50 rounded-lg">
                                   <PieChart className="h-6 w-6 text-orange-600" />
                               </div>
                           </div>
                           <div className="mt-4 text-xs text-orange-600 font-medium">
                             Revenue generated from paid/active orders
                           </div>
                       </div>

                       <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                           <div className="flex justify-between items-start">
                               <div>
                                   <p className="text-sm font-medium text-gray-500">{timeframeLabel}&apos;s Expenses</p>
                                   <h3 className="text-2xl font-bold text-red-600 mt-1">₹{singleStats.expenses.toFixed(2)}</h3>
                               </div>
                               <div className="p-2 bg-red-50 rounded-lg">
                                   <Wallet className="h-6 w-6 text-red-600" />
                               </div>
                           </div>
                           <div className="mt-4 text-xs text-red-600 font-medium">
                             Operational expenses recorded
                           </div>
                       </div>
                   </div>
                 ) : (
                   /* Merged View - Separate Restaurant Blocks */
                   <div className="space-y-6 animate-fade-in">
                     {restaurants.map((r, rIdx) => {
                       const rData = allRestaurantsData[r.id] || { orders: [], expenses: [] };
                       const rStats = getRestStats(rData.orders, rData.expenses);
                       return (
                         <div key={r.id} className="bg-white p-6 rounded-2xl border border-gray-150 shadow-sm space-y-4">
                           <div className="flex items-center space-x-2 border-b border-gray-100 pb-3">
                             <div className={`p-1.5 rounded-lg text-white ${rIdx === 0 ? 'bg-orange-600' : 'bg-blue-600'}`}>
                               <Store className="h-5 w-5" />
                             </div>
                             <h3 className="text-lg font-bold text-gray-800">{r.name} Overview</h3>
                             <span className="text-[10px] bg-gray-50 border border-gray-200 text-gray-500 px-2 py-0.5 rounded-full font-bold ml-2">{timeframeLabel}</span>
                           </div>

                           <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                               <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Sales</p>
                               <h4 className="text-xl font-extrabold text-gray-900 mt-1">₹{rStats.sales.toFixed(2)}</h4>
                               <p className="text-[10px] text-green-600 font-medium mt-2">Avg Value: ₹{rStats.avg.toFixed(2)}</p>
                             </div>

                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                               <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Orders</p>
                               <h4 className="text-xl font-extrabold text-gray-900 mt-1">{rStats.ordersCount}</h4>
                               <p className="text-[10px] text-blue-600 font-medium mt-2">Active Orders</p>
                             </div>

                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                               <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</p>
                               <h4 className="text-xl font-extrabold text-gray-900 mt-1">₹{rStats.sales.toFixed(2)}</h4>
                               <p className="text-[10px] text-orange-600 font-medium mt-2">Net Income</p>
                             </div>

                             <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                               <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</p>
                               <h4 className="text-xl font-extrabold text-red-600 mt-1">₹{rStats.expenses.toFixed(2)}</h4>
                               <p className="text-[10px] text-red-500 font-medium mt-2">Spent</p>
                             </div>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 )}

                 {/* Charts */}
                 <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                     {/* Sales Trend */}
                      <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 ${isMergedView ? 'lg:col-span-2' : ''}`}>
                          <h3 className="text-lg font-bold text-gray-900 mb-4">Sales Trend (Last 7 Days)</h3>
                         <div className="w-full min-h-[320px]">
                             <ResponsiveContainer width="100%" height={300}>
                                 <LineChart data={trendData}>
                                     <CartesianGrid strokeDasharray="3 3" vertical={false} />
                                     <XAxis dataKey="name" axisLine={false} tickLine={false} />
                                     <YAxis axisLine={false} tickLine={false} tickFormatter={(value) => `₹${value}`} />
                                     <Tooltip formatter={(value: number) => [`₹${value}`, 'Sales']} />
                                     {isMergedView ? (
                                       restaurants.map((r, idx) => (
                                         <Line 
                                           key={r.id} 
                                           type="monotone" 
                                           dataKey={r.name} 
                                           stroke={idx === 0 ? "#ea580c" : "#3b82f6"} 
                                           strokeWidth={3} 
                                           dot={{ r: 4 }} 
                                         />
                                       ))
                                     ) : (
                                       <Line type="monotone" dataKey="sales" stroke="#ea580c" strokeWidth={3} dot={{ r: 4, fill: '#ea580c' }} />
                                     )}
                                     <Legend verticalAlign="bottom" height={36} />
                                 </LineChart>
                             </ResponsiveContainer>
                         </div>
                     </div>

                     {/* Revenue vs Expense */}
                      <div className={`bg-white p-6 rounded-xl shadow-sm border border-gray-100 ${isMergedView ? 'lg:col-span-2' : ''}`}>
                           <h3 className="text-lg font-bold text-gray-900 mb-4">Financial Overview ({timeframeLabel})</h3>
                          {isMergedView ? (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                              {restaurants.map((r) => {
                                const rData = allRestaurantsData[r.id] || { orders: [], expenses: [] };
                                const rStats = getRestStats(rData.orders, rData.expenses);
                                const rFinancialData = [
                                  { name: r.name, Revenue: rStats.sales, Expenses: rStats.expenses }
                                ];
                                return (
                                  <div key={r.id} className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                    <h4 className="font-bold text-gray-700 mb-3 text-center">{r.name}</h4>
                                    <ResponsiveContainer width="100%" height={240}>
                                        <BarChart data={rFinancialData}>
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
                                );
                              })}
                            </div>
                          ) : (
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
                          )}
                     </div>

                     {/* Top Categories */}
                     <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 lg:col-span-2">
                         <h3 className="text-lg font-bold text-gray-900 mb-4">Sales by Category ({timeframeLabel})</h3>
                         <div className="flex flex-col md:flex-row items-center justify-between gap-8">
                             {categoryData.length > 0 ? (
                               <>
                                 <div className="w-full md:w-1/2 min-h-[300px] flex items-center justify-center">
                                   <ResponsiveContainer width="100%" height={300}>
                                       <RePieChart>
                                           <Pie
                                               data={categoryData}
                                               cx="50%"
                                               cy="50%"
                                               innerRadius={60}
                                               outerRadius={85}
                                               paddingAngle={2}
                                               dataKey="value"
                                           >
                                               {categoryData.map((entry, index) => (
                                                   <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                               ))}
                                           </Pie>
                                           <Tooltip formatter={(value) => [`${value} items sold`, 'Qty']} />
                                       </RePieChart>
                                   </ResponsiveContainer>
                                 </div>
                                 <div className="w-full md:w-1/2 space-y-3 max-h-[300px] overflow-y-auto pr-2">
                                   {(() => {
                                     const totalItemsSold = categoryData.reduce((acc, c) => acc + c.value, 0);
                                     const sortedCategories = [...categoryData].sort((a, b) => b.value - a.value);
                                     return sortedCategories.map((c, index) => {
                                       const pct = totalItemsSold > 0 ? ((c.value / totalItemsSold) * 100).toFixed(0) : '0';
                                       const origIndex = categoryData.findIndex(item => item.name === c.name);
                                       const color = COLORS[origIndex % COLORS.length];
                                       return (
                                         <div key={c.name} className="flex items-center justify-between text-sm">
                                           <div className="flex items-center space-x-2.5">
                                             <span className="h-3.5 w-3.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
                                             <span className="font-semibold text-gray-700">{c.name}</span>
                                           </div>
                                           <div className="flex items-center space-x-4">
                                             <span className="text-gray-500 font-medium">{c.value} sold</span>
                                             <span className="font-bold text-gray-900 w-8 text-right">{pct}%</span>
                                           </div>
                                         </div>
                                       );
                                     });
                                   })()}
                                 </div>
                               </>
                             ) : (
                               <div className="flex flex-col items-center justify-center w-full h-[300px] text-gray-400">
                                 <PieChart className="h-10 w-10 mb-2" />
                                 <span className="text-sm">No sales data available for this timeframe.</span>
                               </div>
                             )}
                          </div>
                      </div>
                  </div>
              </div>
           )}

            {view === 'menu' && <MenuManager permissions={permissions || undefined} />}
            {view === 'settings' && <Settings />}
            {view === 'pos' && <POS permissions={permissions || undefined} />}
            {view === 'orders' && <Orders permissions={permissions || undefined} />}
            {view === 'expenses' && <Expenses permissions={permissions || undefined} />}
            {view === 'staff' && <StaffManager permissions={permissions || undefined} />}
            {view === 'reports' && <Reports />}
            {view === 'restaurants' && <RestaurantList />}
            {view === 'restaurants-new' && <ManageRestaurants />}
            {view === 'restaurants-edit' && <ManageRestaurants />}
            {view === 'restaurants-config' && <RestaurantConfig />}
            {view === 'customers' && <CRM />}
          </>
        )}
      </main>
      </div>
    </div>
  );
};

// Simple Wrapper for Recharts PieChart to avoid naming conflict
const RePieChart = RePie;

export default Dashboard;
