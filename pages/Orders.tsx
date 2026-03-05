import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { collection, onSnapshot, updateDoc, doc, query, deleteDoc, getDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Order, OrderStatus, Restaurant } from '../types';
import { Trash2, AlertTriangle, Globe, Monitor, Printer, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { generateProfessionalReceipt } from '../components/ReceiptPDF';
import { sendTelegramMessage } from '../services/telegramService';

const Orders: React.FC = () => {
  const { restaurantId } = useParams<{ restaurantId: string }>();
  const [orders, setOrders] = useState<Order[]>([]);
  const [filterStatus, setFilterStatus] = useState<OrderStatus | 'All'>('All');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [restaurantData, setRestaurantData] = useState<Restaurant | null>(null);

  const printReceipt = async (order: Order) => {
    if (!restaurantData) return;
    generateProfessionalReceipt(order, restaurantData, 'print');
  };

  const downloadReceipt = async (order: Order) => {
    if (!restaurantData) return;
    generateProfessionalReceipt(order, restaurantData, 'download');
  };
  const [searchTerm, setSearchTerm] = useState('');
  
  // Modal State
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [orderToDelete, setOrderToDelete] = useState<string | null>(null);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [orderToCancel, setOrderToCancel] = useState<string | null>(null);

  useEffect(() => {
    if (restaurantId) {
        getDoc(doc(db, 'restaurants', restaurantId)).then(snap => {
            if (snap.exists()) setRestaurantData(snap.data() as Restaurant);
        });
    }
  }, [restaurantId]);

  useEffect(() => {
    if (!restaurantId) return;

    const ordersRef = collection(db, 'restaurants', restaurantId, 'orders');
    const q = query(ordersRef); 
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedOrders = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Order[];
      
      fetchedOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setOrders(fetchedOrders);
    });

    return () => unsubscribe();
  }, [restaurantId]);

   const updateStatus = async (orderId: string, newStatus: OrderStatus) => {
    if (!restaurantId) return;
    try {
      const orderRef = doc(db, 'restaurants', restaurantId, 'orders', orderId);
      await updateDoc(orderRef, { status: newStatus });

      // Send Telegram Notification
      if (restaurantData?.notificationSettings?.orderStatusUpdate && 
          restaurantData?.notificationSettings?.telegramToken && 
          restaurantData?.notificationSettings?.telegramChatId) {
        const order = orders.find(o => o.id === orderId);
        if (order) {
          const message = `📦 *Order Status Update*\n\n` +
                          `Order: #${order.formattedId || order.id.slice(0, 6)}\n` +
                          `Customer: ${order.customerName}\n` +
                          `New Status: *${newStatus.toUpperCase()}*`;
          sendTelegramMessage(
            restaurantData.notificationSettings.telegramToken,
            restaurantData.notificationSettings.telegramChatId,
            message
          ).catch(err => console.error("Telegram notification failed:", err));
        }
      }
    } catch {
      // console.error("Failed to update status", err);
    }
  };



  const confirmDelete = (orderId: string) => {
      setOrderToDelete(orderId);
      setShowDeleteModal(true);
  };

  const confirmCancel = (orderId: string) => {
      setOrderToCancel(orderId);
      setShowCancelModal(true);
  };

   const executeCancel = async () => {
      if (!restaurantId || !orderToCancel) return;
      const toastId = toast.loading("Cancelling order...");
      try {
          const orderRef = doc(db, 'restaurants', restaurantId, 'orders', orderToCancel);
          await updateDoc(orderRef, { status: 'Cancelled' });

          // Send Telegram Notification
          if (restaurantData?.notificationSettings?.orderStatusUpdate && 
              restaurantData?.notificationSettings?.telegramToken && 
              restaurantData?.notificationSettings?.telegramChatId) {
            const order = orders.find(o => o.id === orderToCancel);
            if (order) {
              const message = `❌ *Order Cancelled*\n\n` +
                              `Order: #${order.formattedId || order.id.slice(0, 6)}\n` +
                              `Customer: ${order.customerName}\n` +
                              `Status: *CANCELLED*`;
              sendTelegramMessage(
                restaurantData.notificationSettings.telegramToken,
                restaurantData.notificationSettings.telegramChatId,
                message
              ).catch(err => console.error("Telegram notification failed:", err));
            }
          }

          toast.success("Order cancelled", { id: toastId });
          setShowCancelModal(false);
          setOrderToCancel(null);
      } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          toast.error("Failed to cancel order: " + message, { id: toastId });
      }
  };

  const executeDelete = async () => {
      if (!restaurantId || !orderToDelete) return;
      const toastId = toast.loading("Deleting order...");
      try {
          await deleteDoc(doc(db, 'restaurants', restaurantId, 'orders', orderToDelete));
          toast.success("Order deleted successfully", { id: toastId });
          setShowDeleteModal(false);
          setOrderToDelete(null);
      } catch (err) {
          const message = err instanceof Error ? err.message : "Unknown error";
          toast.error("Failed to delete order: " + message, { id: toastId });
      }
  };

  const filteredOrders = orders.filter(o => {
    const matchesStatus = filterStatus === 'All' || o.status === filterStatus;
    const matchesSearch = (
      o.customerName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      o.customerPhone?.includes(searchTerm)
    );
    
    const orderDate = new Date(o.createdAt);
    let matchesStart = true;
    if (startDate) {
        const start = new Date(startDate);
        start.setHours(0,0,0,0);
        matchesStart = orderDate >= start;
    }
    let matchesEnd = true;
    if (endDate) {
        const end = new Date(endDate);
        end.setHours(23,59,59,999);
        matchesEnd = orderDate <= end;
    }

    return matchesStatus && matchesStart && matchesEnd && matchesSearch;
  });

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'Pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Preparing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Ready': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Completed': return 'bg-green-100 text-green-800 border-green-200';
      case 'Cancelled': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-gray-100 text-gray-800';
    }
  };





   const handleMarkAsPaid = async (order: Order) => {
    if (!restaurantId) return;
    try {
      const orderRef = doc(db, 'restaurants', restaurantId, 'orders', order.id);
      await updateDoc(orderRef, { paymentStatus: 'Paid' });
      
      // Send Telegram Notification
      if (restaurantData?.notificationSettings?.paymentStatusUpdate && 
          restaurantData?.notificationSettings?.telegramToken && 
          restaurantData?.notificationSettings?.telegramChatId) {
        const message = `💳 *Payment Received*\n\n` +
                        `Order: #${order.formattedId || order.id.slice(0, 6)}\n` +
                        `Customer: ${order.customerName}\n` +
                        `Amount: ₹${order.total.toFixed(2)}\n` +
                        `Status: *PAID*`;
        sendTelegramMessage(
          restaurantData.notificationSettings.telegramToken,
          restaurantData.notificationSettings.telegramChatId,
          message
        ).catch(err => console.error("Telegram notification failed:", err));
      }

      // WhatsApp Logic
      if (order.customerPhone && order.customerPhone !== 'N/A') {
          const subtotal = order.items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
          const gstAmount = order.taxDetails?.gstAmount || 0;
          const serviceAmount = order.taxDetails?.serviceAmount || 0;
          const grandTotal = order.total;

          let message = `Hi ${order.customerName || 'Guest'}, thank you for your order!\n\n`;
          message += `Order ID: ${order.formattedId || order.id.slice(0, 6)}\n\n`;
          message += `Items:\n`;
          order.items.forEach(item => {
              message += `- ${item.quantity}x ${item.name}${item.selectedVariant ? ` (${item.selectedVariant.size})` : ''} (₹${((item.selectedVariant?.price || item.price) * item.quantity).toFixed(2)})\n`;
          });
          message += `\nSubtotal: ₹${subtotal.toFixed(2)}\n`;
          if (gstAmount > 0) {
            message += `GST (5%): ₹${gstAmount.toFixed(2)}\n`;
          }
          if (serviceAmount > 0) {
            message += `Service Charge: ₹${serviceAmount.toFixed(2)}\n`;
          }
          message += `Grand Total: ₹${grandTotal.toFixed(2)}\n\n`;
          message += `Your payment of ₹${grandTotal.toFixed(2)} has been received. We hope you enjoy your meal!`;
          const whatsappUrl = `https://wa.me/${order.customerPhone.replace(/\D/g,'')}?text=${encodeURIComponent(message)}`;
          window.open(whatsappUrl, '_blank');
      }
      
      toast.success("Payment marked as Paid");
    } catch {
      toast.error("Failed to update payment status");
    }
  };

  const getPaymentStatusText = (order: Order) => {
    if (order.paymentStatus === 'Paid') return 'PAID';
    return 'PENDING';
  };

  return (
    <>
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-red-100 mb-4">
                      <AlertTriangle className="h-6 w-6 text-red-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Delete Order?</h3>
                  <p className="text-sm text-gray-500 mb-6">
                      Are you sure you want to delete this order? This action cannot be undone.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                      <button
                          onClick={() => setShowDeleteModal(false)}
                          className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                      >
                          Cancel
                      </button>
                      <button
                          onClick={executeDelete}
                          className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-red-600 text-base font-medium text-white hover:bg-red-700 focus:outline-none sm:text-sm"
                      >
                          Delete
                      </button>
                  </div>
              </div>
          </div>
      )}

      {/* Cancel Confirmation Modal */}
      {showCancelModal && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 backdrop-blur-sm animate-fade-in p-4">
              <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full p-6 text-center">
                  <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-orange-100 mb-4">
                      <AlertTriangle className="h-6 w-6 text-orange-600" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-900 mb-2">Cancel Order?</h3>
                  <p className="text-sm text-gray-500 mb-6">
                      Are you sure you want to cancel this order? This will mark the order as Cancelled.
                  </p>
                  <div className="grid grid-cols-2 gap-3">
                      <button
                          onClick={() => setShowCancelModal(false)}
                          className="w-full inline-flex justify-center rounded-lg border border-gray-300 shadow-sm px-4 py-2 bg-white text-base font-medium text-gray-700 hover:bg-gray-50 focus:outline-none sm:text-sm"
                      >
                          No, Keep it
                      </button>
                      <button
                          onClick={executeCancel}
                          className="w-full inline-flex justify-center rounded-lg border border-transparent shadow-sm px-4 py-2 bg-orange-600 text-base font-medium text-white hover:bg-orange-700 focus:outline-none sm:text-sm"
                      >
                          Yes, Cancel
                      </button>
                  </div>
              </div>
          </div>
      )}

      <div className="space-y-6 relative">
        <div className="flex flex-col xl:flex-row justify-between items-start xl:items-center gap-4">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Live Orders</h2>
            <p className="text-sm text-gray-500">Manage orders for <span className="font-bold text-orange-600">{restaurantData?.name || 'Restaurant'}</span>.</p>
              <div className="mt-4 w-full xl:w-auto">
                <input 
                  type="text" 
                  placeholder="Search by customer name or phone..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full xl:w-80 p-2 border border-gray-300 rounded-lg focus:ring-orange-500 focus:border-orange-500 text-sm"
                />
              </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-4 w-full xl:w-auto">
              {/* Date Filters */}
              <div className="flex items-center space-x-2 bg-white p-1 rounded-lg border border-gray-200 shadow-sm">
                  <input 
                      type="date" 
                      value={startDate}
                      onChange={(e) => setStartDate(e.target.value)}
                      className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent p-1 outline-none"
                  />
                  <span className="text-gray-300">-</span>
                  <input 
                      type="date" 
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="text-sm border-none focus:ring-0 text-gray-600 bg-transparent p-1 outline-none"
                  />
                  {(startDate || endDate) && (
                      <button onClick={() => {setStartDate(''); setEndDate('');}} className="text-xs text-red-500 hover:text-red-700 px-2">Clear</button>
                  )}
              </div>

              {/* Status Tabs */}
              <div className="flex p-1 bg-gray-100 rounded-lg overflow-x-auto no-scrollbar">
              {['All', 'Pending', 'Preparing', 'Ready', 'Completed', 'Cancelled'].map((status) => (
                  <button
                  key={status}
                  onClick={() => setFilterStatus(status as OrderStatus | 'All')}
                  className={`px-4 py-1.5 rounded-md text-sm font-medium transition whitespace-nowrap ${
                      filterStatus === status 
                      ? 'bg-white text-gray-900 shadow-sm' 
                      : 'text-gray-500 hover:text-gray-700'
                  }`}
                  >
                  {status}
                  </button>
              ))}
              </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredOrders.length === 0 ? (
            <div className="md:col-span-2 lg:col-span-3 bg-white rounded-xl shadow-sm border border-gray-100 p-6 text-center text-gray-500">
              No orders found.
            </div>
          ) : (
            filteredOrders.map(order => (
              <div key={order.id} className="bg-white rounded-xl shadow-md border border-gray-100 p-6 flex flex-col justify-between hover:shadow-lg transition-all duration-200">
                {/* Top Row: Customer Info & Source */}
                <div className="flex justify-between items-start mb-4">
                  <div className="flex flex-col">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="text-lg font-bold text-gray-900">{order.customerName || 'Guest'}</h3>
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide flex items-center border ${order.orderSource === 'Website' || order.source === 'Online' ? 'bg-indigo-50 text-indigo-700 border-indigo-100' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {order.orderSource === 'Website' || order.source === 'Online' ? <><Globe className="h-3 w-3 mr-1" /> Web</> : <><Monitor className="h-3 w-3 mr-1" /> Admin</>}
                      </span>
                    </div>
                    {order.customerPhone && order.customerPhone !== 'N/A' && (
                      <p className="text-sm font-bold text-gray-500">{order.customerPhone}</p>
                    )}
                    <p className="text-xs text-gray-400 mt-1">{new Date(order.createdAt).toLocaleString()}</p>
                  </div>
                  <button onClick={() => confirmDelete(order.id)} className="p-2 text-gray-400 hover:text-red-500 transition rounded-full hover:bg-red-50" title="Delete Order">
                    <Trash2 className="h-5 w-5" />
                  </button>
                </div>

                {/* Middle: Order ID & Items */}
                <div className="flex-1 mb-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-orange-600">Order #{order.formattedId || order.id.slice(0, 6)}</span>
                    <span className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide border ${getStatusColor(order.status)}`}>
                      {order.status}
                    </span>
                  </div>
                  <ul className="space-y-1 text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">
                    {order.items.map((item, idx) => (
                      <li key={idx} className="flex justify-between">
                        <span>{item.quantity}x {item.name}</span>
                        {item.selectedVariant && <span className="text-[10px] text-orange-500">({item.selectedVariant.size})</span>}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Bottom: Total, Payment, Actions */}
                <div className="border-t border-gray-100 pt-4 mt-auto">
                  <div className="flex justify-between items-center mb-4">
                    <div className="flex flex-col">
                      <span className="text-[10px] font-bold text-gray-400 uppercase">Payment</span>
                      <span className={`text-xs font-bold ${order.paymentStatus === 'Paid' ? 'text-green-600' : 'text-red-600'}`}>
                        {order.paymentMethod || 'N/A'} • {getPaymentStatusText(order)}
                      </span>
                    </div>
                    <span className="text-2xl font-extrabold text-gray-900">₹{order.total.toFixed(2)}</span>
                  </div>

                  <div className="space-y-2">
                    {order.paymentStatus !== 'Paid' && order.status !== 'Cancelled' && (
                      <button onClick={() => handleMarkAsPaid(order)} className="w-full py-2.5 text-sm font-bold rounded-xl bg-orange-500 text-white hover:bg-orange-600 transition shadow-sm">
                        Mark as Paid
                      </button>
                    )}
                    <button onClick={() => printReceipt(order)} className="w-full py-2.5 text-sm font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center justify-center gap-2">
                      <Printer className="h-5 w-5" /> Print Bill
                    </button>
                    <button onClick={() => downloadReceipt(order)} className="w-full py-2.5 text-sm font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition flex items-center justify-center gap-2">
                      <Download className="h-5 w-5" /> Download Bill
                    </button>
                    {order.status === 'Pending' && (
                      <button onClick={() => updateStatus(order.id, 'Preparing')} className="w-full py-2.5 text-sm font-bold rounded-xl bg-blue-500 text-white hover:bg-blue-600 transition shadow-sm">
                        Mark Preparing
                      </button>
                    )}
                    {order.status === 'Preparing' && (
                      <button onClick={() => updateStatus(order.id, 'Ready')} className="w-full py-2.5 text-sm font-bold rounded-xl bg-purple-500 text-white hover:bg-purple-600 transition shadow-sm">
                        Mark Ready
                      </button>
                    )}
                    {order.status === 'Ready' && (
                      <button onClick={() => updateStatus(order.id, 'Completed')} className="w-full py-2.5 text-sm font-bold rounded-xl bg-green-500 text-white hover:bg-green-600 transition shadow-sm">
                        Mark Completed
                      </button>
                    )}
                    {order.status !== 'Completed' && order.status !== 'Cancelled' && (
                      <button onClick={() => confirmCancel(order.id)} className="w-full py-2.5 text-sm font-bold rounded-xl bg-gray-100 text-gray-600 hover:bg-gray-200 transition">
                        Cancel Order
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        </div>
      </>
  );
};

export default Orders;