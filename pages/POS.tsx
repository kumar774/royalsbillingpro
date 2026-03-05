import React, { useState, useEffect, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot, addDoc, doc, updateDoc, increment, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { MenuItem, CartItem, OrderType, Restaurant, PaymentMethod, Variant, Order, TaxSettings } from '../types';
import { Search, Plus, Minus, Trash2, CreditCard, Loader2, Printer, MessageSquare, CheckCircle, User, Phone, Wallet, QrCode, Tag, X, Bike, Utensils, ShoppingBag, Receipt, Copy, Download } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { toast } from 'react-hot-toast';
import { generateProfessionalReceipt } from '../components/ReceiptPDF';
import { Edit2 } from 'lucide-react';
import { sendTelegramMessage, formatOrderMessage } from '../services/telegramService';


interface LastOrderDetails {
  id: string;
  formattedId?: string;
  total: number;
  items: CartItem[];
  upiUrl: string;
  paymentMethod: PaymentMethod;
  paymentStatus?: string;
  customerName: string;
  customerPhone: string;
  discount: number;
  deliveryCharge: number;
  subtotal: number;
  orderType: string;
  createdAt: string;
  taxDetails: {
      gstRate: number;
      gstAmount: number;
      serviceRate: number;
      serviceAmount: number;
  };
  restaurantIds: string[];
  paymentQrLink: string;
}

const POS: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();

  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<MenuItem[]>([]);

  const [activeCategoryGroup, setActiveCategoryGroup] = useState<string | 'All'>('All'); // New state for category groups
  const [searchTerm, setSearchTerm] = useState('');
  
  // Local Cart State for POS
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  
  // Admin Order Inputs
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Cash');
  const [discount, setDiscount] = useState<string>(''); 
  const [deliveryCharge, setDeliveryCharge] = useState<number>(0);
  
  // Bill Modal State
  const [showBillModal, setShowBillModal] = useState(false);
  const [lastOrderDetails, setLastOrderDetails] = useState<LastOrderDetails | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [tempCategoryOrder, setTempCategoryOrder] = useState<string[]>([]);
  const [showImages, setShowImages] = useState(true);

  const printReceipt = async (order: LastOrderDetails) => {
    if (!restaurantData) return;
    generateProfessionalReceipt(order, restaurantData, 'print');
  };

  const downloadReceipt = async (order: LastOrderDetails) => {
    if (!restaurantData) return;
    generateProfessionalReceipt(order, restaurantData, 'download');
  };
  
  // Active Restaurant Settings
  const [restaurantData, setRestaurantData] = useState<(Restaurant & import('../types').RestaurantSettings) | null>(null);
  const [taxSettings, setTaxSettings] = useState<TaxSettings>({
      gstPercentage: 0,
      serviceChargePercentage: 0,
      applyTax: false
  });
  const [currency, setCurrency] = useState('₹');

  // Variant Modal State
  const [selectedItemForVariants, setSelectedItemForVariants] = useState<MenuItem | null>(null);
  const [isVariantModalOpen, setIsVariantModalOpen] = useState(false);

  useEffect(() => {
    if (restaurantId) {
        // 1. Listen to basic restaurant data
        const unsubRestaurant = onSnapshot(doc(db, 'restaurants', restaurantId), (snap) => {
            if(snap.exists()) {
                setRestaurantData(prev => ({ ...(prev || {} as Restaurant), ...(snap.data() as Restaurant) }));
            }
        });

        // 2. Listen to configuration for billing (tax, service charge, UPI)
        const unsubConfig = onSnapshot(doc(db, 'restaurants', restaurantId, 'config', 'main'), (snap) => {
            if (snap.exists()) {
                const configData = snap.data();
                
                if (configData.taxSettings) {
                    setTaxSettings(configData.taxSettings);
                }
                if (configData.currency) {
                    setCurrency(configData.currency);
                }

                // Merge config data into restaurantData to ensure UPI and other settings are up to date
                setRestaurantData(prev => {
                    if (!prev) return null;
                    return {
                        ...prev,
                        ...configData
                    };
                });
            }
        });

        return () => {
            unsubRestaurant();
            unsubConfig();
        };
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;
    const unsubscribe = onSnapshot(collection(db, 'restaurants', restaurantId, 'menu'), (snapshot) => {
      const items = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MenuItem));
      setMenuItems(items);
      setFilteredItems(items);
    });
    return () => unsubscribe();
  }, [restaurantId]);

  // Handle Delivery Charge Default
  useEffect(() => {
    if (orderType === 'Delivery' && restaurantData?.defaultDeliveryCharge) {
        setDeliveryCharge(restaurantData.defaultDeliveryCharge);
    } else if (orderType !== 'Delivery') {
        setDeliveryCharge(0);
    }
  }, [orderType, restaurantData?.defaultDeliveryCharge]);

  // Derive unique category groups
  const categoryGroups = useMemo(() => {
    if (!restaurantData?.categoryOrder) {
        const groups = Array.from(new Set(menuItems.map(item => item.categoryGroup).filter(Boolean) as string[]));
        return ['All', ...groups];
    }
    const orderedGroups = restaurantData?.categoryOrder?.filter(group => 
        menuItems.some(item => item.categoryGroup === group)
    );
    const newGroups = menuItems
        .map(item => item.categoryGroup)
        .filter((group): group is string => !!group && !orderedGroups?.includes(group));
    const uniqueNewGroups = [...new Set(newGroups)];
    return ['All', ...orderedGroups, ...uniqueNewGroups];
}, [menuItems, restaurantData?.categoryOrder]);

  useEffect(() => {
    let result = menuItems;

    if (activeCategoryGroup !== 'All') {
      result = result.filter(item => item.categoryGroup === activeCategoryGroup);
    }
    if (searchTerm) {
      result = result.filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
        item.id.includes(searchTerm)
      );
    }
    setFilteredItems(result);
  }, [activeCategoryGroup, searchTerm, menuItems]);

  const handleSelectVariant = (item: MenuItem) => {
    setSelectedItemForVariants(item);
    setIsVariantModalOpen(true);
  };

  const addToCart = (item: MenuItem, variant?: Variant) => {
    if (item.variants && item.variants.length > 1 && !variant) {
      // This case should ideally be handled by onSelectVariant prop from MenuItemCard
      // but as a fallback or direct call, ensure modal opens.
      setSelectedItemForVariants(item);
      setIsVariantModalOpen(true);
      return;
    }

    // If there's exactly 1 variant and no variant was passed, use that single variant
    const effectiveVariant = variant || (item.variants && item.variants.length === 1 ? item.variants[0] : undefined);

    setCart(prev => {
      const itemKey = effectiveVariant ? `${item.id}-${effectiveVariant.size}` : item.id;
      const existing = prev.find(i => {
        const iKey = i.selectedVariant ? `${i.id}-${i.selectedVariant.size}` : i.id;
        return iKey === itemKey;
      });

      if (existing) {
        return prev.map(i => {
          const iKey = i.selectedVariant ? `${i.id}-${i.selectedVariant.size}` : i.id;
          return iKey === itemKey ? { ...i, quantity: i.quantity + 1 } : i;
        });
      }

      const newItem: CartItem = {
        ...item,
        quantity: 1,
        price: effectiveVariant ? effectiveVariant.price : item.price,
        selectedVariant: effectiveVariant
      };
      return [...prev, newItem];
    });
    setIsVariantModalOpen(false);
    setSelectedItemForVariants(null);
  };

  const updateQuantity = (itemKey: string, delta: number) => {
    setCart(prev => prev.map(i => {
      const currentKey = i.selectedVariant ? `${i.id}-${i.selectedVariant.size}` : i.id;
      if (currentKey === itemKey) return { ...i, quantity: Math.max(0, i.quantity + delta) };
      return i;
    }).filter(i => i.quantity > 0));
  };

  const removeFromCart = (itemKey: string) => {
    setCart(prev => prev.filter(i => {
      const currentKey = i.selectedVariant ? `${i.id}-${i.selectedVariant.size}` : i.id;
      return currentKey !== itemKey;
    }));
  };

  const startNewOrder = () => {
      setCart([]);
      setCustomerName('');
      setCustomerPhone('');
      setOrderType('Dine-in');
      setPaymentMethod('Cash');
      setDiscount('');
      setDeliveryCharge(0);
      setShowBillModal(false);
      setLastOrderDetails(null);
  };

  const isValidPhone = (phone: string) => /^\d{10}$/.test(phone.trim());
  const isFormValid = customerName.trim() !== '' && isValidPhone(customerPhone);

  // --- BILL CALCULATION LOGIC ---
  const calculateBill = () => {
    const subtotal = cart.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const discountAmount = Number(discount) || 0;
    
    // Taxable amount (usually Post-Discount)
    const taxableAmount = Math.max(0, subtotal - discountAmount);

    let gstAmount = 0;
    let serviceAmount = 0;
    
    // Use fetched tax settings
    const gstRate = taxSettings.gstPercentage || 0;
    const serviceRate = taxSettings.serviceChargePercentage || 0;
    const applyTax = taxSettings.applyTax ?? false;
    
    if (applyTax) {
        if (gstRate > 0) gstAmount = taxableAmount * (gstRate / 100);
        if (serviceRate > 0) serviceAmount = taxableAmount * (serviceRate / 100);
    }

    const activeDeliveryCharge = orderType === 'Delivery' ? Number(deliveryCharge) || 0 : 0;
    
    // Final Total
    const total = taxableAmount + gstAmount + serviceAmount + activeDeliveryCharge;
    
    return { 
        subtotal, 
        discountAmount, 
        gstAmount, 
        serviceAmount, 
        total, 
        gstRate, 
        serviceRate, 
        activeDeliveryCharge
    };
  };

  const { subtotal, discountAmount, gstAmount, serviceAmount, total, gstRate, serviceRate, activeDeliveryCharge } = calculateBill();

  const handlePlaceOrder = async () => {
    if (cart.length === 0) return;
    
    if (!isFormValid) {
        toast.error("Please enter a valid Name and 10-digit Phone Number.");
        return;
    }

    if (!restaurantId) {
        toast.error("Missing Restaurant ID. Cannot place order.");
        return;
    }

    setIsProcessing(true);
    const toastId = toast.loading(`Placing order...`);
    
    try {
      // STEP 1: Fetch fresh nextOrderNumber from config/main
      const configRef = doc(db, 'restaurants', restaurantId, 'config', 'main');
      const configSnap = await getDoc(configRef);
      
      if (!configSnap.exists()) {
          throw new Error("Restaurant configuration not found.");
      }
      
      const configData = configSnap.data();
      const prefix = configData.orderIdPrefix || '';
      const nextNum = Number(configData.nextOrderNumber) || 1;
      
      // Generate Custom Order ID
      const formattedId = `${prefix}${String(nextNum).padStart(5, '0')}`;

      const orderData = {
            restaurantId: restaurantId,
            formattedId: formattedId, // Store the custom ID
            items: cart.map(item => ({
                ...item,
                selectedVariant: item.selectedVariant || null,
            })),
            total: total || 0,
            subtotal: subtotal || 0,
            discount: discountAmount || 0,
            deliveryCharge: activeDeliveryCharge || 0,
            taxDetails: {
                gstRate: gstRate || 0,
                gstAmount: gstAmount || 0,
                serviceRate: serviceRate || 0,
                serviceAmount: serviceAmount || 0,
            },
            status: 'Pending',
            paymentStatus: 'Pending', // Always set to Pending for admin to confirm
            paymentMethod: paymentMethod || 'Cash',
            orderType: orderType || 'Dine-in',
            source: 'Reception',
            orderSource: 'Admin',
            createdAt: new Date().toISOString(),
            tableNo: orderType === 'Dine-in' ? 'Walk-in' : 'N/A',
            customerName: customerName || 'Guest',
            customerPhone: customerPhone || 'N/A'
          };

      const docRef = await addDoc(collection(db, 'restaurants', restaurantId, 'orders'), orderData);
      const newOrderId = docRef.id;
      
      // Send Telegram Notification
      if (restaurantData?.notificationSettings?.adminOrderAlert && 
          restaurantData?.notificationSettings?.telegramToken && 
          restaurantData?.notificationSettings?.telegramChatId) {
        const message = formatOrderMessage(orderData as Order, restaurantData.name);
        sendTelegramMessage(
          restaurantData.notificationSettings.telegramToken,
          restaurantData.notificationSettings.telegramChatId,
          message
        ).catch(err => console.error("Telegram notification failed:", err));
      }

      // STEP 3: Increment nextOrderNumber in config/main document
      await updateDoc(configRef, {
          nextOrderNumber: increment(1)
      });

      // Update local state to reflect the increment for subsequent orders in same session if needed
      setRestaurantData(prev => prev ? { ...prev, nextOrderNumber: nextNum + 1 } : null);
      
      const upiId = restaurantData?.upiId;
      const paymentQrLink = restaurantData?.paymentQrLink; // Fetch paymentQrLink
      let upiUrl = '';
      if (upiId) {
          const payeeName = restaurantData?.name.replace(/ /g, '%20') || 'Restaurant';
          upiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${total.toFixed(2)}&cu=INR&tn=${newOrderId}`;
      }
      
      setLastOrderDetails({ 
          id: newOrderId, 
          formattedId: formattedId,
          total, 
          items: [...cart],
          upiUrl,
          paymentMethod,
          paymentStatus: 'Pending',
          customerName,
          customerPhone,
          discount: discountAmount,
          deliveryCharge: activeDeliveryCharge,
          subtotal,
          orderType,
          createdAt: orderData.createdAt,
          taxDetails: { gstRate, gstAmount, serviceRate, serviceAmount },
          restaurantIds: [restaurantId],
          paymentQrLink: paymentQrLink
      });
      
      // Reset customer details after successful order
      setCustomerName('');
      setCustomerPhone('');
      
      setCart([]); 
      toast.success("Orders placed successfully!", { id: toastId });
      setShowBillModal(true);
      
    } catch (err) {
      console.error("POS Order Failed", err);
      toast.error("Failed to place order: " + err.message, { id: toastId });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleMarkAsPaidPOS = async () => {
    if (!restaurantId || !lastOrderDetails) return;
    const toastId = toast.loading("Marking order as paid...");
    try {
      const orderRef = doc(db, 'restaurants', restaurantId, 'orders', lastOrderDetails.id);
      await updateDoc(orderRef, { paymentStatus: 'Paid' });
      
      // Send Telegram Notification
      if (restaurantData?.notificationSettings?.paymentStatusUpdate && 
          restaurantData?.notificationSettings?.telegramToken && 
          restaurantData?.notificationSettings?.telegramChatId) {
        const message = `💳 *Payment Received*\n\n` +
                        `Order: #${lastOrderDetails.formattedId || lastOrderDetails.id.slice(0, 6)}\n` +
                        `Customer: ${lastOrderDetails.customerName}\n` +
                        `Amount: ${currency}${lastOrderDetails.total.toFixed(2)}\n` +
                        `Status: *PAID*`;
        sendTelegramMessage(
          restaurantData.notificationSettings.telegramToken,
          restaurantData.notificationSettings.telegramChatId,
          message
        ).catch(err => console.error("Telegram notification failed:", err));
      }

      toast.success("Order marked as Paid", { id: toastId });
      setLastOrderDetails(prev => prev ? { ...prev, paymentStatus: 'Paid' } : null);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      toast.error("Failed to mark as paid: " + message, { id: toastId });
    }
  };

  const handleCopyUpi = () => {
    if (restaurantData?.upiId) {
        navigator.clipboard.writeText(restaurantData.upiId);
        toast.success('UPI ID copied to clipboard!');
    }
  };

  const sanitizePhoneNumber = (phone: string): string => {
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 10) {
      return '91' + cleaned;
    }
    if (cleaned.length === 12 && cleaned.startsWith('91')) {
      return cleaned;
    }
    if (cleaned.length > 10) {
      return '91' + cleaned.slice(-10);
    }
    return cleaned;
  };

  const handleWhatsApp = async () => {
    if (!lastOrderDetails || !restaurantData) return;
    const { 
        total, paymentMethod, customerName, customerPhone, upiUrl, paymentQrLink, formattedId
    } = lastOrderDetails;

    let message = `Hello ${customerName || 'Guest'}, your order from ${restaurantData.name} has been placed successfully!\n\n`;
    message += `Order ID: ${formattedId || lastOrderDetails.id.slice(0, 6)}\n\n`;
    message += `Items:\n`;
    lastOrderDetails.items.forEach(item => {
        message += `- ${item.quantity}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size})` : ''} (${currency}${((item.selectedVariant?.price || item.price) * item.quantity).toFixed(2)})\n`;
    });
    message += `\nSubtotal: ${currency}${lastOrderDetails.subtotal.toFixed(2)}\n`;
    if (lastOrderDetails.taxDetails.gstAmount > 0) {
      message += `GST (${lastOrderDetails.taxDetails.gstRate}%): ${currency}${lastOrderDetails.taxDetails.gstAmount.toFixed(2)}\n`;
    }
    if (lastOrderDetails.taxDetails.serviceAmount > 0) {
      message += `Service Charge: ${currency}${lastOrderDetails.taxDetails.serviceAmount.toFixed(2)}\n`;
    }
    message += `Grand Total: ${currency}${total.toFixed(2)}\n\n`;
    message += `Payment Method: ${paymentMethod}\n`;

    if (paymentMethod === 'Online') {
        if (upiUrl) {
            message += `\nPay via App: ${upiUrl}\n`;
        }
        if (paymentQrLink) {
            message += `\nScan Now to Pay: ${paymentQrLink}\n`;
        }
    }

    if (restaurantData.location || restaurantData.whatsappNumber) {
        message += `\n---\n`;
        if (restaurantData.location) message += `${restaurantData.location}\n`;
        if (restaurantData.whatsappNumber) message += `Tel: ${restaurantData.whatsappNumber}\n`;
    }

    const sanitizedPhone = sanitizePhoneNumber(customerPhone);
    const whatsappUrl = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };


  const [draggedItemIndex, setDraggedItemIndex] = useState<number | null>(null);

  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    setDraggedItemIndex(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.preventDefault();
    if (draggedItemIndex === null || draggedItemIndex === index) return;

    const items = Array.from(tempCategoryOrder);
    const draggedItem = items[draggedItemIndex];
    items.splice(draggedItemIndex, 1);
    items.splice(index, 0, draggedItem);

    setTempCategoryOrder(items);
    setDraggedItemIndex(index);
  };

  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDraggedItemIndex(null);
  };

  const handleSaveCategoryOrder = () => {
    if (restaurantId) {
        const restaurantRef = doc(db, 'restaurants', restaurantId);
        updateDoc(restaurantRef, { categoryOrder: tempCategoryOrder });
        if (restaurantData) {
            setRestaurantData({ ...restaurantData, categoryOrder: tempCategoryOrder });
        }
        setActiveCategoryGroup(tempCategoryOrder.length > 0 ? tempCategoryOrder[0] : 'All');
        toast.success('Category order saved!');
        setIsCategoryModalOpen(false);
    }
  };

  const openCategoryModal = () => {
    setTempCategoryOrder(categoryGroups.slice(1));
    setIsCategoryModalOpen(true);
  };

  return (
    <div className="flex h-[calc(100vh -4rem)] bg-gray-100 overflow-hidden relative">
      {isCategoryModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in flex flex-col max-h-[70vh]">
            <div className="p-6 border-b border-gray-100 shrink-0">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">Reorder Categories</h3>
                  <p className="text-sm text-gray-500">Drag and drop to change the order of category groups.</p>
                </div>
                <button onClick={() => setIsCategoryModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto flex-1">
              <div className="space-y-2">
                {tempCategoryOrder.map((group, index) => (
                  <div
                    key={group}
                    draggable
                    onDragStart={(e) => handleDragStart(e, index)}
                    onDragOver={(e) => handleDragOver(e, index)}
                    onDrop={handleDrop}
                    className="flex items-center p-3 bg-gray-50 rounded-lg border border-gray-200 cursor-grab active:cursor-grabbing select-none"
                  >
                    <span className="text-gray-400 mr-3 text-xl leading-none pointer-events-none" aria-hidden="true">⠿</span>
                    <span className="font-medium text-gray-800 pointer-events-none">{group}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 shrink-0">
              <button 
                onClick={handleSaveCategoryOrder}
                className="w-full bg-[#FF5722] text-white font-bold py-3 rounded-xl hover:bg-[#E64A19] transition"
              >
                Save Order
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Success Modal */}
      {showBillModal && lastOrderDetails && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm modal-overlay animate-fade-in p-4">
              <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
                  <div className="bg-orange-600 p-4 flex justify-between items-center text-white flex-shrink-0">
                      <h3 className="font-bold text-lg flex items-center"><CheckCircle className="mr-2 h-5 w-5" /> Order Placed</h3>
                      <button onClick={startNewOrder} className="hover:bg-orange-700 p-1 rounded"><X className="h-5 w-5" /></button>
                  </div>
                  <div className="p-6 overflow-y-auto">
                      <div className="text-center mb-6">
                          <p className="text-gray-500 text-sm">Order #{lastOrderDetails.formattedId || lastOrderDetails.id.slice(0, 6)}</p>
                          <p className="text-gray-500 text-sm">Total Amount</p>
                          <h2 className="text-4xl font-extrabold text-gray-900 mt-1">{currency}{lastOrderDetails.total.toFixed(2)}</h2>
                          <div className="mt-2 inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                             {lastOrderDetails.paymentMethod} • Admin
                          </div>
                      </div>
                      {lastOrderDetails.paymentMethod === 'Online' && lastOrderDetails.upiUrl && (
                          <div className="flex flex-col items-center justify-center mb-6 bg-white p-4 rounded-xl border-2 border-dashed border-gray-300">
                              <QRCodeSVG value={lastOrderDetails.upiUrl} size={180} />
                              <p className="text-xs text-gray-500 mt-3 flex items-center">
                                  <QrCode className="h-3 w-3 mr-1" /> Scan to Pay via UPI
                              </p>
                              <button 
                                  onClick={handleCopyUpi}
                                  className="mt-3 text-xs flex items-center justify-center px-3 py-1.5 border border-gray-200 rounded-full font-medium text-gray-600 hover:bg-gray-50"
                              >
                                 <Copy className="h-3 w-3 mr-1.5" /> Copy UPI ID
                              </button>
                          </div>
                      )}
                      <div className="space-y-3">
                          {lastOrderDetails.paymentStatus === 'Pending' && (
                            <button onClick={handleMarkAsPaidPOS} className="w-full flex items-center justify-center px-4 py-3 bg-orange-500 text-white rounded-xl font-bold hover:bg-orange-600">
                                <CheckCircle className="h-4 w-4 mr-2" /> Mark as Paid
                            </button>
                          )}
                          <div className="grid grid-cols-2 gap-3">
                            <button onClick={() => printReceipt(lastOrderDetails)} className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50">
                                <Printer className="h-4 w-4 mr-2" /> Direct Print
                            </button>
                            <button onClick={() => downloadReceipt(lastOrderDetails)} className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50">
                                <Download className="h-4 w-4 mr-2" /> Download PDF
                            </button>
                          </div>
                          <button 
                                onClick={handleWhatsApp} 
                                disabled={!lastOrderDetails.customerPhone} 
                                className="w-full flex items-center justify-center px-4 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                <MessageSquare className="h-4 w-4 mr-2" /> 
                                WhatsApp Bill
                          </button>
                      </div>
                      <button onClick={startNewOrder} className="w-full mt-4 py-3 text-orange-600 font-bold hover:bg-orange-50 rounded-xl">
                          Start New Order
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Variant Selection Modal */}
      {isVariantModalOpen && selectedItemForVariants && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden animate-fade-in">
            <div className="p-6">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="text-lg font-bold text-gray-900">{selectedItemForVariants.name}</h3>
                  <p className="text-sm text-gray-500">Select size/variant</p>
                </div>
                <button onClick={() => setIsVariantModalOpen(false)} className="text-gray-400 hover:text-gray-600">
                  <X className="h-6 w-6" />
                </button>
              </div>
              <div className="space-y-3">
                {selectedItemForVariants.variants?.map((variant, idx) => (
                  <button
                    key={idx}
                    onClick={() => addToCart(selectedItemForVariants, variant)}
                    className="w-full flex justify-between items-center p-4 border border-gray-200 rounded-xl hover:border-orange-500 hover:bg-orange-50 transition group"
                  >
                    <span className="font-bold text-gray-700 group-hover:text-orange-700">{variant.size}</span>
                    <span className="font-bold text-gray-900">{currency}{variant.price}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Main Content (Product Grid) */}
      <div className="flex-1 flex flex-col overflow-hidden bg-gray-50 max-w-[calc(100%-400px)]" id="no-print">
        {/* Header Section */}
        <div className="shrink-0 bg-white p-4 border-b border-gray-200">
          {/* Search and Toggle Row */}
          <div className="flex items-center gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
              <input 
                type="text" 
                placeholder="Search item name or code..." 
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-orange-500 focus:border-transparent bg-white shadow-sm"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-medium text-gray-700">Show Images</span>
              <label className="relative inline-flex items-center cursor-pointer">
                <input 
                  type="checkbox" 
                  checked={showImages} 
                  onChange={() => setShowImages(!showImages)} 
                  className="sr-only peer" 
                />
                <div className="w-11 h-6 bg-gray-200 rounded-full peer peer-focus:ring-2 peer-focus:ring-orange-300 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
              </label>
            </div>
          </div>
          {/* Categories Row */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {categoryGroups.map(cat => (
              <button
                key={cat}
                onClick={() => setActiveCategoryGroup(cat)}
                className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap transition shadow-sm border ${
                  activeCategoryGroup === cat 
                    ? 'bg-[#FF5722] text-white border-[#FF5722]' 
                    : 'bg-white text-gray-600 border-gray-200 hover:bg-gray-50'
                }`}
              >
                {cat}
              </button>
            ))}
            <button onClick={openCategoryModal} className="p-2.5 rounded-lg bg-gray-200 text-gray-600 hover:bg-gray-300 transition shadow-sm border border-gray-200">
              <Edit2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        {/* Menu Grid */}
        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-5 gap-2">
            {filteredItems.map(item => {
              const qty = cart.filter(c => c.id === item.id).reduce((sum, c) => sum + c.quantity, 0);
              return (
                <div 
                  key={item.id} 
                  onClick={() => item.variants && item.variants.length > 1 ? handleSelectVariant(item) : addToCart(item)}
                  className={"bg-white rounded-xl shadow-sm border border-gray-200 cursor-pointer hover:shadow-md hover:border-orange-300 transition flex flex-col h-full active:scale-[0.98] group relative z-10" + (!showImages ? " p-2" : " p-3")}
                >
                  <div className={"bg-gray-50 rounded-lg overflow-hidden mb-3 relative" + (!showImages ? " hidden h-0" : " h-12 w-10")}>
                    <img src={item.image}  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                    {qty > 0 && (
                        <div className="absolute top-2 right-2 bg-[#FF5722] text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center shadow-lg border-2 border-white">
                            {qty}
                        </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-1">
                        <h4 className="font-bold text-gray-900 text-[10px] line-clamp-1">{item.name}</h4>
                    </div>
                    <p className="text-xs text-gray-500 font-medium">{currency}{item.price.toFixed(2)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Sidebar (Right) - FIXED UI */}
      <div className="w-[400px] bg-white border-l border-gray-200 flex flex-col h-full z-30 shadow-2xl relative" id="no-print">
        
        {/* 1. Fixed Header Section */}
        <div className="shrink-0 bg-white p-4 border-b border-gray-100 z-20 space-y-3">
            


            {/* Customer Inputs - GRID LAYOUT */}
            <div className="grid grid-cols-2 gap-2">
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <User className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] outline-none transition-all" 
                        placeholder="Customer Name"
                        value={customerName}
                        onChange={e => setCustomerName(e.target.value)}
                    />
                </div>
                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Phone className="h-4 w-4 text-gray-400" />
                    </div>
                    <input 
                        className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:ring-1 focus:ring-[#FF5722] focus:border-[#FF5722] outline-none transition-all" 
                        placeholder="Phone Number"
                        value={customerPhone}
                        onChange={e => setCustomerPhone(e.target.value)}
                    />
                </div>
            </div>
            
            {/* Service Type Toggles */}
            <div className="flex bg-gray-100 p-1 rounded-lg">
                {['Dine-in', 'Takeaway', 'Delivery'].map(type => (
                        <button
                        key={type}
                        onClick={() => setOrderType(type as OrderType)}
                        className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center ${
                            orderType === type 
                            ? 'bg-white text-[#FF5722] shadow-sm border border-gray-100' 
                            : 'text-gray-500 hover:text-gray-700'
                        }`}
                        >
                            {type === 'Dine-in' && <Utensils className="h-3 w-3 mr-1"/>}
                            {type === 'Takeaway' && <ShoppingBag className="h-3 w-3 mr-1"/>}
                            {type === 'Delivery' && <Bike className="h-3 w-3 mr-1"/>}
                            {type}
                        </button>
                ))}
            </div>

            {/* Payment Toggles */}
            <div className="flex gap-2">
                <button
                    onClick={() => setPaymentMethod('Cash')}
                    className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold uppercase border transition-all ${
                        paymentMethod === 'Cash' 
                        ? 'bg-green-50 border-green-200 text-green-700 ring-1 ring-green-100' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <Wallet className="h-3 w-3 mr-1.5" /> Cash
                </button>
                <button
                    onClick={() => setPaymentMethod('Online')}
                    className={`flex-1 flex items-center justify-center py-2 rounded-lg text-xs font-bold uppercase border transition-all ${
                        paymentMethod === 'Online' 
                        ? 'bg-blue-50 border-blue-200 text-blue-700 ring-1 ring-blue-100' 
                        : 'bg-white border-gray-200 text-gray-500 hover:bg-gray-50'
                    }`}
                >
                    <QrCode className="h-3 w-3 mr-1.5" /> Online
                </button>
            </div>
        </div>

        {/* 2. Scrollable Items (Body) */}
        <div className="flex-1 overflow-y-auto p-4 bg-gray-50/50 no-scrollbar relative z-10">
           {cart.length === 0 ? (
             <div className="h-full flex flex-col items-center justify-center text-gray-400 space-y-3 opacity-60">
                <div className="bg-white p-4 rounded-full shadow-sm border border-gray-100">
                    <Receipt className="h-8 w-8 text-gray-300" />
                </div>
                <p className="text-sm font-medium">Cart is empty</p>
             </div>
           ) : (
             cart.map(item => {
               const itemKey = item.selectedVariant ? `${item.id}-${item.selectedVariant.size}` : item.id;
               return (
                <div key={itemKey} className="flex items-center gap-3 bg-white p-2 rounded-lg border border-gray-100 shadow-sm mb-2 relative z-10">
                 {/* Item Image */}
                 <div className="w-12 h-12 bg-gray-100 rounded-md flex-shrink-0 overflow-hidden border border-gray-100">
                    <img src={item.image} alt="" className="w-full h-full object-cover" />
                 </div>

                 {/* Info */}
                 <div className="flex-1 min-w-0">
                    <p className="text-sm font-bold text-gray-900 truncate leading-tight mb-0.5">
                      {item.name} {item.selectedVariant && <span className="text-[10px] text-orange-600">({item.selectedVariant.size})</span>}
                    </p>
                    <p className="text-xs text-gray-500 font-medium">{currency}{item.price.toFixed(2)}</p>
                 </div>

                 {/* Controls */}
                 <div className="flex items-center gap-3">
                    <div className="flex items-center gap-0.5 bg-gray-50 rounded-md p-0.5 border border-gray-200">
                        <button onClick={(e) => {
                          e.stopPropagation(); 
                          const key = item.selectedVariant ? `${item.id}-${item.selectedVariant.size}` : item.id;
                          updateQuantity(key, -1)
                        }} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm text-gray-600 hover:text-red-500 border border-transparent hover:border-gray-200"><Minus className="h-3 w-3" /></button>
                        <span className="text-xs font-bold text-gray-900 w-5 text-center">{item.quantity}</span>
                        <button onClick={(e) => {
                          e.stopPropagation(); 
                          const key = item.selectedVariant ? `${item.id}-${item.selectedVariant.size}` : item.id;
                          updateQuantity(key, 1)
                        }} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm text-green-600 hover:text-green-700 border border-transparent hover:border-gray-200"><Plus className="h-3 w-3" /></button>
                    </div>
                    
                    <div className="text-right min-w-[3rem]">
                        <span className="text-sm font-bold text-gray-900">{currency}{(item.price * item.quantity).toFixed(0)}</span>
                    </div>

                    <button onClick={(e) => {
                      e.stopPropagation(); 
                      const key = item.selectedVariant ? `${item.id}-${item.selectedVariant.size}` : item.id;
                      removeFromCart(key)
                    }} className="text-gray-300 hover:text-red-500 transition-colors p-1.5 hover:bg-red-50 rounded-md">
                        <Trash2 className="h-3.5 w-3.5" />
                    </button>
                 </div>
               </div>
               );
             })
           )}
        </div>

        {/* 3. Fixed Footer */}
        <div className="shrink-0 p-4 bg-white border-t border-gray-200 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.03)] relative">
             {/* Extra Charges */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                 {orderType === 'Delivery' && (
                    <div className="relative">
                        <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Delivery</label>
                        <div className="flex items-center w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus-within:ring-1 focus-within:ring-[#FF5722]">
                            <span className="text-gray-500 text-sm mr-1">{currency}</span>
                            <input  
                                type="number"
                                className="w-full bg-transparent text-sm font-medium outline-none text-right"
                                value={isNaN(deliveryCharge) ? 0 : deliveryCharge}
                                onChange={(e) => setDeliveryCharge(parseFloat(e.target.value) || 0)}
                            />
                        </div>
                    </div>
                 )}
                 <div className={`relative ${orderType !== 'Delivery' ? 'col-span-2' : ''}`}>
                    <label className="absolute -top-2 left-2 bg-white px-1 text-[10px] font-bold text-gray-500 uppercase tracking-wider">Discount ({currency})</label>
                    <div className="flex items-center w-full border border-gray-300 rounded-lg px-3 py-2 bg-gray-50 focus-within:ring-1 focus-within:ring-[#FF5722]">
                         <Tag className="h-3 w-3 text-gray-400 mr-2" />
                        <input 
                            type="number"
                            className="w-full bg-transparent text-sm font-medium outline-none text-right"
                            placeholder="0"
                            value={isNaN(parseFloat(discount)) ? '0' : discount}
                            onChange={(e) => setDiscount(e.target.value === '' ? '0' : (parseFloat(e.target.value) || 0).toString())}
                        />
                    </div>
                 </div>
            </div>

            {/* Breakdown - SPLIT TAXES */}
            <div className="space-y-1.5 mb-4">
                <div className="flex justify-between text-xs text-gray-500">
                    <span>Subtotal</span>
                    <span>{currency}{subtotal.toFixed(2)}</span>
                </div>
                {discountAmount > 0 && (
                    <div className="flex justify-between text-xs text-green-600 font-medium">
                        <span>Discount</span>
                        <span>-{currency}{discountAmount.toFixed(2)}</span>
                    </div>
                )}
                {activeDeliveryCharge > 0 && (
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Delivery Fee</span>
                        <span>{currency}{activeDeliveryCharge.toFixed(2)}</span>
                    </div>
                )}
                <div className="flex justify-between text-xs text-gray-500">
                    <span>GST ({gstRate}%)</span>
                    <span>{currency}{gstAmount.toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                    <span>Service Charge ({serviceRate}%)</span>
                    <span>{currency}{serviceAmount.toFixed(2)}</span>
                </div>
            </div>

            {/* Total & Button */}
            <div className="pt-4 border-t border-gray-100">
                <div className="flex justify-between items-end mb-4">
                    <span className="text-sm font-bold text-gray-800">Total Payable</span>
                    <span className="text-3xl font-extrabold text-gray-900 tracking-tight">{currency}{total.toFixed(2)}</span>
                </div>
                
                <button 
                    onClick={handlePlaceOrder}
                    disabled={cart.length === 0 || isProcessing || !isFormValid}
                    style={{ backgroundColor: (cart.length === 0 || isProcessing || !isFormValid) ? '#d1d5db' : '#FF5722' }}
                    className="w-full text-white py-4 rounded-xl font-bold text-lg flex items-center justify-center space-x-3 disabled:cursor-not-allowed transition-all shadow-lg active:scale-[0.98]"
                >
                    {isProcessing ? <Loader2 className="animate-spin h-6 w-6" /> : <CreditCard className="h-6 w-6" />}
                    <span>Generate Bill</span>
                </button>
            </div>
        </div>
      </div>
    </div>
  );
}

export default POS;