import React, { useState, useEffect } from 'react';
import { X, ShoppingBag, Plus, Minus, ArrowRight, Loader2, CheckCircle, Bike, Utensils, Download, User, Phone, QrCode, Trash2, Copy, MessageSquare } from 'lucide-react';
import { useCart } from '../context/CartContext';
import { collection, addDoc, doc, getDoc, updateDoc, increment } from 'firebase/firestore';
import { db } from '../firebase/config';
import { toast } from 'react-hot-toast';
import { OrderType, Restaurant, PaymentMethod, LastOrderDetails } from '../types';
import { generateProfessionalReceipt } from './ReceiptPDF';
import { QRCodeSVG } from 'qrcode.react';
import { sendTelegramMessage, formatOrderMessage } from '../services/telegramService';

interface CartDrawerProps {
  setShowQrModal?: (show: boolean) => void;
  setQrCodeValue?: (value: string) => void;
}

const CartDrawer: React.FC<CartDrawerProps> = () => {
  const { items, restaurantId, isOpen, toggleCart, updateQuantity, totalPrice, totalItems, clearCart, removeItem } = useCart();
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [showBillOverview, setShowBillOverview] = useState(false);
  const [showOnlinePayment, setShowOnlinePayment] = useState(false);
  
  // Order Configuration State
  const [orderType, setOrderType] = useState<OrderType>('Dine-in');
  const [defaultDeliveryCharge, setDefaultDeliveryCharge] = useState(0);
  const [restaurantName, setRestaurantName] = useState('Restaurant');
  const [upiId, setUpiId] = useState('');
  
  // Tax Settings State
  const [taxSettings, setTaxSettings] = useState({ gstPercentage: 0, serviceChargePercentage: 0, applyTax: false });

  // Guest Details
  const [guestName, setGuestName] = useState('');
  const [guestPhone, setGuestPhone] = useState('');
  
  // Payment & Order State
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('Online');

  // Success Modal Data
  const [lastOrderData, setLastOrderData] = useState<LastOrderDetails | null>(null);

  // 1. Fetch Restaurant Settings on Open
  useEffect(() => {
    const fetchSettings = async () => {
        if (!restaurantId) return;
        try {
            const docSnap = await getDoc(doc(db, 'restaurants', restaurantId));
            if (docSnap.exists()) {
                const data = docSnap.data() as Restaurant;
                setDefaultDeliveryCharge(data.defaultDeliveryCharge || 0);
                setRestaurantName(data.name || 'Restaurant');
                setUpiId(data.upiId || '');
                
                if (data.taxSettings) {
                    setTaxSettings(data.taxSettings);
                }

            }
        } catch (err) {
            console.error("Error fetching settings:", err);
        }
    };
    if (isOpen) {
        fetchSettings();
    }
  }, [restaurantId, isOpen]);

  // 2. Calculation Logic
  const deliveryFee = orderType === 'Delivery' ? defaultDeliveryCharge : 0;
  
  // Explicitly calculate split taxes
  const applyTax = taxSettings?.applyTax ?? true;
  const gstPercentage = applyTax ? (taxSettings?.gstPercentage || 0) : 0;
  const gstAmount = totalPrice * (gstPercentage / 100);
  const serviceChargePercentage = applyTax ? (taxSettings?.serviceChargePercentage || 0) : 0;
  const serviceAmount = totalPrice * (serviceChargePercentage / 100);
  
  const finalTotal = totalPrice + gstAmount + serviceAmount + deliveryFee;

  // 3. Validation
  const isValidPhone = (phone: string) => /^\d{10}$/.test(phone.trim());
  const isFormValid = guestName.trim() !== '' && isValidPhone(guestPhone);

  const generateReceiptPDF = async () => {
      if (!lastOrderData) return;
      const targetRestaurantId = lastOrderData.restaurantId || restaurantId;
      if (!targetRestaurantId) return;
      try {
          const docSnap = await getDoc(doc(db, 'restaurants', targetRestaurantId));
          if (docSnap.exists()) {
              const restaurantData = docSnap.data() as Restaurant;
              generateProfessionalReceipt(lastOrderData, restaurantData, 'download');
          }
      } catch (err) {
          console.error("Error generating receipt:", err);
      }
  };

  const handleCheckout = async () => {
    if (!restaurantId) return;

    if (!isFormValid) {
        toast.error("Please enter Name and a valid 10-digit Phone Number.");
        return;
    }

    // If Cash and not yet showing overview, show it first
    if (paymentMethod === 'Cash' && !showBillOverview) {
        setShowBillOverview(true);
        return;
    }
    
    setIsCheckingOut(true);
    const toastId = toast.loading("Processing order...");
    
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

      // Get Basic Restaurant Data for Notifications
      const restaurantRef = doc(db, 'restaurants', restaurantId);
      const restaurantSnap = await getDoc(restaurantRef);
      const restaurantData = restaurantSnap.data();

      const now = new Date().toISOString();
      const orderPayload = {
        restaurantId,
        formattedId: formattedId, // Store the custom ID
        items,
        subtotal: totalPrice,
        deliveryCharge: deliveryFee,
        total: finalTotal,
        discount: 0,
        // Detailed Tax Breakdown Payload
        taxDetails: {
            gstRate: taxSettings.gstPercentage,
            gstAmount,
            serviceRate: taxSettings.serviceChargePercentage,
            serviceAmount
        },
        status: 'Pending',
        orderType: orderType,
        source: 'Online',
        orderSource: 'Website',
        paymentMethod: paymentMethod,
        paymentStatus: 'Pending', // BOTH Cash and Online orders set to Pending by default as requested
        createdAt: now,
        customerName: guestName, 
        customerPhone: guestPhone
      };

      const docRef = await addDoc(collection(db, 'restaurants', restaurantId, 'orders'), orderPayload);
      
      // Send Telegram Notification
      if (restaurantData?.notificationSettings?.customerOrderAlert && 
          restaurantData?.notificationSettings?.telegramToken && 
          restaurantData?.notificationSettings?.telegramChatId) {
        const message = formatOrderMessage(orderPayload as Order, restaurantData.name);
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

      let generatedUpiUrl = '';
      const paymentQrLink = restaurantData?.paymentQrLink; // Fetch paymentQrLink
      if (paymentMethod === 'Online' && upiId) {
          const payeeName = restaurantName.replace(/ /g, '%20') || 'Restaurant';
          generatedUpiUrl = `upi://pay?pa=${upiId}&pn=${payeeName}&am=${finalTotal.toFixed(2)}&cu=INR&tn=${docRef.id}`;
      }

      const orderConfirmationData: LastOrderDetails = {
          id: docRef.id,
          formattedId: formattedId,
          restaurantId: restaurantId,
          total: finalTotal,
          subtotal: totalPrice,
          items: [...items],
          date: now,
          orderType: orderType,
          paymentStatus: 'Pending',
          deliveryFee: deliveryFee,
          taxDetails: {
              gstAmount,
              serviceAmount,
              gstRate: taxSettings.gstPercentage,
              serviceRate: taxSettings.serviceChargePercentage
          },
          upiUrl: generatedUpiUrl,
          paymentQrLink: paymentQrLink, // Include paymentQrLink here
          customerName: guestName,
          customerPhone: guestPhone,
          paymentMethod: paymentMethod
      };

      setLastOrderData(orderConfirmationData);

      toast.success("Order Placed Successfully!", { id: toastId });
      clearCart();
      setIsCheckingOut(false);
      setShowBillOverview(false);
      setShowOnlinePayment(false);
      setOrderType('Dine-in'); 
      setGuestName('');
      setGuestPhone('');
      setPaymentMethod('Online'); // Reset payment method
      
    } catch (error) {
      console.error("Checkout failed", error);
      toast.error("Checkout failed: " + (error instanceof Error ? error.message : "Unknown error"), { id: toastId });
      setIsCheckingOut(false);
    }
  };

  const handleCopyUpi = () => {
    if (upiId) {
        navigator.clipboard.writeText(upiId);
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

  const handleWhatsAppBill = async () => {
    if (!lastOrderData) return;
    const targetRestaurantId = lastOrderData.restaurantId || restaurantId;
    if (!targetRestaurantId) return;

    try {
        const docSnap = await getDoc(doc(db, 'restaurants', targetRestaurantId));
        if (docSnap.exists()) {
            const restaurantData = docSnap.data() as Restaurant;
            
            const { 
                total, items, id, formattedId, subtotal, taxDetails, upiUrl, paymentQrLink, customerName, customerPhone, paymentMethod
            } = lastOrderData;

            let message = `Hello ${customerName || 'Guest'}, your order from ${restaurantData.name} has been placed successfully!\n\n`;
            message += `Order ID: ${formattedId || id.slice(0, 6)}\n\n`;
            message += `Items:\n`;
            items.forEach(item => {
                message += `- ${item.quantity}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size})` : ''} (₹${((item.selectedVariant?.price || item.price) * item.quantity).toFixed(2)})\n`;
            });
            message += `\nSubtotal: ₹${subtotal.toFixed(2)}\n`;
            if (taxDetails.gstAmount > 0) {
              message += `GST (${taxDetails.gstRate}%): ₹${taxDetails.gstAmount.toFixed(2)}\n`;
            }
            if (taxDetails.serviceAmount > 0) {
              message += `Service Charge: ₹${taxDetails.serviceAmount.toFixed(2)}\n`;
            }
            message += `Grand Total: ₹${total.toFixed(2)}\n\n`;
            message += `Payment Method: ${paymentMethod}\n`;

            if (paymentMethod === 'Online') {
                if (upiUrl) {
                    message += `\nPay via App: ${upiUrl}\n`;
                }
                if (paymentQrLink) {
                    message += `\nScan Now to Pay: ${paymentQrLink}\n`;
                }
            }

            if (restaurantData.location || restaurantData.contact) {
                message += `\n---\n`;
                if (restaurantData.location) message += `${restaurantData.location}\n`;
                if (restaurantData.contact) message += `Tel: ${restaurantData.contact}\n`;
            }

            const sanitizedPhone = sanitizePhoneNumber(customerPhone || '');
            const whatsappUrl = `https://api.whatsapp.com/send?phone=${sanitizedPhone}&text=${encodeURIComponent(message)}`;
            window.open(whatsappUrl, '_blank');
        }
    } catch (err) {
        console.error("Error generating WhatsApp bill:", err);
    }
  };

  if (lastOrderData && isOpen) {
      return (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
                <div className="w-20 h-20 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                    <CheckCircle className="h-10 w-10 text-green-600" />
                </div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Order Confirmed!</h3>
                <p className="text-gray-500 text-sm mb-6">
                    Your order #{lastOrderData.formattedId || lastOrderData.id.slice(0,6)} has been received. 
                    <br/>Total: <span className="font-bold text-gray-900 font-mono">₹{lastOrderData.total.toFixed(2)}</span>
                </p>
                <div className="space-y-3 mb-3">
                    <button 
                        onClick={generateReceiptPDF}
                        className="w-full flex items-center justify-center px-4 py-3 border border-gray-300 rounded-xl font-bold text-gray-700 hover:bg-gray-50"
                    >
                        <Download className="h-4 w-4 mr-2" /> Download Receipt
                    </button>
                    <button 
                        onClick={handleWhatsAppBill} 
                        disabled={!lastOrderData.customerPhone} 
                        className="w-full flex items-center justify-center px-4 py-3 bg-green-500 text-white rounded-xl font-bold hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <MessageSquare className="h-4 w-4 mr-2" /> 
                        WhatsApp Bill
                    </button>
                </div>
                <button 
                    onClick={() => { setLastOrderData(null); toggleCart(); }} 
                    className="w-full py-3 text-[#FF5722] font-bold hover:bg-orange-50 rounded-xl"
                >
                    Close
                </button>
            </div>
        </div>
      );
  }

  if (!isOpen) return null;

  const upiUrl = `upi://pay?pa=${upiId}&pn=${restaurantName.replace(/ /g, '%20')}&am=${finalTotal.toFixed(2)}&cu=INR`;

  return (
    <div className="fixed inset-0 z-[60] overflow-hidden">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm transition-opacity" onClick={toggleCart} />
      
      {/* Online Payment Modal */}
      {showOnlinePayment && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden text-center p-8">
            <h3 className="text-xl font-bold text-gray-900 mb-2">Scan to Pay</h3>
            <p className="text-gray-500 text-sm mb-6">Pay ₹{finalTotal.toFixed(2)} to {restaurantName}</p>
            
            <div className="bg-white p-4 rounded-xl border-2 border-dashed border-gray-200 inline-block mb-4">
              <a href={upiUrl} className="block">
                <QRCodeSVG value={upiUrl} size={180} />
                <p className="text-[10px] text-orange-600 mt-2 font-bold">Tap to open payment app</p>
              </a>
            </div>

            <div className="mb-6">
                <button 
                    onClick={handleCopyUpi}
                    className="text-xs flex items-center justify-center mx-auto px-3 py-1.5 border border-gray-200 rounded-full font-medium text-gray-600 hover:bg-gray-50"
                >
                    <Copy className="h-3 w-3 mr-1.5" /> Copy UPI ID: {upiId}
                </button>
            </div>

            <div className="space-y-3">
              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="w-full bg-[#FF5722] text-white py-3 rounded-xl font-bold hover:brightness-95 transition flex items-center justify-center shadow-lg"
              >
                {isCheckingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : "I have Paid, Confirm Order"}
              </button>
              <button 
                onClick={() => setShowOnlinePayment(false)}
                className="w-full py-2 text-gray-500 text-sm font-medium hover:text-gray-700"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill Overview Modal (Cash) */}
      {showBillOverview && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm overflow-hidden p-6">
            <h3 className="text-xl font-bold text-gray-900 mb-4 border-b pb-2">Bill Overview</h3>
            
            <div className="space-y-3 mb-6 max-h-[40vh] overflow-y-auto no-scrollbar">
              {items.map((item, idx) => (
                <div key={idx} className="flex justify-between text-sm">
                  <span className="text-gray-600">{item.quantity}x {item.name}</span>
                  <span className="font-bold text-gray-900">₹{((item.selectedVariant?.price || item.price) * item.quantity).toFixed(0)}</span>
                </div>
              ))}
            </div>

            <div className="space-y-2 pt-4 border-t border-dashed border-gray-200 mb-6">
              <div className="flex justify-between text-sm text-gray-500">
                <span>Subtotal</span>
                <span>₹{totalPrice.toFixed(2)}</span>
              </div>
              {deliveryFee > 0 && (
                <div className="flex justify-between text-sm text-gray-900 font-bold">
                  <span>Delivery Fee</span>
                  <span>₹{deliveryFee.toFixed(2)}</span>
                </div>
              )}
              {gstAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>GST ({taxSettings.gstPercentage}%)</span>
                  <span>₹{gstAmount.toFixed(2)}</span>
                </div>
              )}
              {serviceAmount > 0 && (
                <div className="flex justify-between text-sm text-gray-500">
                  <span>Service Charge ({taxSettings.serviceChargePercentage}%)</span>
                  <span>₹{serviceAmount.toFixed(2)}</span>
                </div>
              )}
              <div className="flex justify-between text-lg font-extrabold text-gray-900 pt-2 border-t border-gray-100">
                <span>Total Payable</span>
                <span>₹{finalTotal.toFixed(2)}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button 
                onClick={() => setShowBillOverview(false)}
                className="flex-1 py-3 border border-gray-300 rounded-xl text-sm font-medium hover:bg-gray-50"
              >
                Back
              </button>
              <button 
                onClick={handleCheckout}
                disabled={isCheckingOut}
                className="flex-1 py-3 bg-[#FF5722] text-white rounded-xl font-bold hover:brightness-95 transition flex items-center justify-center"
              >
                {isCheckingOut ? <Loader2 className="h-5 w-5 animate-spin" /> : "Confirm Order"}
              </button>
            </div>
          </div>
        </div>
      )}
      <div className="absolute inset-y-0 right-0 max-w-md w-full flex">
        <div className="w-full h-full bg-white shadow-2xl flex flex-col transform transition-transform duration-300">
          
          {/* 1. Header (Fixed) */}
          <div className="shrink-0 px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-20">
            <div className="flex items-center space-x-3">
              <ShoppingBag className="h-5 w-5 text-gray-600" />
              <h2 className="text-lg font-bold text-gray-900">Your Cart</h2>
              <span className="bg-orange-100 text-orange-700 text-xs font-bold px-2 py-0.5 rounded-full">
                {totalItems} items
              </span>
            </div>
            <button onClick={toggleCart} className="text-gray-400 hover:text-gray-600 p-1">
              <X className="h-6 w-6" />
            </button>
          </div>

          {/* 2. Content Area (Scrollable) */}
          <div className="flex-1 overflow-y-auto no-scrollbar bg-gray-50/30 relative flex flex-col">
            <div className="p-6 space-y-4 flex-1">
              {items.length === 0 ? (
                <div className="min-h-[60vh] flex flex-col items-center justify-center text-center space-y-4 opacity-60">
                  <div className="bg-gray-50 p-6 rounded-full">
                    <ShoppingBag className="h-12 w-12 text-gray-300" />
                  </div>
                  <div>
                    <h3 className="text-lg font-medium text-gray-900">Your cart is empty</h3>
                    <p className="text-gray-500 text-sm mt-1">Looks like you haven&apos;t added anything yet.</p>
                  </div>
                  <button onClick={toggleCart} className="text-[#FF5722] font-bold hover:underline">
                    Start Browsing
                  </button>
                </div>
              ) : (
                items.map((item) => (
                  <div key={`${item.id}-${item.selectedVariant?.size || ''}`} className="flex items-center gap-3 bg-white p-3 rounded-xl shadow-sm border border-gray-100">
                    {/* Item Image */}
                    <div className="w-12 h-12 bg-gray-100 rounded-lg flex-shrink-0 overflow-hidden border border-gray-100">
                       <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 line-clamp-1">{item.name} {item.selectedVariant && <span className="text-[10px] text-orange-600">({item.selectedVariant.size})</span>}</p>
                      <p className="text-xs text-gray-500 font-medium">₹{(item.selectedVariant?.price || item.price).toFixed(2)}</p>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center gap-3">
                       <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-0.5 border border-gray-200">
                          <button onClick={() => updateQuantity(item.cartItemId, -1)} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm text-gray-600 hover:text-red-500"><Minus className="h-3 w-3" /></button>
                          <span className="text-xs font-bold text-gray-900 w-5 text-center">{item.quantity}</span>
                          <button onClick={() => updateQuantity(item.cartItemId, 1)} className="w-6 h-6 flex items-center justify-center rounded bg-white shadow-sm text-green-600 hover:text-green-700"><Plus className="h-3 w-3" /></button>
                       </div>
                       <div className="flex flex-col items-end min-w-[4rem]">
                          <span className="text-sm font-bold text-gray-900">₹{((item.selectedVariant?.price || item.price) * item.quantity).toFixed(0)}</span>
                          <button 
                            onClick={() => removeItem(item.cartItemId)} 
                            className="text-gray-400 hover:text-red-500 transition-colors mt-1 p-1 hover:bg-red-50 rounded"
                            title="Remove item"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                       </div>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 3. Footer (Sticky) */}
            {items.length > 0 && (
              <div className="shrink-0 p-4 bg-white border-t border-gray-200 z-20 shadow-[0_-4px_15px_rgba(0,0,0,0.03)] relative">
                <div className="space-y-4 mb-4">
                   <div className="grid grid-cols-2 gap-2">
                        <div className="relative">
                            <User className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input 
                                type="text"
                                placeholder="Customer Name"
                                value={guestName}
                                onChange={(e) => setGuestName(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#FF5722] outline-none"
                            />
                        </div>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                            <input 
                                type="tel"
                                placeholder="Phone Number"
                                value={guestPhone}
                                onChange={(e) => setGuestPhone(e.target.value)}
                                className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-1 focus:ring-[#FF5722] outline-none"
                            />
                        </div>
                   </div>

                    <div className="flex bg-gray-100 p-1 rounded-lg mb-4">
                        {['Dine-in', 'Takeaway', 'Delivery'].map(type => (
                            <button 
                                key={type}
                                onClick={() => setOrderType(type as OrderType)}
                                className={`flex-1 py-1.5 text-[10px] font-bold uppercase rounded-md transition-all flex items-center justify-center ${
                                    orderType === type 
                                    ? 'bg-white text-[#FF5722] shadow-sm' 
                                    : 'text-gray-500 hover:text-gray-700'
                                }`}
                            >
                                {type === 'Dine-in' && <Utensils className="h-3 w-3 mr-1"/>}
                                {type !== 'Dine-in' && <Bike className="h-3 w-3 mr-1"/>}
                                {type}
                            </button>
                        ))}
                    </div>

                    {/* Payment Method Selection - Website orders are Online Only */}
                    <div className="bg-blue-50 border border-blue-100 p-3 rounded-lg flex items-center justify-between">
                        <div className="flex items-center">
                            <QrCode className="h-4 w-4 text-blue-600 mr-2" />
                            <span className="text-xs font-bold text-blue-800">Online Payment Only</span>
                        </div>
                        <span className="text-[10px] bg-blue-200 text-blue-800 px-2 py-0.5 rounded-full font-bold">SECURE</span>
                    </div>
                </div>

                <div className="space-y-1.5 pt-4 border-t border-dashed border-gray-200 mb-4">
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Subtotal</span>
                        <span className="font-mono text-right w-20">₹{totalPrice.toFixed(2)}</span>
                    </div>
                    {deliveryFee > 0 && (
                        <div className="flex justify-between text-xs text-gray-900 font-bold">
                            <span>Delivery Fee</span>
                            <span className="font-mono text-right w-20">₹{deliveryFee.toFixed(2)}</span>
                        </div>
                    )}
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>GST ({gstPercentage}%)</span>
                        <span className="font-mono text-right w-20">₹{gstAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Service Charge ({serviceChargePercentage}%)</span>
                        <span className="font-mono text-right w-20">₹{serviceAmount.toFixed(2)}</span>
                    </div>
                </div>

                <div className="flex justify-between items-end mb-4 pt-2 border-t border-gray-100">
                    <span className="text-sm font-bold text-gray-800">Total Payable</span>
                    <span className="text-2xl font-extrabold text-gray-900 tracking-tight font-mono text-right">₹{finalTotal.toFixed(2)}</span>
                </div>

                <button 
                    onClick={() => {
                        if (paymentMethod === 'Online') {
                            if (!isFormValid) {
                                toast.error("Please enter Name and a valid 10-digit Phone Number.");
                                return;
                            }
                            setShowOnlinePayment(true);
                        } else {
                            handleCheckout();
                        }
                    }}
                    disabled={isCheckingOut || !isFormValid}
                    style={{ backgroundColor: (isCheckingOut || !isFormValid) ? '#d1d5db' : '#FF5722' }} 
                    className="w-full text-white py-4 rounded-xl font-bold hover:brightness-95 transition flex items-center justify-between px-6 shadow-lg disabled:cursor-not-allowed mb-0"
                >
                    {isCheckingOut ? (
                    <div className="flex items-center justify-center w-full">
                        <Loader2 className="h-5 w-5 animate-spin mr-2" /> Processing...
                    </div>
                    ) : (
                    <>
                        <span>Confirm Order</span>
                        <span className="flex items-center text-orange-100 text-sm">
                        ₹{finalTotal.toFixed(2)} <ArrowRight className="ml-2 h-4 w-4" />
                        </span>
                    </>
                    )}
                </button>
            </div>
          )}
        </div>
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;