import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { Restaurant, ThemeSettings, TaxSettings, NotificationSettings, SocialLinks } from '../types';
import { Save, Loader2, Clock, Palette, QrCode, Smartphone, Bike, Printer, Bell, Send, ArrowLeft, Share2, ShieldCheck, ShieldAlert, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { sendTelegramMessage } from '../services/telegramService';
import { QRCodeSVG } from 'qrcode.react';

const RestaurantConfig: React.FC = () => {
  const { restaurantId, configId } = useParams<{ restaurantId: string; configId?: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'operational' | 'design' | 'notifications'>('operational');
  
  // Use configId if present (from Admin List), otherwise use current dashboard context
  const targetId = configId || restaurantId;

  // Restaurant details for QR and slug
  const [restaurantName, setRestaurantName] = useState('');
  const [restaurantSlug, setRestaurantSlug] = useState('');

  // Telegram verification state
  const [telegramChecking, setTelegramChecking] = useState(false);
  const [telegramBotName, setTelegramBotName] = useState<string | null>(null);

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
    theme: {
      primaryColor: '#ea580c', // Default Orange-600
      primaryTextColor: '#111827',
      footerColor: '#111827',
      footerText: '© 2024 CraveWave Technologies Inc.',
    } as ThemeSettings,
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

      setRestaurantName(restaurantData.name || '');
      setRestaurantSlug(restaurantData.slug || '');

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

  const handleVerifyTelegramToken = async () => {
    const token = formData.notificationSettings.telegramToken;
    if (!token) {
      toast.error("Please enter a Telegram bot token.");
      return;
    }
    setTelegramChecking(true);
    setTelegramBotName(null);
    try {
      const res = await fetch(`https://api.telegram.org/bot${token}/getMe`);
      const data = await res.json();
      if (data.ok) {
        setTelegramBotName(data.result.first_name || data.result.username);
        toast.success(`Verified: @${data.result.username}`);
      } else {
        toast.error("Invalid Telegram bot token: " + data.description);
      }
    } catch (err: any) {
      toast.error("Failed to call Telegram API: " + err.message);
    } finally {
      setTelegramChecking(false);
    }
  };

  const handleTelegramToggle = async (field: keyof NotificationSettings, enabled: boolean) => {
    if (!targetId) return;
    
    const newNotificationSettings = { ...formData.notificationSettings, [field]: enabled };
    setFormData({ ...formData, notificationSettings: newNotificationSettings });
    
    try {
       const configRef = doc(db, 'restaurants', targetId, 'config', 'main');
       await setDoc(configRef, { notificationSettings: { [field]: enabled } }, { merge: true });
       toast.success("Notification setting updated");
    } catch (error) {
      console.error("Error updating Telegram settings:", error);
      toast.error("Failed to update setting");
    }
  };

  // QR Code generator URL
  const publicMenuUrl = `${window.location.origin}${window.location.pathname}#/restaurant/${restaurantSlug}`;

  const downloadQrCode = () => {
    const svg = document.getElementById("public-menu-qr-element") as any;
    if (!svg) return;
    const svgString = new XMLSerializer().serializeToString(svg);
    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);
    const downloadLink = document.createElement("a");
    downloadLink.href = svgUrl;
    downloadLink.download = `${restaurantSlug}_menu_qr.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    toast.success("QR Code saved as SVG");
  };

  // Tax calculations example
  const sampleBillSubtotal = 100;
  const sampleGst = formData.taxSettings.applyTax ? (sampleBillSubtotal * (formData.taxSettings.gstPercentage / 100)) : 0;
  const sampleService = formData.taxSettings.applyTax ? (sampleBillSubtotal * (formData.taxSettings.serviceChargePercentage / 100)) : 0;
  const sampleTotal = sampleBillSubtotal + sampleGst + sampleService;

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>;

  const TabButton = ({ id, label, icon: Icon }: { id: 'operational' | 'design' | 'notifications', label: string, icon: React.ElementType }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`flex items-center px-6 py-3 border-b-2 font-semibold text-sm transition-all cursor-pointer ${
        activeTab === id 
          ? 'border-orange-600 text-orange-600 bg-orange-50/50' 
          : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-50'
      }`}
    >
      <Icon className="h-4.5 w-4.5 mr-2" />
      {label}
    </button>
  );

  return (
    <div className="max-w-6xl mx-auto pb-10">
      <div className="mb-6 flex items-center gap-4">
        <button 
            onClick={() => {
                if (configId) {
                    navigate(`/dashboard/${restaurantId}/restaurants`);
                } else {
                    navigate(`/dashboard/${restaurantId}`);
                }
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition cursor-pointer"
        >
            <ArrowLeft className="h-5 w-5 text-gray-600" />
        </button>
        <div>
            <h2 className="text-2xl font-bold text-gray-900">Restaurant Settings ({restaurantName})</h2>
            <p className="text-gray-500 text-sm font-medium">Manage operations, design themes, and Telegram notification alerts.</p>
        </div>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-150 overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 overflow-x-auto bg-gray-50/50">
            <TabButton id="operational" label="Operations & Billing" icon={QrCode} />
            <TabButton id="design" label="Menu Page Design" icon={Palette} />
            <TabButton id="notifications" label="Notifications" icon={Bell} />
        </div>

        <form onSubmit={handleSave} className="p-6">
            
            {/* Operational Tab */}
            {activeTab === 'operational' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    {/* Inputs Form */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-orange-50/30 p-5 rounded-2xl border border-orange-100 space-y-4">
                            <h4 className="font-bold text-orange-800 flex items-center text-sm border-b border-orange-100/50 pb-2">
                                <QrCode className="h-4.5 w-4.5 mr-2" /> Payment Settings
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">UPI ID (VPA)</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.upiId}
                                        onChange={(e) => setFormData({...formData, upiId: e.target.value})}
                                        placeholder="username@okicici"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Required for dynamic UPI QR Code on invoices.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Payment QR Link (Optional)</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.paymentQrLink}
                                        onChange={(e) => setFormData({...formData, paymentQrLink: e.target.value})}
                                        placeholder="https://link-to-qr-image.com"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Direct URL to a static merchant QR code image.</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">WhatsApp Order Number</label>
                                    <div className="relative">
                                        <Smartphone className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                        <input 
                                            type="text" 
                                            className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                            value={formData.whatsappNumber}
                                            onChange={(e) => setFormData({...formData, whatsappNumber: e.target.value})}
                                            placeholder="+91 9876543210"
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Currency Symbol</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.currency}
                                        onChange={(e) => setFormData({...formData, currency: e.target.value})}
                                        placeholder="₹"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="bg-blue-50/20 p-5 rounded-2xl border border-blue-100/50 space-y-4">
                            <h4 className="font-bold text-blue-800 flex items-center text-sm border-b border-blue-100/20 pb-2">
                                <Clock className="h-4.5 w-4.5 mr-2" /> Order ID Configuration
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Order ID Prefix</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={formData.orderIdPrefix}
                                        onChange={(e) => setFormData({...formData, orderIdPrefix: e.target.value})}
                                        placeholder="e.g. SS"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Code prefix for bills (e.g. SS001).</p>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Starting Order Number</label>
                                    <input 
                                        type="number" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                        value={isNaN(formData.nextOrderNumber) ? 0 : formData.nextOrderNumber}
                                        onChange={(e) => setFormData({...formData, nextOrderNumber: parseFloat(e.target.value) || 0})}
                                        placeholder="1"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-1">Current incremental starting index number.</p>
                                </div>
                            </div>
                        </div>

                        <div className="bg-gray-50/50 p-5 rounded-2xl border border-gray-250/50 space-y-4">
                            <h4 className="font-bold text-gray-800 flex items-center text-sm border-b border-gray-200 pb-2">
                                <Printer className="h-4.5 w-4.5 mr-2" /> Printer Settings & Receipt
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Select Receipt Paper Size</label>
                                    <select 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-gray-500 outline-none bg-white cursor-pointer"
                                        value={formData.selectedPrinterSize}
                                        onChange={(e) => setFormData({...formData, selectedPrinterSize: e.target.value})}
                                    >
                                        {formData.printerSizes.map(size => (
                                            <option key={size} value={size}>{size}</option>
                                        ))}
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Receipt Footer Note</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-gray-500 outline-none"
                                        value={formData.receiptFooter}
                                        onChange={(e) => setFormData({...formData, receiptFooter: e.target.value})}
                                        placeholder="Thank you for dining with us!"
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Opening Hours</label>
                                <div className="relative">
                                    <Clock className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.openingHours}
                                        onChange={(e) => setFormData({...formData, openingHours: e.target.value})}
                                    />
                                </div>
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Avg. Delivery Time</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                    value={formData.deliveryTime}
                                    onChange={(e) => setFormData({...formData, deliveryTime: e.target.value})}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Default Delivery Charge</label>
                                <div className="relative">
                                    <Bike className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                                    <input 
                                        type="number" 
                                        className="w-full rounded-lg border-gray-300 border pl-9 pr-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={isNaN(formData.defaultDeliveryCharge) ? 0 : formData.defaultDeliveryCharge}
                                        onChange={(e) => setFormData({...formData, defaultDeliveryCharge: parseFloat(e.target.value) || 0})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="border-t border-gray-150 pt-5 space-y-4">
                            <h4 className="font-bold text-gray-800 text-sm">Tax Configurations</h4>
                            <div className="flex items-center gap-4 mb-2">
                                <label className="flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.taxSettings.applyTax}
                                        onChange={(e) => setFormData({...formData, taxSettings: {...formData.taxSettings, applyTax: e.target.checked}})}
                                    />
                                    <div className="relative w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                    <span className="ms-3 text-sm font-bold text-gray-700">Apply GST & Service Tax on Invoices</span>
                                </label>
                            </div>
                            <div className={`grid grid-cols-2 gap-4 transition-opacity duration-200 ${!formData.taxSettings.applyTax ? 'opacity-40 pointer-events-none' : ''}`}>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">GST Percentage (%)</label>
                                    <input 
                                        type="number" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={isNaN(formData.taxSettings.gstPercentage) ? 0 : formData.taxSettings.gstPercentage}
                                        onChange={(e) => setFormData({...formData, taxSettings: {...formData.taxSettings, gstPercentage: parseFloat(e.target.value) || 0}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Service Charge Percentage (%)</label>
                                    <input 
                                        type="number" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={isNaN(formData.taxSettings.serviceChargePercentage) ? 0 : formData.taxSettings.serviceChargePercentage}
                                        onChange={(e) => setFormData({...formData, taxSettings: {...formData.taxSettings, serviceChargePercentage: parseFloat(e.target.value) || 0}})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Receipt Simulator & Tax Widget Sidebar */}
                    <div className="space-y-6">
                        {/* 1. Thermal Receipt Simulator */}
                        <div className="bg-gray-100 rounded-2xl p-5 border border-gray-250 shadow-inner space-y-4 font-mono text-gray-700 text-xs">
                          <div className="text-center font-bold border-b border-dashed border-gray-300 pb-2">
                             <span className="text-sm tracking-wider uppercase block">{restaurantName || 'RESTAURANT'}</span>
                             <span className="font-normal text-[10px] text-gray-400 block mt-0.5">OPERATIONS LAYOUT SIMULATOR</span>
                          </div>
                          
                          <div className="space-y-1">
                             <div className="flex justify-between">
                               <span>BILL NO: {formData.orderIdPrefix || 'ORD-'}{formData.nextOrderNumber}</span>
                               <span>{new Date().toLocaleDateString()}</span>
                             </div>
                             <div>TIME: {formData.openingHours}</div>
                          </div>

                          <div className="border-b border-dashed border-gray-300 pb-2 pt-2">
                             <div className="flex justify-between font-bold">
                               <span>ITEM</span>
                               <span>QTY / PRICE</span>
                             </div>
                             <div className="flex justify-between mt-1">
                               <span>1. Sample Burger</span>
                               <span>1 x {formData.currency}100.00</span>
                             </div>
                          </div>

                          <div className="space-y-1 pt-2 border-b border-dashed border-gray-300 pb-2 text-[11px]">
                             <div className="flex justify-between">
                               <span>Subtotal</span>
                               <span>{formData.currency}100.00</span>
                             </div>
                             {formData.taxSettings.applyTax && (
                               <>
                                 <div className="flex justify-between text-gray-500">
                                   <span>GST ({formData.taxSettings.gstPercentage}%)</span>
                                   <span>{formData.currency}{sampleGst.toFixed(2)}</span>
                                 </div>
                                 <div className="flex justify-between text-gray-500">
                                   <span>Service Charge ({formData.taxSettings.serviceChargePercentage}%)</span>
                                   <span>{formData.currency}{sampleService.toFixed(2)}</span>
                                 </div>
                               </>
                             )}
                             <div className="flex justify-between font-extrabold text-sm text-gray-900 pt-1">
                               <span>TOTAL</span>
                               <span>{formData.currency}{sampleTotal.toFixed(2)}</span>
                             </div>
                          </div>

                          {formData.upiId && (
                             <div className="flex flex-col items-center justify-center py-2 border-b border-dashed border-gray-300 text-center">
                               <div className="bg-white p-1.5 rounded border border-gray-200">
                                 <QRCodeSVG value={`upi://pay?pa=${formData.upiId}&pn=${encodeURIComponent(restaurantName)}&am=${sampleTotal.toFixed(2)}`} size={60} />
                               </div>
                               <span className="text-[9px] text-gray-400 mt-1.5">DYNAMIC PAYMENT QR CODE</span>
                             </div>
                          )}

                          <div className="text-center text-[10px] text-gray-400 pt-2 border-t border-gray-200">
                             {formData.receiptFooter || 'Thank you for dining with us!'}
                          </div>
                          
                          <div className="text-center text-[9px] text-orange-600 bg-orange-50 py-1.5 rounded border border-orange-100 font-sans mt-3">
                             Simulated Size: **{formData.selectedPrinterSize}**
                          </div>
                        </div>

                        {/* 2. Tax Calculator Snippet */}
                        <div className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm space-y-3 font-sans">
                          <h5 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Tax Aggregation Snippet</h5>
                          <div className="text-xs space-y-2 text-gray-600">
                             <p>Sample item base price: <span className="font-bold">₹100.00</span></p>
                             <div className="flex justify-between border-b border-gray-50 pb-1.5">
                                <span>GST ({formData.taxSettings.gstPercentage}%):</span>
                                <span className="font-semibold text-gray-800">₹{sampleGst.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between border-b border-gray-50 pb-1.5">
                                <span>Service Charge ({formData.taxSettings.serviceChargePercentage}%):</span>
                                <span className="font-semibold text-gray-800">₹{sampleService.toFixed(2)}</span>
                             </div>
                             <div className="flex justify-between font-bold text-gray-900 pt-1 text-sm">
                                <span>Net Invoice Total:</span>
                                <span>₹{sampleTotal.toFixed(2)}</span>
                             </div>
                          </div>
                        </div>

                        {/* 3. Public Menu QR Code Downloader Card */}
                        {restaurantSlug && (
                          <div className="bg-white border border-gray-250/50 rounded-2xl p-5 shadow-sm space-y-4 text-center font-sans">
                            <h4 className="text-xs font-bold text-gray-400 uppercase tracking-wider">Public Menu QR Code</h4>
                            <div className="flex justify-center bg-gray-50 p-4 rounded-xl border border-gray-150 w-fit mx-auto">
                              <QRCodeSVG id="public-menu-qr-element" value={publicMenuUrl} size={150} />
                            </div>
                            <p className="text-[10px] text-gray-500 font-medium">Customers can scan this QR code to view your digital menu page instantly.</p>
                            <button
                              type="button"
                              onClick={downloadQrCode}
                              className="w-full flex items-center justify-center px-4 py-2 border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 rounded-xl font-bold text-xs shadow-sm cursor-pointer"
                            >
                              <Download className="h-4 w-4 mr-2 text-gray-500" /> Save QR Code (SVG)
                            </button>
                          </div>
                        )}
                    </div>
                </div>
            )}

            {/* Design Tab */}
            {activeTab === 'design' && (
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fade-in">
                    {/* Inputs */}
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-xl space-y-6">
                            <h4 className="font-bold text-gray-900 flex items-center text-sm border-b pb-2">
                                <Palette className="h-4.5 w-4.5 mr-2 text-orange-500" /> Menu Theme Settings
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Primary Theme Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" 
                                            className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                            value={formData.theme.primaryColor}
                                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})}
                                        />
                                        <input 
                                            type="text" 
                                            className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-orange-500"
                                            value={formData.theme.primaryColor}
                                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Primary Text Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" 
                                            className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                            value={formData.theme.primaryTextColor}
                                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryTextColor: e.target.value}})}
                                        />
                                        <input 
                                            type="text" 
                                            className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-orange-500"
                                            value={formData.theme.primaryTextColor}
                                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryTextColor: e.target.value}})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Footer Background Color</label>
                                    <div className="flex gap-2 items-center">
                                        <input 
                                            type="color" 
                                            className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                            value={formData.theme.footerColor}
                                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerColor: e.target.value}})}
                                        />
                                        <input 
                                            type="text" 
                                            className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase outline-none focus:ring-2 focus:ring-orange-500"
                                            value={formData.theme.footerColor}
                                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerColor: e.target.value}})}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Footer Text Note</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        value={formData.theme.footerText}
                                        onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerText: e.target.value}})}
                                    />
                                </div>
                            </div>
                        </div>

                        <div className="mt-8 pt-8 border-t border-gray-150">
                            <h4 className="text-sm font-bold text-gray-900 mb-4 flex items-center">
                                <Share2 className="h-4.5 w-4.5 mr-2 text-orange-500" /> Social Links
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Instagram URL</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="https://instagram.com/..."
                                        value={formData.socialLinks.instagram || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Facebook URL</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="https://facebook.com/..."
                                        value={formData.socialLinks.facebook || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">Twitter/X URL</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="https://twitter.com/..."
                                        value={formData.socialLinks.twitter || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, twitter: e.target.value}})}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 uppercase tracking-wider mb-1">LinkedIn URL</label>
                                    <input 
                                        type="text" 
                                        className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-2 focus:ring-orange-500 outline-none"
                                        placeholder="https://linkedin.com/..."
                                        value={formData.socialLinks.linkedin || ''}
                                        onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, linkedin: e.target.value}})}
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Menu Mobile Mockup Preview */}
                    <div className="flex flex-col items-center">
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-3">Live Mobile Page Mockup</span>
                        
                        {/* Device Frame */}
                        <div className="w-[280px] h-[520px] rounded-[36px] border-[8px] border-gray-800 bg-white shadow-2xl relative overflow-hidden flex flex-col font-sans">
                            {/* Device Top Speaker Notch */}
                            <div className="absolute top-0 left-1/2 transform -translate-x-1/2 w-28 h-4 bg-gray-800 rounded-b-xl z-20" />
                            
                            {/* Brand Header */}
                            <div 
                              className="h-12 flex items-center px-4 pt-3 justify-center text-xs font-extrabold select-none shadow-sm transition-colors duration-205"
                              style={{ backgroundColor: '#ffffff', color: formData.theme.primaryColor }}
                            >
                              <span>{restaurantName || 'RESTAURANT MENU'}</span>
                            </div>

                            {/* Banner Image */}
                            <div className="h-24 bg-gray-100 flex items-center justify-center text-gray-400 select-none border-b">
                              <span className="text-[10px]">BANNER BACKGROUND</span>
                            </div>

                            {/* Content Body Mockup */}
                            <div className="flex-1 p-4 space-y-3 overflow-y-auto bg-gray-50 no-scrollbar select-none">
                               <div className="h-3 w-16 bg-gray-250 rounded" />
                               
                               <div className="flex gap-2">
                                  <div className="h-6 px-3 rounded-full text-[9px] font-black text-white flex items-center shadow-sm" style={{ backgroundColor: formData.theme.primaryColor }}>
                                     All Items
                                  </div>
                                  <div className="h-6 px-3 rounded-full text-[9px] font-bold text-gray-500 bg-white border flex items-center">
                                     Drinks
                                  </div>
                               </div>

                               <div className="space-y-2 pt-2">
                                  {[1, 2].map((idx) => (
                                     <div key={idx} className="bg-white p-2.5 rounded-xl border border-gray-100 flex justify-between items-center shadow-sm">
                                        <div className="space-y-1">
                                           <div className="h-2.5 w-20 bg-gray-250 rounded" />
                                           <div className="h-2 w-12 bg-gray-200 rounded" />
                                        </div>
                                        <div className="h-5 px-3 rounded-lg text-[9px] font-extrabold text-white flex items-center shadow" style={{ backgroundColor: formData.theme.primaryColor }}>
                                           Add +
                                        </div>
                                     </div>
                                  ))}
                               </div>
                            </div>

                            {/* Mockup Footer */}
                            <div 
                              className="p-3 text-center transition-colors duration-205 select-none"
                              style={{ backgroundColor: formData.theme.footerColor }}
                            >
                              <span className="text-[8px] block font-medium tracking-wide truncate" style={{ color: '#ffffff' }}>
                                 {formData.theme.footerText || '© 2026 CraveWave'}
                              </span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Notifications Tab */}
            {activeTab === 'notifications' && (
                <div className="space-y-6 animate-fade-in">
                    <div className="bg-blue-50/20 p-5 rounded-2xl border border-blue-100/50">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 border-b border-blue-100/30 pb-4">
                            <div className="flex items-center">
                                <div className="bg-blue-100 p-2.5 rounded-xl mr-3 text-blue-600">
                                    <Send className="h-5 w-5" />
                                </div>
                                <div>
                                    <h4 className="font-bold text-blue-900 text-sm">Telegram Bot Configuration</h4>
                                    <p className="text-xs text-blue-700">Configure your chat bot parameters to receive instant order alerts.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-2">
                              <button
                                  type="button"
                                  onClick={handleVerifyTelegramToken}
                                  disabled={telegramChecking}
                                  className="bg-white hover:bg-gray-50 border border-gray-300 text-gray-700 font-bold py-2 px-4 rounded-xl transition text-xs flex items-center shadow-sm cursor-pointer disabled:opacity-50"
                              >
                                  {telegramChecking ? <Loader2 className="h-3 w-3 animate-spin mr-1.5" /> : <ShieldCheck className="h-3.5 w-3.5 mr-1.5 text-green-600" />}
                                  Verify Token
                              </button>
                              <button
                                  type="button"
                                  onClick={handleTestNotification}
                                  className="bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-xl transition text-xs flex items-center shadow-sm cursor-pointer"
                              >
                                  <Send className="h-3 w-3 mr-1.5" /> Test Message
                              </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">Bot Token</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-blue-200 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
                                    value={formData.notificationSettings.telegramToken}
                                    onChange={(e) => setFormData({...formData, notificationSettings: { ...formData.notificationSettings, telegramToken: e.target.value }})}
                                    placeholder="123456789:ABCdef..."
                                />
                                {telegramBotName && (
                                   <div className="mt-1.5 flex items-center text-xs text-green-700 font-semibold gap-1 bg-green-50 px-2 py-1 rounded border border-green-150 w-fit">
                                      <ShieldCheck className="h-3.5 w-3.5 text-green-600" /> Verified: @{telegramBotName}
                                   </div>
                                )}
                            </div>
                            <div>
                                <label className="block text-xs font-bold text-blue-800 mb-1 uppercase tracking-wider">Chat ID</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-blue-200 border px-3 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 bg-white outline-none"
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
                                    <p className="text-[10px] text-gray-500 font-medium">Notify when a customer places an order online.</p>
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
                                    <p className="text-[10px] text-gray-500 font-medium">Notify when an order is created from the POS.</p>
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
                                    <p className="text-[10px] text-gray-500 font-medium">Notify when order status changes (Preparing, Ready, etc).</p>
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

                        <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h5 className="font-bold text-gray-900 text-sm">Payment Status Update</h5>
                                    <p className="text-[10px] text-gray-500 font-medium">Notify when order payment status changes (Marked as Paid).</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input 
                                        type="checkbox"
                                        className="sr-only peer"
                                        checked={formData.notificationSettings.paymentStatusUpdate}
                                        onChange={(e) => handleTelegramToggle('paymentStatusUpdate', e.target.checked)}
                                    />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-600"></div>
                                </label>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            <div className="mt-8 flex justify-end border-t border-gray-100 pt-5">
                <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-3 px-8 rounded-xl transition shadow-lg shadow-orange-200 disabled:opacity-70 cursor-pointer"
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
