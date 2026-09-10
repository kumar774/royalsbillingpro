import React, { useState, useEffect, useMemo } from 'react';
import { collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ManagedApp } from '../types';
import { 
  Smartphone, Plus, Search, Shield, AlertTriangle, CheckCircle, 
  XCircle, Clock, Copy, Edit, Trash2, RefreshCw, ExternalLink, 
  Lock, Key, Bell, ShieldCheck, Power, Layers, ArrowRight, X
} from 'lucide-react';
import { toast } from 'react-hot-toast';

interface MasterAppManagerProps {
  onLockSession: () => void;
}

export const MasterAppManager: React.FC<MasterAppManagerProps> = ({ onLockSession }) => {
  const [apps, setApps] = useState<ManagedApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'expiring' | 'suspended'>('all');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<ManagedApp | null>(null);
  const [activeModalTab, setActiveModalTab] = useState<'general' | 'expiry' | 'updates' | 'devices' | 'maintenance'>('general');

  // Form State
  const [formData, setFormData] = useState({
    appName: '',
    appId: '',
    packageName: '',
    appVersion: '1.0.0',
    minRequiredVersion: '1.0.0',
    updateUrl: '',
    forceUpdateMessage: 'A new version of the app is available. Please update to continue.',
    status: 'active' as 'active' | 'suspended' | 'expired',
    expiryDate: '',
    isLifetime: false,
    redirectUrl: '',
    lockMessage: 'Your app subscription has ended. Please contact the administrator to renew.',
    warningDaysBeforeExpiry: 3,
    warningNoticeText: 'Your subscription will expire soon! Tap here to renew.',
    maxAllowedDevices: 1,
    maintenanceMode: false,
    maintenanceMessage: 'System maintenance is currently in progress. Please check back shortly.',
    announcementNotice: '',
    showAnnouncement: false
  });

  // Listen to Firestore collection 'master_apps'
  useEffect(() => {
    const unsub = onSnapshot(collection(db, 'master_apps'), (snapshot) => {
      const list = snapshot.docs.map(docSnap => ({
        id: docSnap.id,
        ...docSnap.data()
      })) as ManagedApp[];
      setApps(list);
      setLoading(false);
    }, (err) => {
      console.error('Error fetching master apps:', err);
      toast.error('Failed to load apps');
      setLoading(false);
    });

    return () => unsub();
  }, []);

  // Quick Days Adder Helper
  const addDaysToDate = (days: number, baseDateStr?: string) => {
    const base = baseDateStr && !isNaN(new Date(baseDateStr).getTime()) ? new Date(baseDateStr) : new Date();
    // If base date was in the past, extend from today
    const startFrom = base < new Date() ? new Date() : base;
    startFrom.setDate(startFrom.getDate() + days);
    return startFrom.toISOString().slice(0, 16); // format for datetime-local
  };

  const openCreateModal = () => {
    setEditingApp(null);
    const defaultExpiry = addDaysToDate(30);
    setFormData({
      appName: '',
      appId: `APP_${Math.random().toString(36).substring(2, 7).toUpperCase()}`,
      packageName: 'com.royalsbillingpro.app',
      appVersion: '1.0.0',
      minRequiredVersion: '1.0.0',
      updateUrl: '',
      forceUpdateMessage: 'A new version of the app is available. Please update to continue.',
      status: 'active',
      expiryDate: defaultExpiry,
      isLifetime: false,
      redirectUrl: 'https://wa.me/919999999999?text=Please%20renew%20my%20app%20license',
      lockMessage: 'Your app subscription has ended. Please contact the administrator to renew.',
      warningDaysBeforeExpiry: 3,
      warningNoticeText: 'Your subscription will expire soon! Tap here to renew.',
      maxAllowedDevices: 1,
      maintenanceMode: false,
      maintenanceMessage: 'System maintenance is currently in progress. Please check back shortly.',
      announcementNotice: '',
      showAnnouncement: false
    });
    setActiveModalTab('general');
    setIsModalOpen(true);
  };

  const openEditModal = (app: ManagedApp) => {
    setEditingApp(app);
    setFormData({
      appName: app.appName || '',
      appId: app.appId || '',
      packageName: app.packageName || '',
      appVersion: app.appVersion || '1.0.0',
      minRequiredVersion: app.minRequiredVersion || '1.0.0',
      updateUrl: app.updateUrl || '',
      forceUpdateMessage: app.forceUpdateMessage || 'A new version of the app is available. Please update to continue.',
      status: app.status || 'active',
      expiryDate: app.expiryDate ? new Date(app.expiryDate).toISOString().slice(0, 16) : addDaysToDate(30),
      isLifetime: !!app.isLifetime,
      redirectUrl: app.redirectUrl || '',
      lockMessage: app.lockMessage || 'Your app subscription has ended. Please contact the administrator to renew.',
      warningDaysBeforeExpiry: app.warningDaysBeforeExpiry ?? 3,
      warningNoticeText: app.warningNoticeText || '',
      maxAllowedDevices: app.maxAllowedDevices ?? 1,
      maintenanceMode: !!app.maintenanceMode,
      maintenanceMessage: app.maintenanceMessage || 'System maintenance is currently in progress. Please check back shortly.',
      announcementNotice: app.announcementNotice || '',
      showAnnouncement: !!app.showAnnouncement
    });
    setActiveModalTab('general');
    setIsModalOpen(true);
  };

  const handleSaveApp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.appName.trim() || !formData.appId.trim()) {
      toast.error('App Name and App ID are required.');
      return;
    }

    const payload = {
      ...formData,
      appId: formData.appId.trim().toUpperCase(),
      expiryDate: formData.isLifetime ? '' : new Date(formData.expiryDate).toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      if (editingApp) {
        const docRef = doc(db, 'master_apps', editingApp.id);
        await updateDoc(docRef, payload);
        toast.success('App settings updated successfully!');
      } else {
        await addDoc(collection(db, 'master_apps'), {
          ...payload,
          registeredDevices: [],
          createdAt: new Date().toISOString()
        });
        toast.success('New app registered successfully!');
      }
      setIsModalOpen(false);
    } catch (err) {
      console.error('Save App Failed:', err);
      toast.error('Failed to save app: ' + (err as Error).message);
    }
  };

  const handleDeleteApp = async (app: ManagedApp) => {
    if (!window.confirm(`Are you sure you want to delete "${app.appName}" (${app.appId})? This action cannot be undone.`)) {
      return;
    }
    try {
      await deleteDoc(doc(db, 'master_apps', app.id));
      toast.success('App deleted successfully.');
    } catch (err) {
      toast.error('Failed to delete: ' + (err as Error).message);
    }
  };

  // Quick Kill Switch Toggle
  const handleToggleStatus = async (app: ManagedApp) => {
    const newStatus = app.status === 'active' ? 'suspended' : 'active';
    try {
      await updateDoc(doc(db, 'master_apps', app.id), {
        status: newStatus,
        updatedAt: new Date().toISOString()
      });
      toast.success(`App status changed to ${newStatus.toUpperCase()}`);
    } catch (err) {
      toast.error('Failed to toggle status: ' + (err as Error).message);
    }
  };

  // Quick Extend Expiry
  const handleQuickExtend = async (app: ManagedApp, days: number) => {
    const newExpiryISO = new Date(addDaysToDate(days, app.expiryDate)).toISOString();
    try {
      await updateDoc(doc(db, 'master_apps', app.id), {
        expiryDate: newExpiryISO,
        status: 'active',
        isLifetime: false,
        updatedAt: new Date().toISOString()
      });
      toast.success(`Extended by ${days} days for ${app.appName}`);
    } catch (err) {
      toast.error('Failed to extend: ' + (err as Error).message);
    }
  };

  // Reset Devices
  const handleResetDevices = async (app: ManagedApp) => {
    if (!window.confirm(`Reset all registered devices for "${app.appName}"? The next device that opens the app will be registered.`)) {
      return;
    }
    try {
      await updateDoc(doc(db, 'master_apps', app.id), {
        registeredDevices: [],
        updatedAt: new Date().toISOString()
      });
      toast.success('Registered devices reset successfully!');
    } catch (err) {
      toast.error('Failed to reset devices: ' + (err as Error).message);
    }
  };

  // Copy Helper
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast.success(`${label} copied to clipboard!`);
  };

  // Calculate Expiry Status & Remaining Days
  const getExpiryDetails = (app: ManagedApp) => {
    if (app.isLifetime) {
      return { isExpired: false, label: 'Lifetime License', daysLeft: Infinity, color: 'text-purple-600 bg-purple-50' };
    }
    if (!app.expiryDate) {
      return { isExpired: false, label: 'Not Set', daysLeft: 0, color: 'text-gray-500 bg-gray-100' };
    }
    const expiry = new Date(app.expiryDate);
    const now = new Date();
    const diffTime = expiry.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) {
      return { isExpired: true, label: 'Expired', daysLeft: diffDays, color: 'text-red-700 bg-red-100' };
    }
    if (diffDays <= 3) {
      return { isExpired: false, label: `${diffDays}d left (Expiring Soon)`, daysLeft: diffDays, color: 'text-amber-800 bg-amber-100 animate-pulse' };
    }
    return { isExpired: false, label: `${diffDays} days left`, daysLeft: diffDays, color: 'text-green-700 bg-green-100' };
  };

  // Filtered Apps
  const filteredApps = useMemo(() => {
    return apps.filter(app => {
      const matchesSearch = 
        app.appName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.appId?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        app.packageName?.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const details = getExpiryDetails(app);
      if (statusFilter === 'active') return app.status === 'active' && !details.isExpired;
      if (statusFilter === 'expiring') return details.daysLeft > 0 && details.daysLeft <= 3;
      if (statusFilter === 'suspended') return app.status === 'suspended' || details.isExpired;

      return true;
    });
  }, [apps, searchQuery, statusFilter]);

  // KPI Metrics
  const metrics = useMemo(() => {
    let active = 0;
    let expiring = 0;
    let suspended = 0;

    apps.forEach(app => {
      const details = getExpiryDetails(app);
      if (app.status === 'suspended' || details.isExpired) {
        suspended++;
      } else if (details.daysLeft > 0 && details.daysLeft <= 3) {
        expiring++;
        active++;
      } else {
        active++;
      }
    });

    return { total: apps.length, active, expiring, suspended };
  }, [apps]);

  return (
    <div className="space-y-6 animate-fade-in font-sans">
      {/* Top Banner & Security Info */}
      <div className="bg-gradient-to-r from-gray-900 via-gray-800 to-black text-white p-6 rounded-2xl shadow-xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border border-gray-700">
        <div>
          <div className="flex items-center space-x-2">
            <ShieldCheck className="h-6 w-6 text-orange-400" />
            <h2 className="text-xl font-bold tracking-tight">Master App & License Control Panel</h2>
          </div>
          <p className="text-gray-400 text-xs mt-1">
            Zero-Trust Cloud Shell Manager • Remote Kill-Switch • Force Updates • Anti-Sharing Protection
          </p>
        </div>

        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={openCreateModal}
            className="flex-1 md:flex-initial flex items-center justify-center px-4 py-2.5 bg-[#FF5722] hover:bg-[#F4511E] text-white text-sm font-bold rounded-xl shadow-lg transition active:scale-95"
          >
            <Plus className="h-4 w-4 mr-1.5" /> Add New App
          </button>
          <button
            onClick={onLockSession}
            className="flex items-center justify-center px-3.5 py-2.5 bg-gray-800 hover:bg-gray-700 text-gray-300 hover:text-white text-xs font-semibold rounded-xl border border-gray-700 transition"
            title="Lock session"
          >
            <Lock className="h-4 w-4 mr-1" /> Lock
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Total Apps</p>
            <p className="text-2xl font-black text-gray-900 mt-0.5">{metrics.total}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center">
            <Smartphone className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Active Licenses</p>
            <p className="text-2xl font-black text-green-600 mt-0.5">{metrics.active}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-green-50 text-green-600 flex items-center justify-center">
            <CheckCircle className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Expiring Soon</p>
            <p className="text-2xl font-black text-amber-600 mt-0.5">{metrics.expiring}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Clock className="h-5 w-5" />
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Suspended / Expired</p>
            <p className="text-2xl font-black text-red-600 mt-0.5">{metrics.suspended}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-red-50 text-red-600 flex items-center justify-center">
            <XCircle className="h-5 w-5" />
          </div>
        </div>
      </div>

      {/* Search and Filters */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by App Name, ID, or Package..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-[#FF5722]"
          />
        </div>

        <div className="flex items-center gap-1.5 w-full sm:w-auto overflow-x-auto no-scrollbar">
          {(['all', 'active', 'expiring', 'suspended'] as const).map(tab => (
            <button
              key={tab}
              onClick={() => setStatusFilter(tab)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold capitalize transition whitespace-nowrap ${
                statusFilter === tab 
                  ? 'bg-[#FF5722] text-white shadow-sm' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {/* Apps List */}
      <div className="space-y-3">
        {loading ? (
          <div className="bg-white p-12 rounded-xl text-center text-gray-400">
            <RefreshCw className="h-8 w-8 animate-spin mx-auto text-orange-500 mb-2" />
            <p className="text-sm font-medium">Loading managed apps...</p>
          </div>
        ) : filteredApps.length === 0 ? (
          <div className="bg-white p-12 rounded-xl border border-dashed border-gray-300 text-center">
            <Smartphone className="h-10 w-10 text-gray-300 mx-auto mb-2" />
            <h3 className="font-bold text-gray-800 text-base">No Managed Apps Found</h3>
            <p className="text-gray-500 text-xs mt-1">Register your first client app to manage its remote licensing and updates.</p>
            <button
              onClick={openCreateModal}
              className="mt-4 px-4 py-2 bg-[#FF5722] text-white rounded-lg text-xs font-bold shadow hover:bg-orange-600 transition"
            >
              + Add First App
            </button>
          </div>
        ) : (
          filteredApps.map(app => {
            const expiryDetails = getExpiryDetails(app);
            const isSuspended = app.status === 'suspended';

            return (
              <div 
                key={app.id} 
                className={`bg-white rounded-2xl border transition shadow-sm p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 ${
                  isSuspended || expiryDetails.isExpired 
                    ? 'border-red-200 bg-red-50/10' 
                    : 'border-gray-200 hover:border-orange-300'
                }`}
              >
                {/* Left Info */}
                <div className="flex items-start space-x-3.5 min-w-0">
                  <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 shadow-inner ${
                    isSuspended || expiryDetails.isExpired ? 'bg-red-100 text-red-600' : 'bg-orange-100 text-[#FF5722]'
                  }`}>
                    <Smartphone className="h-6 w-6" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                      <h3 className="font-bold text-gray-900 text-base">{app.appName}</h3>
                      <span className="bg-gray-100 text-gray-700 text-[10px] font-semibold px-2 py-0.5 rounded-full">
                        v{app.appVersion}
                      </span>
                      <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full ${expiryDetails.color}`}>
                        {expiryDetails.label}
                      </span>
                      {app.maintenanceMode && (
                        <span className="bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5 rounded-full">
                          ⚠️ Maintenance Mode
                        </span>
                      )}
                    </div>

                    {/* Identifiers & Details */}
                    <div className="flex items-center space-x-3 text-xs text-gray-500 mt-1 flex-wrap gap-y-1">
                      <div className="flex items-center space-x-1 font-mono bg-gray-50 px-2 py-0.5 rounded border border-gray-200">
                        <span className="font-semibold text-gray-700">{app.appId}</span>
                        <button 
                          onClick={() => copyToClipboard(app.appId, 'App ID')}
                          className="text-gray-400 hover:text-gray-700 ml-1" 
                          title="Copy App ID"
                        >
                          <Copy className="h-3 w-3" />
                        </button>
                      </div>
                      <span className="text-gray-400 truncate max-w-[200px]">{app.packageName}</span>
                      <span className="text-gray-400">•</span>
                      <span>Devices: {app.registeredDevices?.length || 0}/{app.maxAllowedDevices || 1}</span>
                    </div>
                  </div>
                </div>

                {/* Right Action Controls */}
                <div className="flex items-center space-x-2 flex-wrap gap-y-2 border-t lg:border-t-0 pt-3 lg:pt-0">
                  {/* Status Toggle Button */}
                  <button
                    onClick={() => handleToggleStatus(app)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center space-x-1.5 transition ${
                      isSuspended
                        ? 'bg-red-600 hover:bg-red-700 text-white'
                        : 'bg-green-600 hover:bg-green-700 text-white'
                    }`}
                    title="Click to toggle status"
                  >
                    <Power className="h-3.5 w-3.5" />
                    <span>{isSuspended ? 'SUSPENDED' : 'ACTIVE'}</span>
                  </button>

                  {/* Quick Extension Buttons */}
                  <div className="flex items-center space-x-1 bg-gray-100 p-1 rounded-lg">
                    <button
                      onClick={() => handleQuickExtend(app, 7)}
                      className="px-2 py-1 text-[11px] font-bold bg-white text-gray-700 hover:text-[#FF5722] rounded shadow-xs transition"
                      title="Add 7 Days"
                    >
                      +7d
                    </button>
                    <button
                      onClick={() => handleQuickExtend(app, 30)}
                      className="px-2 py-1 text-[11px] font-bold bg-white text-gray-700 hover:text-[#FF5722] rounded shadow-xs transition"
                      title="Add 1 Month"
                    >
                      +1m
                    </button>
                    <button
                      onClick={() => handleQuickExtend(app, 365)}
                      className="px-2 py-1 text-[11px] font-bold bg-white text-gray-700 hover:text-[#FF5722] rounded shadow-xs transition"
                      title="Add 1 Year"
                    >
                      +1y
                    </button>
                  </div>

                  {/* Reset Device Lock */}
                  {(app.registeredDevices?.length || 0) > 0 && (
                    <button
                      onClick={() => handleResetDevices(app)}
                      className="p-2 text-gray-400 hover:text-amber-600 bg-gray-50 hover:bg-amber-50 rounded-lg border border-gray-200 transition"
                      title="Reset Registered Devices"
                    >
                      <RefreshCw className="h-3.5 w-3.5" />
                    </button>
                  )}

                  {/* Edit Button */}
                  <button
                    onClick={() => openEditModal(app)}
                    className="p-2 text-gray-600 hover:text-[#FF5722] bg-gray-50 hover:bg-orange-50 rounded-lg border border-gray-200 transition"
                    title="Edit App Settings"
                  >
                    <Edit className="h-3.5 w-3.5" />
                  </button>

                  {/* Delete Button */}
                  <button
                    onClick={() => handleDeleteApp(app)}
                    className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-lg border border-gray-200 transition"
                    title="Delete App"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Add / Edit Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="p-5 bg-gray-900 text-white flex justify-between items-center shrink-0">
              <div className="flex items-center space-x-2">
                <Smartphone className="h-5 w-5 text-orange-400" />
                <h3 className="font-bold text-base">
                  {editingApp ? `Edit App: ${editingApp.appName}` : 'Register New Managed App'}
                </h3>
              </div>
              <button 
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg bg-gray-800 text-gray-400 hover:text-white transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 px-5 bg-gray-50 overflow-x-auto no-scrollbar shrink-0">
              {[
                { id: 'general', label: 'General Info' },
                { id: 'expiry', label: 'Subscription & Expiry' },
                { id: 'updates', label: 'Force Updates' },
                { id: 'devices', label: 'Device Binding' },
                { id: 'maintenance', label: 'Announcements' },
              ].map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveModalTab(tab.id as any)}
                  className={`py-3 px-3 text-xs font-bold border-b-2 whitespace-nowrap transition ${
                    activeModalTab === tab.id
                      ? 'border-[#FF5722] text-[#FF5722]'
                      : 'border-transparent text-gray-500 hover:text-gray-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Modal Form Body */}
            <form onSubmit={handleSaveApp} className="flex-1 overflow-y-auto p-6 space-y-4">
              {/* TAB 1: General Info */}
              {activeModalTab === 'general' && (
                <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      App Name *
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. SS Pizza Billing Pro"
                      value={formData.appName}
                      onChange={(e) => setFormData({ ...formData, appName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                    />
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Unique App ID (License Key) *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. APP_SS_PIZZA_01"
                        value={formData.appId}
                        onChange={(e) => setFormData({ ...formData, appId: e.target.value.toUpperCase() })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono font-bold"
                      />
                      <p className="text-[10px] text-gray-400 mt-1">This ID connects the APK directly to this control panel.</p>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                        Current App Version *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. 1.0.0"
                        value={formData.appVersion}
                        onChange={(e) => setFormData({ ...formData, appVersion: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Android Package Name
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. com.royalsbillingpro.sspizza"
                      value={formData.packageName}
                      onChange={(e) => setFormData({ ...formData, packageName: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-xs"
                    />
                  </div>
                </div>
              )}

              {/* TAB 2: Subscription & Expiry */}
              {activeModalTab === 'expiry' && (
                <div className="space-y-4">
                  {/* Status Toggle */}
                  <div className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-200">
                    <div>
                      <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">License Status</span>
                      <p className="text-[11px] text-gray-500">Toggle OFF to instantly lock the client app.</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, status: formData.status === 'active' ? 'suspended' : 'active' })}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center space-x-1.5 ${
                        formData.status === 'active'
                          ? 'bg-green-600 text-white shadow-sm'
                          : 'bg-red-600 text-white shadow-sm'
                      }`}
                    >
                      <Power className="h-3.5 w-3.5" />
                      <span>{formData.status.toUpperCase()}</span>
                    </button>
                  </div>

                  {/* Lifetime Checkbox */}
                  <label className="flex items-center space-x-2.5 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={formData.isLifetime}
                      onChange={(e) => setFormData({ ...formData, isLifetime: e.target.checked })}
                      className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
                    />
                    <span className="text-xs font-bold text-purple-700">Lifetime License (Never Expires)</span>
                  </label>

                  {/* Expiry Date Picker & Quick Buttons */}
                  {!formData.isLifetime && (
                    <div className="space-y-2">
                      <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider">
                        Expiry Date & Time
                      </label>
                      <input
                        type="datetime-local"
                        value={formData.expiryDate}
                        onChange={(e) => setFormData({ ...formData, expiryDate: e.target.value })}
                        className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                      />

                      {/* Quick Extend Buttons */}
                      <div className="flex items-center space-x-2 pt-1">
                        <span className="text-[11px] font-bold text-gray-400">Quick Set:</span>
                        {[
                          { label: '+7 Days Trial', days: 7 },
                          { label: '+1 Month', days: 30 },
                          { label: '+3 Months', days: 90 },
                          { label: '+1 Year', days: 365 },
                        ].map(q => (
                          <button
                            key={q.label}
                            type="button"
                            onClick={() => setFormData({ ...formData, expiryDate: addDaysToDate(q.days) })}
                            className="px-2.5 py-1 text-[11px] font-bold bg-orange-50 text-orange-700 hover:bg-orange-100 rounded-lg transition"
                          >
                            {q.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Redirect URL */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Expiry Redirect URL (WhatsApp / Payment Link)
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. https://wa.me/919999999999?text=Please%20renew or whatsapp://send?phone=919999999999"
                      value={formData.redirectUrl}
                      onChange={(e) => setFormData({ ...formData, redirectUrl: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-mono text-xs"
                    />
                    <p className="text-[10px] text-gray-400 mt-1">Directly opens WhatsApp on Android (no web page preview) or redirects to any custom payment URL.</p>
                  </div>

                  {/* Lock Screen Message */}
                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Custom Lock Screen Message
                    </label>
                    <textarea
                      rows={2}
                      value={formData.lockMessage}
                      onChange={(e) => setFormData({ ...formData, lockMessage: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  </div>

                  {/* Pre-Expiry Warning */}
                  <div className="grid grid-cols-3 gap-3">
                    <div className="col-span-1">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                        Warning Days
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={14}
                        value={formData.warningDaysBeforeExpiry}
                        onChange={(e) => setFormData({ ...formData, warningDaysBeforeExpiry: parseInt(e.target.value) || 3 })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                      />
                    </div>
                    <div className="col-span-2">
                      <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">
                        Warning Banner Text
                      </label>
                      <input
                        type="text"
                        value={formData.warningNoticeText}
                        onChange={(e) => setFormData({ ...formData, warningNoticeText: e.target.value })}
                        className="w-full px-3 py-2 bg-gray-50 border border-gray-300 rounded-lg text-xs"
                        placeholder="Plan expiring soon! Please renew."
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: Force Updates */}
              {activeModalTab === 'updates' && (
                <div className="space-y-4">
                  <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-xs text-blue-800 leading-relaxed">
                    💡 <strong>Force Update Rule:</strong> If a client opens an app with a version lower than the minimum required version, the app will freeze and force them to download the new APK.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Minimum Required Version
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. 1.1.0"
                      value={formData.minRequiredVersion}
                      onChange={(e) => setFormData({ ...formData, minRequiredVersion: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-medium"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      New APK Download Link
                    </label>
                    <input
                      type="url"
                      placeholder="https://yourserver.com/app-v1.1.apk"
                      value={formData.updateUrl}
                      onChange={(e) => setFormData({ ...formData, updateUrl: e.target.value })}
                      className="w-full px-3.5 py-2.5 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Update Notification Message
                    </label>
                    <textarea
                      rows={2}
                      value={formData.forceUpdateMessage}
                      onChange={(e) => setFormData({ ...formData, forceUpdateMessage: e.target.value })}
                      className="w-full px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                    />
                  </div>
                </div>
              )}

              {/* TAB 4: Device Binding */}
              {activeModalTab === 'devices' && (
                <div className="space-y-4">
                  <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 leading-relaxed">
                    🛡️ <strong>Anti-Sharing Protection:</strong> Prevents clients from sharing the same APK with other restaurants. Once the maximum device count is reached, new devices will be blocked.
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-gray-700 uppercase tracking-wider mb-1">
                      Max Allowed Devices
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={10}
                      value={formData.maxAllowedDevices}
                      onChange={(e) => setFormData({ ...formData, maxAllowedDevices: parseInt(e.target.value) || 1 })}
                      className="w-32 px-3.5 py-2 bg-gray-50 border border-gray-300 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 font-bold"
                    />
                  </div>

                  {editingApp && (
                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-2">
                      <div className="flex justify-between items-center">
                        <span className="text-xs font-bold text-gray-700">Currently Registered Devices</span>
                        <span className="text-xs font-black text-gray-900">
                          {editingApp.registeredDevices?.length || 0} / {editingApp.maxAllowedDevices || 1}
                        </span>
                      </div>
                      {(editingApp.registeredDevices?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={() => handleResetDevices(editingApp)}
                          className="mt-2 text-xs font-bold text-red-600 hover:text-red-800 flex items-center gap-1"
                        >
                          <RefreshCw className="h-3.5 w-3.5" /> Reset All Registered Devices
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* TAB 5: Announcements & Maintenance */}
              {activeModalTab === 'maintenance' && (
                <div className="space-y-4">
                  {/* Maintenance Mode Toggle */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">Maintenance Mode</span>
                        <p className="text-[11px] text-gray-500">Temporarily freeze the app for server maintenance.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.maintenanceMode}
                        onChange={(e) => setFormData({ ...formData, maintenanceMode: e.target.checked })}
                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                      />
                    </div>
                    {formData.maintenanceMode && (
                      <input
                        type="text"
                        placeholder="Maintenance Message"
                        value={formData.maintenanceMessage}
                        onChange={(e) => setFormData({ ...formData, maintenanceMessage: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    )}
                  </div>

                  {/* Announcement Banner */}
                  <div className="p-4 bg-gray-50 rounded-xl border border-gray-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-xs font-bold text-gray-800 uppercase tracking-wider">In-App Announcement</span>
                        <p className="text-[11px] text-gray-500">Broadcast a message at the top of the client app.</p>
                      </div>
                      <input
                        type="checkbox"
                        checked={formData.showAnnouncement}
                        onChange={(e) => setFormData({ ...formData, showAnnouncement: e.target.checked })}
                        className="w-5 h-5 text-orange-600 rounded focus:ring-orange-500"
                      />
                    </div>
                    {formData.showAnnouncement && (
                      <input
                        type="text"
                        placeholder="e.g. Festival Greetings or Notice"
                        value={formData.announcementNotice}
                        onChange={(e) => setFormData({ ...formData, announcementNotice: e.target.value })}
                        className="w-full px-3 py-2 bg-white border border-gray-300 rounded-lg text-xs"
                      />
                    )}
                  </div>
                </div>
              )}

              {/* Modal Footer Buttons */}
              <div className="pt-4 border-t border-gray-200 flex justify-end space-x-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-gray-300 text-gray-700 text-xs font-bold hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 rounded-xl bg-[#FF5722] hover:bg-[#F4511E] text-white text-xs font-bold shadow-lg transition active:scale-95"
                >
                  {editingApp ? 'Update App Settings' : 'Save & Register App'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default MasterAppManager;
