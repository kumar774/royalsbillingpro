import React, { useEffect, useState } from 'react';
import { collection, query, getDocs } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useRestaurants } from '../context/RestaurantContext';
import { Order } from '../types';
import { MessageSquare, Download, Phone, TrendingUp, Award, AlertCircle, Send, X, Search, Filter, Calendar, List, DollarSign, Users, Activity, Loader2, Clock, QrCode } from 'lucide-react';
import { useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { sendBulkEvolutionMessage, getEvolutionQR, sendEvolutionMessage, checkConnectionStatus, restartInstance, logoutEvolutionInstance } from '../services/evolutionService';
import { QRCodeSVG } from 'qrcode.react';

interface CustomerData {
  id: string;
  name: string;
  phone: string;
  totalOrders: number;
  totalSpent: number;
  weeklySpent: number;
  weeklyOrders: number;
  mostOrderedItem: string;
  lastOrderedAt: string;
  aov: number;
  isVIP: boolean;
  isRegular: boolean;
  isMissing: boolean;
}

type TabType = 'spending' | 'frequency' | 'inactive';

const CRM: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const { selectedRestaurant: currentRestaurant } = useRestaurants();
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<TabType>('spending');
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteItemFilter, setFavoriteItemFilter] = useState("All");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  
  // Modals & Messaging
  const [showBulkModal, setShowBulkModal] = useState(false);
  const [bulkMessage, setBulkMessage] = useState("Special offer for our valued customers! Get 20% off on your next order.");
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [showCustomModal, setShowCustomModal] = useState(false);
  const [customMessage, setCustomMessage] = useState("");
  const [targetCustomer, setTargetCustomer] = useState<CustomerData | null>(null);
  
  // Queue System
  const [isProcessingQueue, setIsProcessingQueue] = useState(false);
  const [queueProgress, setQueueProgress] = useState({ sent: 0, failed: 0, total: 0, percent: 0 });

  // WhatsApp Connection
  const [waStatus, setWaStatus] = useState<'READY' | 'DISCONNECTED' | 'CONNECTING' | 'WAITING_QR' | 'CLOSE' | 'NULL'>('NULL');
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [showQRModal, setShowQRModal] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);

  const now = new Date();
  const INSTANCE_NAME = restaurantId ? `CraveWave_${restaurantId}` : 'CraveWave_Default';

  const formatDate = (dateStr: string) => {
    try {
      const date = new Date(dateStr);
      const d = date.toLocaleDateString('en-GB', { timeZone: 'Asia/Kolkata' }); // DD/MM/YYYY
      return d;
    } catch {
      return 'N/A';
    }
  };

  const getLastVisitLabel = (dateStr: string) => {
    try {
      const visitDate = new Date(dateStr);
      
      const d1 = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      const d2 = new Date(visitDate.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
      
      d1.setHours(0, 0, 0, 0);
      d2.setHours(0, 0, 0, 0);
      
      const diffDays = Math.floor((d1.getTime() - d2.getTime()) / (1000 * 60 * 60 * 24));
      
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Yesterday';
      if (diffDays < 0) return 'Future';
      return `${diffDays} days ago`;
    } catch {
      return 'N/A';
    }
  };

  // Initial Status Check - Only runs ONCE on mount or when restaurantId changes
  useEffect(() => {
    const checkInitialStatus = async () => {
      if (!restaurantId) return;
      const status = await checkConnectionStatus(INSTANCE_NAME);
      console.log(`[STATUS] ${INSTANCE_NAME}: ${status}`);
      
      if (status === 'open') {
        setWaStatus('READY');
      } else if (status === 'connecting') {
        setWaStatus('CONNECTING');
      } else if (status === 'close') {
        setWaStatus('CLOSE');
      } else if (status === null) {
        setWaStatus('NULL');
      } else {
        setWaStatus('DISCONNECTED');
      }
    };
    checkInitialStatus();
    // Removed the interval to prevent infinite 404 polling loop
  }, [restaurantId, INSTANCE_NAME]);

  // Polling Logic when QR Modal is Open
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let checks = 0;

    if (showQRModal && !isConnecting) {
      intervalId = setInterval(async () => {
        const status = await checkConnectionStatus(INSTANCE_NAME);
        console.log(`[POLL] Status: ${status}`);

        if (status === 'open') {
          setWaStatus('READY');
          setShowQRModal(false);
          toast.success("WhatsApp Connected Successfully!");
          clearInterval(intervalId);
        } else if (status === 'connecting') {
          setWaStatus('CONNECTING');
          checks++;
          
          // If connecting for > 20 seconds (4 checks * 5s)
          if (checks > 4) {
             handleAutoRestart();
             checks = 0;
          }
        } else if (status === 'close') {
           setWaStatus('CLOSE');
        } else {
          // If disconnected or other state, keep waiting for QR scan
          setWaStatus('WAITING_QR');
        }
      }, 5000);
    }

    return () => {
      if (intervalId) clearInterval(intervalId);
    };
  }, [showQRModal, INSTANCE_NAME, isConnecting]);

  const handleDisconnect = async () => {
      if (!window.confirm("Are you sure you want to disconnect WhatsApp?")) return;
      
      toast.loading("Disconnecting...", { id: 'disconnect' });
      try {
          await logoutEvolutionInstance(INSTANCE_NAME);
          setWaStatus('NULL');
          toast.success("Disconnected successfully", { id: 'disconnect' });
      } catch (e) {
          console.error("Disconnect failed", e);
          toast.error("Failed to disconnect", { id: 'disconnect' });
      }
  };

  const handleAutoRestart = async () => {
      console.log("[AUTO-RESTART] Connection stuck. Restarting...");
      toast.loading("Connection stuck. Restarting instance...", { id: 'restart' });
      try {
          await restartInstance(INSTANCE_NAME);
          await new Promise(resolve => setTimeout(resolve, 5000));
          toast.success("Instance restarted. Refreshing QR...", { id: 'restart' });
          // Fetch fresh QR
          const qr = await getEvolutionQR(INSTANCE_NAME);
          if (qr) setQrCode(qr);
      } catch (e) {
          console.error("Restart failed", e);
          toast.error("Failed to restart instance", { id: 'restart' });
      }
  };

  const handleShowQR = async () => {
    if (isConnecting) return;
    setIsConnecting(true);
    setWaStatus('CONNECTING');
    setShowQRModal(true);
    setQrCode(null);
    
    try {
      const qr = await getEvolutionQR(INSTANCE_NAME);
      if (qr) {
        setQrCode(qr);
        setWaStatus('WAITING_QR');
      } else {
        throw new Error("No QR code returned from server");
      }
    } catch (err) {
      console.error('Failed to get QR:', err);
      setWaStatus('DISCONNECTED');
      setShowQRModal(false); 
    } finally {
      setIsConnecting(false);
    }
  };

  useEffect(() => {
    const fetchCustomers = async () => {
      if (!restaurantId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      setError(null);
      try {
        const ordersRef = collection(db, 'restaurants', restaurantId, 'orders');
        const q = query(ordersRef);
        const querySnapshot = await getDocs(q);

        const customerMap = new Map<string, CustomerData>();
        const now = new Date();
        const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000);

        querySnapshot.forEach((doc) => {
          const order = doc.data() as Order;
          if (order.customerPhone && order.customerName) {
            const customerKey = order.customerPhone;
            let customer = customerMap.get(customerKey);
            const orderDate = new Date(order.createdAt);
            const orderTotal = Number(order.total) || 0;

            if (!customer) {
              customer = {
                id: customerKey,
                name: order.customerName || 'Guest',
                phone: order.customerPhone,
                totalOrders: 0,
                totalSpent: 0,
                weeklySpent: 0,
                weeklyOrders: 0,
                mostOrderedItem: 'N/A',
                lastOrderedAt: order.createdAt,
                aov: 0,
                isVIP: false,
                isRegular: false,
                isMissing: false,
              };
            }

            customer.totalOrders += 1;
            customer.totalSpent += orderTotal;
            
            if (orderDate >= weekAgo) {
              customer.weeklySpent += orderTotal;
              customer.weeklyOrders += 1;
            }

            if (orderDate > new Date(customer.lastOrderedAt)) {
              customer.lastOrderedAt = order.createdAt;
            }

            customerMap.set(customerKey, customer);
          }
        });

        const itemAggregates = new Map<string, Map<string, number>>();
        querySnapshot.forEach((doc) => {
          const order = doc.data() as Order;
          if (order.customerPhone) {
            if (!itemAggregates.has(order.customerPhone)) {
              itemAggregates.set(order.customerPhone, new Map());
            }
            const counts = itemAggregates.get(order.customerPhone)!;
            order.items.forEach(item => {
              counts.set(item.name, (counts.get(item.name) || 0) + item.quantity);
            });
          }
        });

        let maxWeeklySpent = 0;
        customerMap.forEach(c => {
          if (c.weeklySpent > maxWeeklySpent) maxWeeklySpent = c.weeklySpent;
          c.aov = (Number(c.totalSpent) || 0) / (Number(c.totalOrders) || 1);
          
          const counts = itemAggregates.get(c.id);
          if (counts) {
            let mostOrdered = 'N/A';
            let maxCount = 0;
            counts.forEach((count, name) => {
              if (count > maxCount) {
                maxCount = count;
                mostOrdered = name;
              }
            });
            c.mostOrderedItem = mostOrdered;
          }
        });

        const customersList = Array.from(customerMap.values()).map(customer => {
          const lastVisit = new Date(customer.lastOrderedAt);
          return {
            ...customer,
            isVIP: maxWeeklySpent > 0 && customer.weeklySpent === maxWeeklySpent,
            isRegular: customer.weeklyOrders > 2,
            isMissing: lastVisit < twoWeeksAgo
          };
        });
        setCustomers(customersList);
      } catch (err) {
        console.error('Error fetching customers:', err);
        setError('Failed to fetch customer data.');
      } finally {
        setLoading(false);
      }
    };

    fetchCustomers();
  }, [restaurantId]);


  const startBulkQueue = async () => {
    const targets = filteredCustomers.filter(c => selectedCustomers.includes(c.id));
    if (targets.length === 0) {
      toast.error("Please select at least one customer");
      return;
    }

    const numbers = targets.map(c => c.phone);
    setIsProcessingQueue(true);
    setShowBulkModal(false);
    
    try {
      await sendBulkEvolutionMessage(
        INSTANCE_NAME,
        numbers,
        bulkMessage,
        (sent, failed, total) => {
          setQueueProgress({
            sent,
            failed,
            total,
            percent: Math.round(((sent + failed) / total) * 100)
          });
        }
      );
      toast.success("Bulk messaging completed!");
    } catch (err) {
      console.error('[BULK] Error:', err);
      toast.error("Failed to complete bulk messaging");
    } finally {
      setIsProcessingQueue(false);
      setQueueProgress({ sent: 0, failed: 0, total: 0, percent: 0 });
    }
  };

  const openCustomMessageModal = (customer: CustomerData) => {
    setTargetCustomer(customer);
    setCustomMessage(`Hello ${customer.name}, we have a special surprise for you at ${currentRestaurant?.name || 'our restaurant'}!`);
    setShowCustomModal(true);
  };

  const handleSendCustomMessage = async () => {
    if (targetCustomer && customMessage.trim()) {
      try {
        toast.loading("Sending message...", { id: 'send-custom' });
        await sendEvolutionMessage(INSTANCE_NAME, targetCustomer.phone, customMessage);
        setShowCustomModal(false);
        setTargetCustomer(null);
        setCustomMessage("");
        toast.success("Message sent successfully", { id: 'send-custom' });
      } catch (err) {
        console.error('[CUSTOM] Error:', err);
        toast.error("Failed to send message", { id: 'send-custom' });
      }
    }
  };

  const filteredCustomers = customers.filter(c => {
    const matchesSearch = c.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          c.phone.includes(searchQuery);
    const matchesFavorite = favoriteItemFilter === "All" || c.mostOrderedItem === favoriteItemFilter;
    
    let matchesDate = true;
    if (dateRange.start && dateRange.end) {
      const lastVisit = new Date(c.lastOrderedAt);
      matchesDate = lastVisit >= new Date(dateRange.start) && lastVisit <= new Date(dateRange.end);
    }

    if (!matchesSearch || !matchesFavorite || !matchesDate) return false;

    if (activeTab === 'spending') return true;
    if (activeTab === 'frequency') return true;
    if (activeTab === 'inactive') return c.isMissing;
    
    return true;
  }).sort((a, b) => {
    if (activeTab === 'spending') return b.weeklySpent - a.weeklySpent;
    if (activeTab === 'frequency') return b.weeklyOrders - a.weeklyOrders;
    return new Date(b.lastOrderedAt).getTime() - new Date(a.lastOrderedAt).getTime();
  });

  const uniqueItems = Array.from(new Set(customers.map(c => c.mostOrderedItem))).filter(i => i !== 'N/A');

  const getStatusLabel = (customer: CustomerData) => {
    if (activeTab === 'spending') {
      if (customer.weeklySpent > 1000) return { label: 'VIP (High Spend)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      if (customer.weeklySpent > 0) return { label: 'Regular (Mid)', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      return { label: 'New', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    }
    if (activeTab === 'frequency') {
      if (customer.weeklyOrders >= 4) return { label: 'VIP (4+ visits)', color: 'bg-yellow-100 text-yellow-700 border-yellow-200' };
      if (customer.weeklyOrders >= 2) return { label: 'Regular (2-3)', color: 'bg-blue-100 text-blue-700 border-blue-200' };
      return { label: 'New (1)', color: 'bg-gray-100 text-gray-500 border-gray-200' };
    }
    return { label: 'Inactive', color: 'bg-red-100 text-red-700 border-red-200', icon: <AlertCircle className="h-3 w-3 mr-1" /> };
  };

  const toggleSelectAll = () => {
    if (selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0) {
      setSelectedCustomers([]);
    } else {
      setSelectedCustomers(filteredCustomers.map(c => c.id));
    }
  };

  const toggleSelect = (id: string) => {
    if (selectedCustomers.includes(id)) {
      setSelectedCustomers(selectedCustomers.filter(c => c !== id));
    } else {
      setSelectedCustomers([...selectedCustomers, id]);
    }
  };

  const exportToExcel = () => {
    if (customers.length === 0) {
      toast.error("No customers to export");
      return;
    }

    const exportData = customers.map(c => ({
      Name: c.name,
      Phone: c.phone,
      'Total Orders': Number(c.totalOrders) || 0,
      'Total Spent': `Rs. ${(Number(c.totalSpent) || 0).toFixed(2)}`,
      'Most Ordered Item': c.mostOrderedItem,
      'Last Order Date': formatDate(c.lastOrderedAt),
      'VIP Status': c.isVIP ? 'Yes' : 'No'
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Customers");
    XLSX.writeFile(wb, `Customers_${currentRestaurant?.name || 'Export'}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success("Customers exported successfully");
  };

  if (loading) return <div className="p-4 text-center">Loading customers...</div>;
  if (error) return <div className="p-4 text-center text-red-500">Error: {error}</div>;
  if (customers.length === 0) return <div className="p-4 text-center">No customers found for this restaurant.</div>;

  return (
    <div className="p-4 max-w-7xl mx-auto">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">CRM & Analytics</h1>
            <div className="flex items-center px-2 py-1 bg-gray-50 rounded-full border border-gray-100">
              <span className={`w-2 h-2 rounded-full mr-2 ${
                waStatus === 'READY' ? 'bg-green-500 animate-pulse' : 
                (waStatus === 'CONNECTING' || waStatus === 'WAITING_QR') ? 'bg-yellow-500 animate-bounce' : 
                'bg-red-500'
              }`}></span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600">
                {waStatus === 'READY' ? 'Connected' : 
                 (waStatus === 'CONNECTING' || waStatus === 'WAITING_QR') ? 'Connecting...' : 
                 'Disconnected'}
              </span>
            </div>
          </div>
          <p className="text-sm text-gray-500 flex items-center">
            <Users className="h-4 w-4 mr-1" /> Managing {customers.length} customers for <span className="font-bold text-orange-600 ml-1">{currentRestaurant?.name}</span>
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {waStatus === 'READY' ? (
            <button 
              onClick={handleDisconnect}
              className="bg-red-100 text-red-600 border border-red-200 px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm hover:bg-red-200 transition"
            >
              <X className="h-4 w-4 mr-2" /> Disconnect
            </button>
          ) : (
            <button 
              onClick={handleShowQR}
              disabled={waStatus === 'CONNECTING' || waStatus === 'WAITING_QR'}
              className={`${
                waStatus === 'CLOSE' ? 'bg-orange-600 hover:bg-orange-700' : 
                'bg-blue-600 hover:bg-blue-700'
              } text-white px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              <QrCode className="h-4 w-4 mr-2" /> 
              {waStatus === 'CLOSE' ? 'Reconnect WhatsApp' : 
               (waStatus === 'CONNECTING' || waStatus === 'WAITING_QR') ? 'Connecting...' : 
               'Connect WhatsApp'}
            </button>
          )}
          <button 
            onClick={exportToExcel}
            className="bg-white border border-gray-200 text-gray-700 px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm hover:bg-gray-50 transition"
          >
            <Download className="h-4 w-4 mr-2" /> Export Excel
          </button>
          <button 
            onClick={() => setShowBulkModal(true)}
            disabled={selectedCustomers.length === 0 || waStatus !== 'READY'}
            title={waStatus !== 'READY' ? "Please connect WhatsApp API first" : ""}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm transition ${selectedCustomers.length > 0 && waStatus === 'READY' ? 'bg-orange-600 text-white hover:bg-orange-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <MessageSquare className="h-4 w-4 mr-2" /> Bulk Message ({selectedCustomers.length})
          </button>
        </div>
      </div>

      {/* QR Code Modal */}
      {showQRModal && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center animate-fade-in">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-bold text-gray-900">Connect WhatsApp</h3>
              <button onClick={() => setShowQRModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mb-6 bg-gray-50 p-6 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center min-h-[250px]">
              {qrCode ? (
                <div className="bg-white p-4 rounded-xl shadow-md flex flex-col items-center">
                  {qrCode.startsWith('data:image') ? (
                    <img src={qrCode} alt="WhatsApp QR Code" className="w-48 h-48" />
                  ) : (
                    <QRCodeSVG value={qrCode} size={192} />
                  )}
                  <p className="mt-4 text-xs text-gray-500 font-medium">Scan this QR code with your WhatsApp app</p>
                </div>
              ) : (waStatus === 'CONNECTING' || waStatus === 'WAITING_QR') ? (
                <div className="flex flex-col items-center">
                  <Loader2 className="h-12 w-12 text-orange-500 animate-spin mb-4" />
                  <p className="text-sm text-gray-600 font-bold">
                    {waStatus === 'WAITING_QR' ? 'Waiting for QR Code...' : 'Connecting to Server...'}
                  </p>
                </div>
              ) : (
                <p className="text-sm text-gray-400">Waiting for server response...</p>
              )}
            </div>

            <div className="text-left space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">1</div>
                <p className="text-xs text-gray-600">Open WhatsApp on your phone</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">2</div>
                <p className="text-xs text-gray-600">Tap Menu or Settings and select Linked Devices</p>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-5 h-5 bg-orange-100 text-orange-600 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">3</div>
                <p className="text-xs text-gray-600">Point your phone to this screen to capture the code</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Queue Progress Bar */}
      {isProcessingQueue && (
        <div className="mb-6 bg-white p-4 rounded-xl border border-orange-100 shadow-sm">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-bold text-orange-600 flex items-center">
              <Loader2 className="h-4 w-4 mr-2 animate-spin" /> Sending {queueProgress.sent + queueProgress.failed} / {queueProgress.total} messages...
            </span>
            <span className="text-xs text-gray-500 font-bold">{queueProgress.percent}% Complete</span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-3 overflow-hidden">
            <div 
              className="bg-orange-500 h-full transition-all duration-300 ease-out" 
              style={{ width: `${queueProgress.percent}%` }}
            />
          </div>
          <div className="mt-2 flex justify-between items-center text-[10px] font-bold">
            <div className="flex gap-4">
              <span className="text-green-600">Sent: {queueProgress.sent}</span>
              <span className="text-red-600">Failed: {queueProgress.failed}</span>
            </div>
            <p className="text-gray-400 italic">Do not close this page while messages are being sent.</p>
          </div>
        </div>
      )}

      {/* Tabs & Filters */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 mb-6 overflow-hidden">
        <div className="flex border-b border-gray-100">
          <button 
            onClick={() => setActiveTab('spending')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition ${activeTab === 'spending' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <DollarSign className="h-4 w-4 mr-2" /> Spending
          </button>
          <button 
            onClick={() => setActiveTab('frequency')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition ${activeTab === 'frequency' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Activity className="h-4 w-4 mr-2" /> Frequency
          </button>
          <button 
            onClick={() => setActiveTab('inactive')}
            className={`flex-1 py-4 text-sm font-bold flex items-center justify-center transition ${activeTab === 'inactive' ? 'text-orange-600 border-b-2 border-orange-600 bg-orange-50/30' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            <Clock className="h-4 w-4 mr-2" /> Inactive
          </button>
        </div>

        <div className="p-4 grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <input 
              type="text"
              placeholder="Search name or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
          <div className="relative">
            <Filter className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <select 
              value={favoriteItemFilter}
              onChange={(e) => setFavoriteItemFilter(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 outline-none appearance-none"
            >
              <option value="All">All Favorite Items</option>
              {uniqueItems.map(item => (
                <option key={item} value={item}>{item}</option>
              ))}
            </select>
          </div>
          <div className="md:col-span-2 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-gray-400 flex-shrink-0" />
            <input 
              type="date"
              value={dateRange.start}
              onChange={(e) => setDateRange(prev => ({ ...prev, start: e.target.value }))}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none"
            />
            <span className="text-gray-400">to</span>
            <input 
              type="date"
              value={dateRange.end}
              onChange={(e) => setDateRange(prev => ({ ...prev, end: e.target.value }))}
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-orange-500 outline-none"
            />
          </div>
        </div>
      </div>

      {showBulkModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Queue Bulk WhatsApp Messages</h3>
              <button onClick={() => setShowBulkModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="text-sm text-gray-500 mb-4">Selected Customers: <span className="font-bold text-orange-600">{selectedCustomers.length}</span></p>
            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Message Template</label>
              <textarea
                value={bulkMessage}
                onChange={(e) => setBulkMessage(e.target.value)}
                className="w-full p-3 border border-gray-200 rounded-lg h-32 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
                placeholder="Type your offer message here..."
              />
            </div>
            <div className="flex gap-3">
              <button 
                onClick={() => setShowBulkModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={startBulkQueue}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center justify-center"
              >
                <Send className="h-4 w-4 mr-2" /> Start Queue
              </button>
            </div>
          </div>
        </div>
      )}

      {showCustomModal && targetCustomer && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Message {targetCustomer.name}</h3>
              <button onClick={() => setShowCustomModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="mb-4 p-3 bg-gray-50 rounded-lg border border-gray-100">
              <div className="flex items-center text-xs text-gray-500 mb-1">
                <Phone className="h-3 w-3 mr-1" /> {targetCustomer.phone}
              </div>
              <div className="grid grid-cols-2 gap-2 mt-2">
                <div className="text-[10px] text-gray-500">AOV: <span className="font-bold text-gray-900">₹{targetCustomer.aov.toFixed(0)}</span></div>
                <div className="text-[10px] text-gray-500">Visits: <span className="font-bold text-gray-900">{targetCustomer.totalOrders}</span></div>
              </div>
            </div>
            <textarea
              value={customMessage}
              onChange={(e) => setCustomMessage(e.target.value)}
              className="w-full p-3 border border-gray-200 rounded-lg h-32 text-sm focus:ring-orange-500 focus:border-orange-500 outline-none mb-4"
              placeholder="Type your custom message here..."
            />
            <div className="flex gap-3">
              <button 
                onClick={() => setShowCustomModal(false)}
                className="flex-1 py-2 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={() => {
                  if (targetCustomer) {
                    const cleanNumber = targetCustomer.phone.replace(/\D/g, '');
                    const finalNumber = cleanNumber.startsWith('91') ? cleanNumber : '91' + cleanNumber;
                    window.open(`https://api.whatsapp.com/send?phone=${finalNumber}&text=${encodeURIComponent(customMessage)}`, '_blank');
                    setShowCustomModal(false);
                  }
                }}
                className="flex-1 py-2 bg-green-600 text-white rounded-lg text-sm font-bold hover:bg-green-700 transition flex items-center justify-center"
              >
                <Send className="h-4 w-4 mr-2" /> Web
              </button>
              <button 
                onClick={handleSendCustomMessage}
                disabled={waStatus !== 'READY'}
                title={waStatus !== 'READY' ? "Please connect WhatsApp API first" : ""}
                className={`flex-1 py-2 rounded-lg text-sm font-bold transition flex items-center justify-center ${waStatus === 'READY' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
              >
                <MessageSquare className="h-4 w-4 mr-2" /> API
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-100">
            <thead>
              <tr className="bg-gray-50 text-gray-600 uppercase text-[10px] font-bold tracking-wider">
                <th className="py-4 px-6 text-left w-10">
                  <input 
                    type="checkbox" 
                    checked={selectedCustomers.length === filteredCustomers.length && filteredCustomers.length > 0}
                    onChange={toggleSelectAll}
                    className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                  />
                </th>
                <th className="py-4 px-6 text-left">Customer & Favorite</th>
                <th className="py-4 px-6 text-left">Analytics (AOV/Visits)</th>
                <th className="py-4 px-6 text-left">Last Visit</th>
                <th className="py-4 px-6 text-left">Segment</th>
                <th className="py-4 px-6 text-center">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filteredCustomers.map((customer) => {
                const status = getStatusLabel(customer);
                return (
                  <tr key={customer.id} className="hover:bg-gray-50/50 transition-colors">
                    <td className="py-4 px-6 text-left">
                      <input 
                        type="checkbox" 
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={() => toggleSelect(customer.id)}
                        className="rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                      />
                    </td>
                    <td className="py-4 px-6 text-left">
                      <div className="flex flex-col">
                        <span className="font-bold text-gray-900">{customer.name}</span>
                        <span className="text-xs text-gray-500 mb-1">{customer.phone}</span>
                        <div className="flex items-center text-[10px] text-orange-600 font-medium bg-orange-50 px-2 py-0.5 rounded w-fit">
                          <TrendingUp className="h-3 w-3 mr-1" /> {customer.mostOrderedItem}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900">AOV: ₹{customer.aov.toFixed(2)}</span>
                        <span className="text-[10px] text-gray-400">Total Spent: ₹{customer.totalSpent.toFixed(0)}</span>
                        <span className="text-[10px] text-gray-500 mt-1 flex items-center">
                          <List className="h-3 w-3 mr-1" /> {customer.totalOrders} visits
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <div className="flex flex-col">
                        <span className="text-xs text-gray-700 font-medium">
                          {getLastVisitLabel(customer.lastOrderedAt)}
                        </span>
                        <span className="text-[10px] text-gray-400">
                          {formatDate(customer.lastOrderedAt)}
                        </span>
                      </div>
                    </td>
                    <td className="py-4 px-6 text-left">
                      <span className={`py-1 px-3 rounded-full text-[10px] font-bold uppercase tracking-wide border flex items-center w-fit ${status.color}`}>
                        {status.label === 'VIP (High Spend)' || status.label === 'VIP (4+ visits)' ? <Award className="h-3 w-3 mr-1" /> : null}
                        {status.label === 'Inactive' ? <AlertCircle className="h-3 w-3 mr-1" /> : null}
                        {status.label}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <button
                        onClick={() => openCustomMessageModal(customer)}
                        className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors flex items-center justify-center mx-auto"
                      >
                        <MessageSquare className="h-4 w-4 mr-1" />
                        <span className="text-[10px] font-bold">WhatsApp</span>
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filteredCustomers.length === 0 && (
          <div className="py-20 text-center">
            <Users className="h-12 w-12 text-gray-200 mx-auto mb-4" />
            <p className="text-gray-500 font-medium">No customers match your filters.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CRM;
