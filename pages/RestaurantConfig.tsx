import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Restaurant, ThemeSettings, TaxSettings, NotificationSettings } from '../types';
import { Save, Loader2, Clock, Palette, QrCode, Smartphone, Bike, Printer, Bell, Send, ArrowLeft, Share2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sendTelegramMessage } from '../services/telegramService';

const RestaurantConfig: React.FC = () => {
  const { restaurantId, configId } = useParams<{ restaurantId: string; configId?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'operational' | 'design' | 'notifications'>('operational');
  
  // Use configId if present (from Admin List), otherwise use current dashboard context
  const targetId = configId || restaurantId;

  const [formData, setFormData] = useState({
    openingHours: '',
    deliveryTime: '',
    defaultDeliveryCharge: 0,
    whatsappNumber: '',
    upiId: '',
    paymentQrLink: '',
    orderIdPrefix: '',
    nextOrderNumber: 1,
    receiptFooter: '',
    selectedPrinterSize: '80mm Thermal',
    printerSizes: ["80mm Thermal", "58mm Thermal", "A4", "A5", "2-inch", "3-inch", "4-inch", "Legal", "Letter", "Continuous"],
    notificationSettings: {
      telegramEnabled: false,
      telegramToken: '',
      telegramChatId: '',
      customerOrderAlert: false,
      adminOrderAlert: false,
      orderStatusUpdate: false,
      paymentStatusUpdate: false,
    },
    // Menu Page Design
    theme: {
      primaryColor: '#ea580c', // Default Orange-600
      primaryTextColor: '#111827',
      footerColor: '#111827',
      footerText: '© 2024 CraveWave Technologies Inc.',
    } as ThemeSettings,
    // Tax Settings
    taxSettings: {
        gstPercentage: 5,
        serviceChargePercentage: 0,
        applyTax: true
    } as TaxSettings,
    socialLinks: {
        instagram: '',
        facebook: '',
        twitter: '',
        linkedin: ''
    } as SocialLinks,
    currency: '₹', // Default Currency
  });

  useEffect(() => {
    const fetchSettings = async () => {
      if (!targetId) return;
      
      // Fetch from new config path
      const configRef = doc(db, 'restaurants', targetId, 'config', 'main');
      const configSnap = await getDoc(configRef);
      
      // Also fetch basic restaurant info for defaults if config doesn't exist yet
      const restaurantRef = doc(db, 'restaurants', targetId);
      const restaurantSnap = await getDoc(restaurantRef);
      const restaurantData = restaurantSnap.exists() ? restaurantSnap.data() as Restaurant : {} as Partial<Restaurant>;

      if (configSnap.exists()) {
        const data = configSnap.data();
        setFormData({
            openingHours: data.openingHours || restaurantData.openingHours || '09:00 AM - 10:00 PM',
            deliveryTime: data.deliveryTime || restaurantData.deliveryTime || '30-45 mins',
            defaultDeliveryCharge: data.defaultDeliveryCharge || restaurantData.defaultDeliveryCharge || 0,
            whatsappNumber: data.whatsappNumber || restaurantData.whatsappNumber || '',
            upiId: data.upiId || restaurantData.upiId || '',
            paymentQrLink: data.paymentQrLink || restaurantData.paymentQrLink || '',
            orderIdPrefix: data.orderIdPrefix || restaurantData.orderIdPrefix || '',
            nextOrderNumber: data.nextOrderNumber || restaurantData.nextOrderNumber || 1,
            receiptFooter: data.receiptFooter || restaurantData.receiptFooter || 'Thank you for dining with us!',
            selectedPrinterSize: data.selectedPrinterSize || restaurantData.selectedPrinterSize || '80mm Thermal',
            printerSizes: data.printerSizes || ["80mm Thermal", "58mm Thermal", "A4", "A5", "2-inch", "3-inch", "4-inch", "Legal", "Letter", "Continuous"],
            theme: {
              primaryColor: data.theme?.primaryColor || restaurantData.theme?.primaryColor || '#ea580c',
              primaryTextColor: data.theme?.primaryTextColor || restaurantData.theme?.primaryTextColor || '#111827',
              footerColor: data.theme?.footerColor || restaurantData.theme?.footerColor || '#111827',
              footerText: data.theme?.footerText || restaurantData.theme?.footerText || '© 2024 CraveWave Technologies Inc.',
            },
            taxSettings: {
                gstPercentage: data.taxSettings?.gstPercentage ?? restaurantData.taxSettings?.gstPercentage ?? 5,
                serviceChargePercentage: data.taxSettings?.serviceChargePercentage ?? restaurantData.taxSettings?.serviceChargePercentage ?? 0,
                applyTax: data.taxSettings?.applyTax ?? restaurantData.taxSettings?.applyTax ?? true
            },
            socialLinks: {
                instagram: data.socialLinks?.instagram || '',
                facebook: data.socialLinks?.facebook || '',
                twitter: data.socialLinks?.twitter || '',
                linkedin: data.socialLinks?.linkedin || ''
            },
            currency: data.currency || '₹',
            notificationSettings: {
              telegramEnabled: data.notificationSettings?.telegramEnabled || restaurantData.notificationSettings?.telegramEnabled || false,
              telegramToken: data.notificationSettings?.telegramToken || restaurantData.notificationSettings?.telegramToken || '',
              telegramChatId: data.notificationSettings?.telegramChatId || restaurantData.notificationSettings?.telegramChatId || '',
              customerOrderAlert: data.notificationSettings?.customerOrderAlert || restaurantData.notificationSettings?.customerOrderAlert || false,
              adminOrderAlert: data.notificationSettings?.adminOrderAlert || restaurantData.notificationSettings?.adminOrderAlert || false,
              orderStatusUpdate: data.notificationSettings?.orderStatusUpdate || restaurantData.notificationSettings?.orderStatusUpdate || false,
              paymentStatusUpdate: data.notificationSettings?.paymentStatusUpdate || restaurantData.notificationSettings?.paymentStatusUpdate || false,
             
            }
        });
      } else {
        // Fallback to existing restaurant data if config doesn't exist
         setFormData({
            openingHours: restaurantData.openingHours || '09:00 AM - 10:00 PM',
            deliveryTime: restaurantData.deliveryTime || '30-45 mins',
            defaultDeliveryCharge: restaurantData.defaultDeliveryCharge || 0,
            whatsappNumber: restaurantData.whatsappNumber || '',
            upiId: restaurantData.upiId || '',
            paymentQrLink: restaurantData.paymentQrLink || '',
            orderIdPrefix: restaurantData.orderIdPrefix || '',
            nextOrderNumber: restaurantData.nextOrderNumber || 1,
            receiptFooter: restaurantData.receiptFooter || 'Thank you for dining with us!',
            selectedPrinterSize: restaurantData.selectedPrinterSize || '80mm Thermal',
            printerSizes: restaurantData.printerSizes || ["80mm Thermal", "58mm Thermal", "A4", "A5", "2-inch", "3-inch", "4-inch", "Legal", "Letter", "Continuous"],
            theme: {
              primaryColor: restaurantData.theme?.primaryColor || '#ea580c',
              primaryTextColor: restaurantData.theme?.primaryTextColor || '#111827',
              footerColor: restaurantData.theme?.footerColor || '#111827',
              footerText: restaurantData.theme?.footerText || '© 2024 CraveWave Technologies Inc.',
            },
            taxSettings: {
                gstPercentage: restaurantData.taxSettings?.gstPercentage ?? 5,
                serviceChargePercentage: restaurantData.taxSettings?.serviceChargePercentage ?? 0,
                applyTax: restaurantData.taxSettings?.applyTax ?? true
            },
            socialLinks: {
                instagram: '',
                facebook: '',
                twitter: '',
                linkedin: ''
            },
            currency: '₹',
            notificationSettings: {
              telegramEnabled: restaurantData.notificationSettings?.telegramEnabled || false,
              telegramToken: restaurantData.notificationSettings?.telegramToken || '',
              telegramChatId: restaurantData.notificationSettings?.telegramChatId || '',
              customerOrderAlert: restaurantData.notificationSettings?.customerOrderAlert || false,
              adminOrderAlert: restaurantData.notificationSettings?.adminOrderAlert || false,
              orderStatusUpdate: restaurantData.notificationSettings?.orderStatusUpdate || false,
              paymentStatusUpdate: restaurantData.notificationSettings?.paymentStatusUpdate || false,
             
            }
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, [targetId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetId) return;
    setSaving(true);
    const toastId = toast.loading("Saving settings...");

    try {
      const configRef = doc(db, 'restaurants', targetId, 'config', 'main');
      
      // Ensure sequential writes if needed, but here we just save to one doc
      await setDoc(configRef, {
        ...formData,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      toast.success("Settings updated successfully!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update settings: " + (error as Error).message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const handleTestNotification = async () => {
    if (!formData.notificationSettings.telegramToken || !formData.notificationSettings.telegramChatId) {
      toast.error("Please configure Telegram Bot Token and Chat ID first.");
      return;
    }

    const toastId = toast.loading("Sending test Telegram message...");
    
    try {
      const message = "🔔 *Test Notification*\n\nYour Telegram integration is working correctly! You will receive order alerts here.";
      await sendTelegramMessage(
        formData.notificationSettings.telegramToken,
        formData.notificationSettings.telegramChatId,
        message
      );
      toast.success("Test message sent successfully!", { id: toastId });
    } catch (err) {
      const error = err as Error;
      console.error("Test notification error:", error);
      toast.error("Test failed: " + error.message, { id: toastId });
    }
  };

  const handleTelegramToggle = async (field: keyof NotificationSettings, enabled: boolean) => {
    if (!targetId) return;
    
    const newNotificationSettings = { ...formData.notificationSettings, [field]: enabled };
    setFormData({ ...formData, notificationSettings: newNotificationSettings });
    
    // Auto-save for toggles
    try {
       const configRef = doc(db, 'restaurants', targetId, 'config', 'main');
       await setDoc(configRef, { notificationSettings: { [field]: enabled } }, { merge: true });
       toast.success("Notification setting updated");
    } catch (error) {
      console.error("Error updating Telegram settings:", error);
      toast.error("Failed to update setting");
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>;

  const TabButton = ({ id, label, icon: Icon }: { id: 'operational' | 'design' | 'notifications', label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-6 py-3 border-b-2 font-medium text-sm transition-colors ${
        activeTab === id 
          ? 'border-orange-600 text-orange-600 bg-orange-50' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4 w-4 mr-2" />
      {label}
    </button>
  );

  return (
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6 flex items-center gap-4">
        <button 
            onClick={() => {
                if (configId) {
                    navigate(`/dashboard/${restaurantId}/restaurants`);
                } else {
                    navigate(`/dashboard/${restaurantId}`);
                }
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition"
        >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
            <h2 className="text-2xl font-bold text-gray-900">Restaurant Configuration</h2>
            <p className="text-gray-500 text-sm">Manage operations, design, and notifications.</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto">
            <TabButton id="operational" label="Operations & Billing" icon={QrCode} />
            <TabButton id="design" label="Menu Page Design" icon={Palette} />
            <TabButton id="notifications" label="Notifications" icon={Bell} />
        </div>

        <form onSubmit={handleSave} className="p-6">
            
            {/* Operational Tab */}
            {activeTab === 'operational' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-orange-50 p-4 rounded-lg border border-orange-100">
                        <h4 className="font-bold text-orange-800 flex items-center mb-2">
                            <QrCode className="h-4 w-4 mr-2" /> Payment Settings
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">UPI ID (VPA)</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.upiId}
                                    onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                                    placeholder="username@okicici"
                                />
                                <p className="text-xs text-gray-500 mt-1">Required for QR Code generation on Bill.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Payment QR Link (Optional)</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.paymentQrLink}
                                    onChange={(e) => setFormData({...formData, paymentQrLink: e.target.value})}
                                    placeholder="https://link-to-qr-image.com"
                                />
                                <p className="text-xs text-gray-500 mt-1">Link to a custom payment QR image.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">WhatsApp Order Number</label>
                                <div className="relative">
                                    <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        value={formData.whatsappNumber}
                                        onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})}
                                        placeholder="+91 9876543210"
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Currency Symbol</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.currency}
                                    onChange={(e) => setFormData({...formData, currency: e.target.value})}
                                    placeholder="₹"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="bg-blue-50 p-4 rounded-lg border border-blue-100">
                        <h4 className="font-bold text-blue-800 flex items-center mb-2">
                            <Clock className="h-4 w-4 mr-2" /> Order ID Configuration
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Order ID Prefix</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={formData.orderIdPrefix}
                                    onChange={(e) => setFormData({...formData, orderIdPrefix: e.target.value})}
                                    placeholder="e.g. SS"
                                />
                                <p className="text-xs text-gray-500 mt-1">Prefix for order IDs (e.g., SS00001).</p>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Starting Order Number</label>
                                <input 
                                    type="number" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-blue-500 focus:border-blue-500"
                                    value={isNaN(formData.nextOrderNumber) ? 0 : formData.nextOrderNumber}
                                    onChange={(e) => setFormData({...formData, nextOrderNumber: parseFloat(e.target.value) || 0})}
                                    placeholder="1"
                                />
                                <p className="text-xs text-gray-500 mt-1">The number for the next order.</p>
                            </div>
                        </div>
                    </div>

                    <div className="bg-gray-50 p-4 rounded-lg border border-gray-100">
                        <h4 className="font-bold text-gray-800 flex items-center mb-2">
                            <Printer className="h-4 w-4 mr-2" /> Printer Settings
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Select Receipt Paper Size</label>
                                <select 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-gray-500 focus:border-gray-500 bg-white"
                                    value={formData.selectedPrinterSize}
                                    onChange={(e) => setFormData({...formData, selectedPrinterSize: e.target.value})}
                                >
                                    {formData.printerSizes.map(size => (
                                        <option key={size} value={size}>{size}</option>
                                    ))}
                                </select>
                                <p className="text-xs text-gray-500 mt-1">Used for generating PDF receipts.</p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Opening Hours</label>
                            <div className="relative">
                                <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.openingHours}
                                    onChange={(e) => setFormData({...formData, openingHours: e.target.value})}
                                />
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Avg. Delivery Time</label>
                            <input 
                                type="text" 
                                className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                value={formData.deliveryTime}
                                onChange={(e) => setFormData({...formData, deliveryTime: e.target.value})}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Default Delivery Charge (₹)</label>
                            <div className="relative">
                                <Bike className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                <input 
                                    type="number" 
                                    className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={isNaN(formData.defaultDeliveryCharge) ? 0 : formData.defaultDeliveryCharge}
                                    onChange={(e) => setFormData({...formData, defaultDeliveryCharge: parseFloat(e.target.value) || 0})}
                                    placeholder="0"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-gray-900 mb-4">Tax Configuration</h4>
                        <div className="flex items-center gap-4 mb-4">
                            <label className="flex items-center cursor-pointer">
                                <input 
                                    type="checkbox"
                                    className="sr-only peer"
                                    checked={formData.taxSettings.applyTax}
                                    onChange={(e) => setFormData({...formData, taxSettings: {...formData.taxSettings, applyTax: e.target.checked}})}
                                />
                                <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                <span className="ms-3 text-sm font-medium text-gray-700">Apply Tax on Bills</span>
                            </label>
                        </div>
                        <div className={`grid grid-cols-2 gap-6 ${!formData.taxSettings.applyTax ? 'opacity-50 pointer-events-none' : ''}`}>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">GST %</label>
                                <input 
                                    type="number" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm"
                                    value={isNaN(formData.taxSettings.gstPercentage) ? 0 : formData.taxSettings.gstPercentage}
                                    onChange={(e) => setFormData({...formData, taxSettings: {...formData.taxSettings, gstPercentage: parseFloat(e.target.value) || 0}})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Service Charge %</label>
                                <input 
                                    type="number" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm"
                                    value={isNaN(formData.taxSettings.serviceChargePercentage) ? 0 : formData.taxSettings.serviceChargePercentage}
                                    onChange={(e) => setFormData({...formData, taxSettings: {...formData.taxSettings, serviceChargePercentage: parseFloat(e.target.value) || 0}})}
                                />
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Design Tab */}
            {activeTab === 'design' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="border-t border-gray-100 pt-6">
                        <h4 className="font-bold text-gray-900 mb-4 flex items-center">
                            <Palette className="h-4 w-4 mr-2 text-gray-500" /> Menu Page Colors & Footer
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Brand Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                        value={formData.theme.primaryColor}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})}
                                    />
                                    <input 
                                        type="text" 
                                        className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase"
                                        value={formData.theme.primaryColor}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Primary Text Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                        value={formData.theme.primaryTextColor}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryTextColor: e.target.value}})}
                                    />
                                    <input 
                                        type="text" 
                                        className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase"
                                        value={formData.theme.primaryTextColor}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryTextColor: e.target.value}})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Footer Background Color</label>
                                <div className="flex gap-2 items-center">
                                    <input 
                                        type="color" 
                                        className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                        value={formData.theme.footerColor}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerColor: e.target.value}})}
                                    />
                                    <input 
                                        type="text" 
                                        className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase"
                                        value={formData.theme.footerColor}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerColor: e.target.value}})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Footer Text</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.theme.footerText}
                                    onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerText: e.target.value}})}
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Receipt Footer Note</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                    value={formData.receiptFooter}
                                    onChange={(e) => setFormData({...formData, receiptFooter: e.target.value})}
                                />
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-100">
                            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                <Share2 className="h-4 w-4 mr-2 text-orange-500" />
                                Social Media Links
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        placeholder="https://instagram.com/..."
                                        value={formData.socialLinks.instagram}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        placeholder="https://facebook.com/..."
                                        value={formData.socialLinks.facebook}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Twitter/X</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        placeholder="https://twitter.com/..."
                                        value={formData.socialLinks.twitter}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, twitter: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                                        placeholder="https://linkedin.com/..."
                                        value={formData.socialLinks.linkedin}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, linkedin: e.target.value}})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-blue-50 p-6 rounded-xl border border-blue-100">
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center">
                                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                                    <Send className="h-5 w-5 text-blue-600" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900">Telegram Bot Configuration</h4>
                                    <p className="text-xs text-blue-700">Configure your bot to receive instant order alerts.</p>
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={handleTestNotification}
                                className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition text-xs flex items-center shadow-sm"
                            >
                                <Send className="h-3 w-3 mr-2" /> Send Test Message
                            </button>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                            <div>
                                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">Bot Token</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-blue-200 border px-3 py-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    value={formData.notificationSettings.telegramToken}
                                    onChange={(e) => setFormData({...formData, notificationSettings: { ...formData.notificationSettings, telegramToken: e.target.value }})}
                                    placeholder="123456789:ABCdef..."
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">Chat ID</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-blue-200 border px-3 py-2.5 text-sm focus:ring-blue-500 focus:border-blue-500 bg-white"
                                    value={formData.notificationSettings.telegramChatId}
                                    onChange={(e) => setFormData({...formData, notificationSettings: { ...formData.notificationSettings, telegramChatId: e.target.value }})}
                                    placeholder="-1001234567890"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="font-bold text-gray-900 text-sm">Customer Order Alert</h5>
                                    <p className="text-[10px] text-gray-500">Notify when a customer places an order online.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.notificationSettings.customerOrderAlert}
                                        onChange={(e) => handleTelegramToggle('customerOrderAlert', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="font-bold text-gray-900 text-sm">Admin Order Alert</h5>
                                    <p className="text-[10px] text-gray-500">Notify when an order is created from the POS.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.notificationSettings.adminOrderAlert}
                                        onChange={(e) => handleTelegramToggle('adminOrderAlert', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                            </div>
                        </div>

                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="font-bold text-gray-900 text-sm">Order Status Update</h5>
                                    <p className="text-[10px] text-gray-500">Notify when order status changes (Preparing, Ready, etc).</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.notificationSettings.orderStatusUpdate}
                                        onChange={(e) => handleTelegramToggle('orderStatusUpdate', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-8 flex justify-end">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-lg shadow-orange-200 disabled:opacity-70"
                >
                    {saving ? (
                        <>
                            <Loader2 className="animate-spin -ml-1 mr-2 h-5 w-5" /> Saving...
                        </>
                    ) : (
                        <>
                            <Save className="mr-2 h-5 w-5" /> Save Configuration
                        </>
                    )}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default RestaurantConfig;
