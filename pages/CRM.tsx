import React, { useEffect, useState } from 'react';
import { collection, query, getDocs, doc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useRestaurants } from '../context/RestaurantContext';
import { Order } from '../types';
import { MessageSquare, Download, Phone, TrendingUp, Award, AlertCircle, Send, X, Search, Filter, Calendar, List, DollarSign, Users, Activity, Loader2, Clock, QrCode, Plus, Store } from 'lucide-react';
import { useParams } from 'react-router-dom';
import * as XLSX from 'xlsx';
import { toast } from 'react-hot-toast';
import { sendBulkEvolutionMessage, getEvolutionQR, sendEvolutionMessage, checkConnectionStatus, restartInstance, logoutEvolutionInstance, fetchEvolutionGroups, addParticipantToGroup, createEvolutionGroup, EvolutionGroup, checkWhatsAppNumber } from '../services/evolutionService';
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
  const [restaurantName, setRestaurantName] = useState<string>('Export');
  const [customers, setCustomers] = useState<CustomerData[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!restaurantId) return;
    const fetchRestaurantName = async () => {
      try {
        const docRef = doc(db, 'restaurants', restaurantId);
        const snapshot = await getDoc(docRef);
        if (snapshot.exists()) {
          const data = snapshot.data();
          if (data && data.name) {
            setRestaurantName(data.name);
          }
        }
      } catch (err) {
        console.error("Failed to fetch restaurant details:", err);
      }
    };
    fetchRestaurantName();
  }, [restaurantId]);
  
  // Tabs & Filters
  const [activeTab, setActiveTab] = useState<TabType>('spending');
  const [searchQuery, setSearchQuery] = useState("");
  const [favoriteItemFilter, setFavoriteItemFilter] = useState("All");
  const [dateRange, setDateRange] = useState({ start: "", end: "" });
  
  // Pagination & Export States
  const [visibleCustomersCount, setVisibleCustomersCount] = useState(20);
  const [showExportModal, setShowExportModal] = useState(false);
  const [exportRangeType, setExportRangeType] = useState<string>('all-time');
  const [exportCustomStart, setExportCustomStart] = useState<string>('');
  const [exportCustomEnd, setExportCustomEnd] = useState<string>('');

  useEffect(() => {
    setVisibleCustomersCount(20);
  }, [activeTab, searchQuery, favoriteItemFilter, dateRange]);
  
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
  const [isAutoFixing, setIsAutoFixing] = useState(false);
  const [phoneVerificationMap, setPhoneVerificationMap] = useState<Record<string, 'VERIFIED' | 'NOT_VERIFIED' | 'CHECKING' | 'UNCHECKED'>>({});

  // WhatsApp Group States
  const [showGroupModal, setShowGroupModal] = useState(false);
  const [groupTargetCustomers, setGroupTargetCustomers] = useState<CustomerData[]>([]);
  const [groups, setGroups] = useState<EvolutionGroup[]>([]);
  const [loadingGroups, setLoadingGroups] = useState(false);
  const [activeModalTab, setActiveModalTab] = useState<'add' | 'create'>('add');
  const [newGroupName, setNewGroupName] = useState('');
  const [searchGroupQuery, setSearchGroupQuery] = useState('');
  const [addingProgress, setAddingProgress] = useState<{ current: number; total: number; active: boolean }>({ current: 0, total: 0, active: false });

  const now = new Date();
  const INSTANCE_NAME = restaurantId ? `CraveWave_${restaurantId}` : 'CraveWave_Default';
  const [resolvedInstanceName, setResolvedInstanceName] = useState<string>(INSTANCE_NAME);

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
      
      try {
        // Step 1: Fetch all instances to check actual database registration status (More reliable than single state API)
        const response = await fetch(`https://evo.welcofincarepvt.com/instance/fetchInstances`, {
          headers: { 'apikey': '4a51fbf7d23db2369899f6e2a1c7d2ded42bc4459d4d55f33bfa808f0699cf2' }
        });
        if (response.ok) {
          const list = await response.json();
          // Find matching instance (regardless of slight ID typos e.g., CraveWave_LcZY1OW9aysQYALVnv0x vs CraveWave_LcZY4OW9aysQYALVnv0x)
          const activeInstance = list.find((ins: any) => 
            ins.name.toLowerCase().includes(restaurantId.toLowerCase())
          );
          
          if (activeInstance) {
            setResolvedInstanceName(activeInstance.name);
            if (activeInstance.connectionStatus === 'open') {
              setWaStatus('READY');
              return;
            } else if (activeInstance.connectionStatus === 'connecting') {
              setWaStatus('CONNECTING');
              return;
            } else {
              setWaStatus('DISCONNECTED');
              return;
            }
          }
        }
      } catch (e) {
        console.warn("Instance fetch failed, falling back to connectionState check:", e);
      }

      // Step 2: Fallback to connectionState if list fetch fails
      const status = await checkConnectionStatus(INSTANCE_NAME);
      console.log(`[STATUS FALLBACK] ${INSTANCE_NAME}: ${status}`);
      setResolvedInstanceName(INSTANCE_NAME);
      
      if (status === 'open') {
        setWaStatus('READY');
      } else if (status === 'connecting') {
        setWaStatus('CONNECTING');
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
          
          // If connecting for > 90 seconds (18 checks * 5s)
          if (checks > 18) {
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
  }, [showQRModal, resolvedInstanceName, isConnecting]);

  const handleDisconnect = async () => {
      if (!window.confirm("Are you sure you want to disconnect WhatsApp?")) return;
      
      toast.loading("Disconnecting...", { id: 'disconnect' });
      try {
          await logoutEvolutionInstance(resolvedInstanceName);
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
          await restartInstance(resolvedInstanceName);
          await new Promise(resolve => setTimeout(resolve, 5000));
          toast.success("Instance restarted. Refreshing QR...", { id: 'restart' });
          // Fetch fresh QR
          const qr = await getEvolutionQR(resolvedInstanceName);
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
      const qr = await getEvolutionQR(resolvedInstanceName);
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

  const handleAutoFix = async () => {
    if (isAutoFixing) return;
    setIsAutoFixing(true);
    toast.loading("Initiating Auto-Fix: Resetting WhatsApp Instance...", { id: 'autofix' });
    try {
      // Step 1: Force logout & delete instance to clean up session locks
      await logoutEvolutionInstance(INSTANCE_NAME).catch(() => {});
      // Wait a short moment
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Step 2: Show QR flow to recreate and generate fresh session
      setIsConnecting(true);
      setWaStatus('CONNECTING');
      setShowQRModal(true);
      setQrCode(null);
      
      const qr = await getEvolutionQR(resolvedInstanceName);
      if (qr) {
        setQrCode(qr);
        setWaStatus('WAITING_QR');
        toast.success("Instance Reset! Please scan the new QR code.", { id: 'autofix' });
      } else {
        throw new Error("No QR returned");
      }
    } catch (e: any) {
      console.error("Auto-Fix failed:", e);
      toast.error(e.message || "Auto-Fix failed. Please try again.", { id: 'autofix' });
      setWaStatus('DISCONNECTED');
      setShowQRModal(false);
    } finally {
      setIsConnecting(false);
      setIsAutoFixing(false);
    }
  };

  // WhatsApp Groups fetch when group modal opens
  useEffect(() => {
    if (showGroupModal && waStatus === 'READY') {
      const loadGroups = async () => {
        setLoadingGroups(true);
        try {
          const list = await fetchEvolutionGroups(resolvedInstanceName);
          setGroups(list);
        } catch (e) {
          toast.error("Failed to load WhatsApp groups. Ensure instance is connected.");
        } finally {
          setLoadingGroups(false);
        }
      };
      loadGroups();
    }
  }, [showGroupModal, waStatus, resolvedInstanceName]);

  const handleAddToGroup = async (groupJid: string, groupSubject: string) => {
    if (groupTargetCustomers.length === 0) return;
    
    setAddingProgress({ current: 0, total: groupTargetCustomers.length, active: true });
    let successCount = 0;
    let failCount = 0;
    
    for (let i = 0; i < groupTargetCustomers.length; i++) {
      const customer = groupTargetCustomers[i];
      setAddingProgress(prev => ({ ...prev, current: i + 1 }));
      try {
        await addParticipantToGroup(resolvedInstanceName, groupJid, customer.phone);
        successCount++;
      } catch (err) {
        console.error(`Failed to add ${customer.name} to group:`, err);
        failCount++;
      }
      
      // Safety delay for anti-ban
      if (i < groupTargetCustomers.length - 1) {
        const delay = 2000 + Math.random() * 2000;
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    setAddingProgress({ current: 0, total: 0, active: false });
    setShowGroupModal(false);
    
    if (failCount === 0) {
      toast.success(`Successfully added all ${successCount} customers to "${groupSubject}"!`);
    } else {
      toast.success(`Added ${successCount} customers to "${groupSubject}". ${failCount} failed.`);
    }
  };

  const handleCreateNewGroup = async () => {
    if (!newGroupName.trim()) {
      toast.error("Please enter a group name");
      return;
    }
    if (groupTargetCustomers.length === 0) {
      toast.error("No customers selected for the group");
      return;
    }
    
    toast.loading("Creating new WhatsApp Group...", { id: 'create-group' });
    try {
      const phones = groupTargetCustomers.map(c => c.phone);
      const result = await createEvolutionGroup(resolvedInstanceName, newGroupName, phones);
      toast.success(`Group "${newGroupName}" created successfully!`, { id: 'create-group' });
      setShowGroupModal(false);
      setNewGroupName('');
      // Reload groups list
      const list = await fetchEvolutionGroups(resolvedInstanceName).catch(() => []);
      setGroups(list);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Failed to create group", { id: 'create-group' });
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

  // Auto-verify WhatsApp numbers for loaded customers when WA is READY
  useEffect(() => {
    if (waStatus === 'READY' && customers.length > 0) {
      const verifyNumbers = async () => {
        // Initialize unchecked status for all loaded customers
        const initialMap: Record<string, any> = { ...phoneVerificationMap };
        let needsCheck = false;
        
        customers.forEach(c => {
          if (!initialMap[c.phone]) {
            initialMap[c.phone] = 'UNCHECKED';
            needsCheck = true;
          }
        });
        
        if (needsCheck) {
          setPhoneVerificationMap(initialMap);
        }

        // Process batch check sequentially with anti-ban delay
        for (const customer of customers) {
          if (phoneVerificationMap[customer.phone] && phoneVerificationMap[customer.phone] !== 'UNCHECKED') {
            continue;
          }
          
          setPhoneVerificationMap(prev => ({ ...prev, [customer.phone]: 'CHECKING' }));
          
          try {
            const exists = await checkWhatsAppNumber(resolvedInstanceName, customer.phone);
            setPhoneVerificationMap(prev => ({ 
              ...prev, 
              [customer.phone]: exists ? 'VERIFIED' : 'NOT_VERIFIED' 
            }));
          } catch (err) {
            setPhoneVerificationMap(prev => ({ ...prev, [customer.phone]: 'NOT_VERIFIED' }));
          }
          
          // Small sleep between checks to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 800));
        }
      };
      
      verifyNumbers();
    }
  }, [waStatus, customers, resolvedInstanceName]);


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
        resolvedInstanceName,
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
    setCustomMessage(`Hello ${customer.name}, we have a special surprise for you at ${currentRestaurant?.name || restaurantName || 'our restaurant'}!`);
    setShowCustomModal(true);
  };

  const handleSendCustomMessage = async () => {
    if (targetCustomer && customMessage.trim()) {
      try {
        toast.loading("Sending message...", { id: 'send-custom' });
        await sendEvolutionMessage(resolvedInstanceName, targetCustomer.phone, customMessage);
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
    if (filteredCustomers.length === 0) {
      toast.error("No customers in the current list to export");
      return;
    }
    setShowExportModal(true);
  };

  const triggerExcelExport = () => {
    let exportFiltered = filteredCustomers;
    const now = new Date();

    if (exportRangeType !== 'all-time') {
      let cutoff: Date | null = null;
      if (exportRangeType === '1-week') {
        cutoff = new Date();
        cutoff.setDate(now.getDate() - 7);
      } else if (exportRangeType === '1-month') {
        cutoff = new Date();
        cutoff.setDate(now.getDate() - 30);
      } else if (exportRangeType === '3-months') {
        cutoff = new Date();
        cutoff.setDate(now.getDate() - 90);
      } else if (exportRangeType === '6-months') {
        cutoff = new Date();
        cutoff.setDate(now.getDate() - 180);
      } else if (exportRangeType === '1-year') {
        cutoff = new Date();
        cutoff.setDate(now.getDate() - 365);
      }

      if (cutoff) {
        cutoff.setHours(0, 0, 0, 0);
        exportFiltered = exportFiltered.filter(c => new Date(c.lastOrderedAt) >= cutoff!);
      } else if (exportRangeType === 'custom') {
        if (!exportCustomStart || !exportCustomEnd) {
          toast.error("Please select both start and end dates for custom export");
          return;
        }
        const start = new Date(exportCustomStart);
        start.setHours(0, 0, 0, 0);
        const end = new Date(exportCustomEnd);
        end.setHours(23, 59, 59, 999);
        exportFiltered = exportFiltered.filter(c => {
          const lastVisit = new Date(c.lastOrderedAt);
          return lastVisit >= start && lastVisit <= end;
        });
      }
    }

    if (exportFiltered.length === 0) {
      toast.error("No customer records found for the selected date range");
      return;
    }

    const exportData = exportFiltered.map(c => ({
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
    
    const rawRestaurantName = currentRestaurant?.name || restaurantName;
    const safeRestaurantName = rawRestaurantName.replace(/[^a-zA-Z0-9\-_]/g, '_').trim();
    const segmentName = activeTab === 'spending' ? 'Spending' : activeTab === 'frequency' ? 'Frequency' : 'Inactive';
    const filename = `Customers_${segmentName}_${safeRestaurantName}_${new Date().toISOString().split('T')[0]}.xlsx`;

    try {
      const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'base64' });
      const url = 'data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,' + wbout;
      const a = document.createElement('a');
      a.style.display = 'none';
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      
      // Clean up link after click
      setTimeout(() => {
        if (document.body.contains(a)) {
          document.body.removeChild(a);
        }
      }, 1000);
      
      toast.success("Customers exported successfully");
    } catch (err) {
      console.error("Export failed:", err);
      toast.error("Failed to generate Excel download");
    }
    
    setShowExportModal(false);
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
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-600 mr-2">
                {waStatus === 'READY' ? 'Connected' : 
                 (waStatus === 'CONNECTING' || waStatus === 'WAITING_QR') ? 'Connecting...' : 
                 'Disconnected'}
              </span>
              {(waStatus === 'CONNECTING' || waStatus === 'WAITING_QR') && (
                <button 
                  onClick={handleAutoFix}
                  disabled={isAutoFixing}
                  className="text-[9px] bg-red-100 text-red-600 hover:bg-red-200 px-1.5 py-0.5 rounded font-bold transition flex items-center gap-1"
                  title="Force Instance Reboot and Session Refresh"
                >
                  {isAutoFixing ? 'Fixing...' : 'Auto-Fix ⚡'}
                </button>
              )}
            </div>
          </div>
          <p className="text-sm text-gray-500 flex items-center">
            <Users className="h-4 w-4 mr-1" /> Managing {customers.length} customers for <span className="font-bold text-orange-600 ml-1">{currentRestaurant?.name || restaurantName}</span>
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
            <div className="flex items-center gap-2">
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
              {(waStatus === 'CONNECTING' || waStatus === 'WAITING_QR' || waStatus === 'CLOSE') && (
                <button 
                  onClick={handleDisconnect}
                  className="bg-red-50 text-red-500 border border-red-100 px-3 py-2 rounded-lg text-xs font-semibold flex items-center hover:bg-red-100 transition shadow-sm"
                  title="Force Reset Session"
                >
                  <X className="h-3.5 w-3.5 mr-1" /> Reset
                </button>
              )}
            </div>
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
          <button 
            onClick={() => {
              const selectedObjects = customers.filter(c => selectedCustomers.includes(c.id));
              setGroupTargetCustomers(selectedObjects);
              setShowGroupModal(true);
            }}
            disabled={selectedCustomers.length === 0 || waStatus !== 'READY'}
            title={waStatus !== 'READY' ? "Please connect WhatsApp API first" : ""}
            className={`px-4 py-2 rounded-lg text-sm font-bold flex items-center shadow-sm transition ${selectedCustomers.length > 0 && waStatus === 'READY' ? 'bg-blue-600 text-white hover:bg-blue-700' : 'bg-gray-100 text-gray-400 cursor-not-allowed'}`}
          >
            <Plus className="h-4 w-4 mr-2" /> Add Group ({selectedCustomers.length})
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
              {filteredCustomers.slice(0, visibleCustomersCount).map((customer) => {
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
                        <div className="flex items-center gap-1.5 mb-1">
                          <span className="text-xs text-gray-500">{customer.phone}</span>
                          {waStatus === 'READY' && (
                            <>
                              {phoneVerificationMap[customer.phone] === 'VERIFIED' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-green-50 text-green-700 border border-green-200">
                                  WhatsApp
                                </span>
                              )}
                              {phoneVerificationMap[customer.phone] === 'NOT_VERIFIED' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-red-50 text-red-700 border border-red-200">
                                  Not Found
                                </span>
                              )}
                              {phoneVerificationMap[customer.phone] === 'CHECKING' && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-50 text-amber-700 border border-amber-200 animate-pulse">
                                  Checking...
                                </span>
                              )}
                            </>
                          )}
                        </div>
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
                      <div className="flex items-center justify-center gap-2">
                        <button
                          onClick={() => openCustomMessageModal(customer)}
                          className="p-2 bg-green-50 hover:bg-green-100 text-green-600 rounded-lg transition-colors flex items-center justify-center"
                          title="Send WhatsApp Message"
                        >
                          <MessageSquare className="h-4 w-4 mr-1" />
                          <span className="text-[10px] font-bold">WhatsApp</span>
                        </button>
                        <button
                          onClick={() => {
                            setGroupTargetCustomers([customer]);
                            setShowGroupModal(true);
                          }}
                          disabled={waStatus !== 'READY'}
                          title={waStatus !== 'READY' ? "Please connect WhatsApp API first" : "Add to Group"}
                          className={`p-2 rounded-lg transition-colors flex items-center justify-center ${waStatus === 'READY' ? 'bg-blue-50 hover:bg-blue-100 text-blue-600' : 'bg-gray-50 text-gray-400 cursor-not-allowed'}`}
                        >
                          <Plus className="h-4 w-4 mr-1" />
                          <span className="text-[10px] font-bold">Group</span>
                        </button>
                      </div>
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

      {filteredCustomers.length > visibleCustomersCount && (
        <div className="flex justify-center mt-6 mb-4">
          <button
            onClick={() => setVisibleCustomersCount(prev => prev + 20)}
            className="px-6 py-2.5 bg-white text-[#FF5722] hover:bg-orange-50 border border-orange-200 rounded-xl text-sm font-bold shadow-sm hover:shadow transition flex items-center gap-1.5"
          >
            <Plus className="h-4 w-4" /> Load More Customers ({filteredCustomers.length - visibleCustomersCount} remaining)
          </button>
        </div>
      )}

      {/* Export Range Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">Export Customers to Excel</h3>
              <button onClick={() => setShowExportModal(false)} className="text-gray-400 hover:text-gray-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-4 p-3 bg-orange-50 rounded-lg border border-orange-100 text-xs">
              <span className="font-bold text-orange-800">Exporting Segment: </span>
              <span className="font-semibold text-gray-700 capitalize">
                {activeTab === 'spending' ? 'Spending' : activeTab === 'frequency' ? 'Frequency' : 'Inactive'}
              </span>
              <div className="text-[10px] text-gray-500 mt-1">
                This will export customers matching the active filters on this tab.
              </div>
            </div>

            <div className="mb-4">
              <label className="block text-xs font-bold text-gray-700 mb-2 uppercase tracking-wider">Select Export Timeframe</label>
              <select
                value={exportRangeType}
                onChange={(e) => setExportRangeType(e.target.value)}
                className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-orange-500 focus:border-orange-500 outline-none"
              >
                <option value="all-time">All Time</option>
                <option value="1-week">Last 7 Days (1 Week)</option>
                <option value="1-month">Last 30 Days (1 Month)</option>
                <option value="3-months">Last 90 Days (3 Months)</option>
                <option value="6-months">Last 180 Days (6 Months)</option>
                <option value="1-year">Last 365 Days (1 Year)</option>
                <option value="custom">Custom Date Range</option>
              </select>
            </div>

            {exportRangeType === 'custom' && (
              <div className="grid grid-cols-2 gap-3 mb-5 animate-fade-in">
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">Start Date</label>
                  <input
                    type="date"
                    value={exportCustomStart}
                    onChange={(e) => setExportCustomStart(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-orange-500 outline-none"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-gray-500 mb-1 uppercase">End Date</label>
                  <input
                    type="date"
                    value={exportCustomEnd}
                    onChange={(e) => setExportCustomEnd(e.target.value)}
                    className="w-full p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-orange-500 outline-none"
                  />
                </div>
              </div>
            )}

            <div className="flex gap-3">
              <button 
                onClick={() => setShowExportModal(false)}
                className="flex-1 py-2.5 border border-gray-300 rounded-lg text-sm font-medium hover:bg-gray-50 transition"
              >
                Cancel
              </button>
              <button 
                onClick={triggerExcelExport}
                className="flex-1 py-2.5 bg-orange-600 text-white rounded-lg text-sm font-bold hover:bg-orange-700 transition flex items-center justify-center"
              >
                <Download className="h-4 w-4 mr-2" /> Export
              </button>
            </div>
          </div>
        </div>
      )}

      {/* WhatsApp Group Modal */}
      {showGroupModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl max-w-md w-full p-6 animate-fade-in flex flex-col max-h-[90vh]">
            <div className="flex justify-between items-center mb-4">
              <div>
                <h3 className="text-lg font-bold text-gray-900">WhatsApp Group Management</h3>
                <p className="text-xs text-gray-500">
                  Target: <span className="font-bold text-blue-600">{groupTargetCustomers.length}</span> customer(s)
                </p>
              </div>
              <button 
                onClick={() => {
                  if (!addingProgress.active) {
                    setShowGroupModal(false);
                    setNewGroupName('');
                  }
                }} 
                disabled={addingProgress.active}
                className="text-gray-400 hover:text-gray-600 disabled:opacity-30"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {addingProgress.active ? (
              <div className="py-8 text-center flex flex-col items-center">
                <Loader2 className="h-12 w-12 text-blue-600 animate-spin mb-4" />
                <p className="text-sm font-bold text-gray-800">Adding to group...</p>
                <p className="text-xs text-gray-500 mt-1">
                  Processing customer {addingProgress.current} of {addingProgress.total}
                </p>
                <div className="w-full bg-gray-100 rounded-full h-2 mt-4 overflow-hidden">
                  <div 
                    className="bg-blue-600 h-full transition-all duration-300"
                    style={{ width: `${(addingProgress.current / addingProgress.total) * 100}%` }}
                  />
                </div>
                <p className="text-[10px] text-gray-400 italic mt-3">
                  Using safe random anti-ban delays. Do not close this modal.
                </p>
              </div>
            ) : (
              <>
                {/* Tabs */}
                <div className="flex border-b border-gray-100 mb-4">
                  <button
                    onClick={() => setActiveModalTab('add')}
                    className={`flex-1 pb-2 text-sm font-bold transition-all border-b-2 ${activeModalTab === 'add' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                  >
                    Add to Existing Group
                  </button>
                  <button
                    onClick={() => setActiveModalTab('create')}
                    className={`flex-1 pb-2 text-sm font-bold transition-all border-b-2 ${activeModalTab === 'create' ? 'text-blue-600 border-blue-600' : 'text-gray-400 border-transparent hover:text-gray-600'}`}
                  >
                    Create New Group
                  </button>
                </div>

                {activeModalTab === 'add' ? (
                  <div className="flex-1 flex flex-col overflow-hidden min-h-[300px]">
                    {/* Search Groups */}
                    <div className="relative mb-3">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                      <input
                        type="text"
                        placeholder="Search groups..."
                        value={searchGroupQuery}
                        onChange={(e) => setSearchGroupQuery(e.target.value)}
                        className="w-full pl-9 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    {loadingGroups ? (
                      <div className="flex-1 flex flex-col items-center justify-center py-10">
                        <Loader2 className="h-8 w-8 text-blue-600 animate-spin mb-2" />
                        <p className="text-xs text-gray-500 font-medium">Fetching groups from WhatsApp...</p>
                      </div>
                    ) : (
                      <div className="flex-1 overflow-y-auto space-y-2 pr-1 max-h-[350px]">
                        {groups
                          .filter(g => g.subject.toLowerCase().includes(searchGroupQuery.toLowerCase()))
                          .map(group => (
                            <div 
                              key={group.id} 
                              className="p-3 bg-gray-50 rounded-lg border border-gray-100 flex justify-between items-center hover:bg-blue-50/30 transition-colors"
                            >
                              <div className="flex items-center gap-2 overflow-hidden mr-2">
                                <Store className="h-5 w-5 text-blue-500 flex-shrink-0" />
                                <div className="text-left overflow-hidden">
                                  <p className="text-xs font-bold text-gray-900 truncate" title={group.subject}>
                                    {group.subject}
                                  </p>
                                  <p className="text-[10px] text-gray-500 truncate" title={group.id}>
                                    ID: {group.id}
                                  </p>
                                </div>
                              </div>
                              <button
                                onClick={() => handleAddToGroup(group.id, group.subject)}
                                className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg text-xs font-bold transition flex-shrink-0"
                              >
                                Add Member
                              </button>
                            </div>
                          ))}

                        {groups.filter(g => g.subject.toLowerCase().includes(searchGroupQuery.toLowerCase())).length === 0 && (
                          <div className="text-center py-8 text-gray-400 text-xs">
                            No groups found.
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1 uppercase tracking-wider">Group Name</label>
                      <input
                        type="text"
                        value={newGroupName}
                        onChange={(e) => setNewGroupName(e.target.value)}
                        placeholder="e.g. VIP Club Touchwood"
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 outline-none"
                      />
                    </div>

                    <div className="p-3 bg-blue-50 rounded-lg border border-blue-100 text-xs text-blue-800">
                      <p className="font-bold mb-1">Creating WhatsApp Group directly:</p>
                      <ul className="list-disc list-inside space-y-1 text-[11px] text-blue-700">
                        <li>Creates a WhatsApp Group on your phone automatically.</li>
                        <li>Initializes the group with selected customer numbers.</li>
                        <li>Connected instance must have admin rights on WhatsApp.</li>
                      </ul>
                    </div>

                    <button
                      onClick={handleCreateNewGroup}
                      className="w-full py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5"
                    >
                      <Plus className="h-4 w-4" /> Create Group & Add Customers
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default CRM;
