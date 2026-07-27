import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ThemeSettings, SocialLinks } from '../types';
import { Save, Loader2, Layout, Share2, Globe, Trash2, Database, Download, Sparkles, Smartphone, Monitor, ShieldAlert } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cleanupDeprecatedSettings, getUnusedSettingsCount, cleanupRestaurantFields } from '../src/utils/dbCleanup';
import { generateFullBackup, downloadBackup } from '../src/utils/backup';

const COLOR_PRESETS = [
  { name: 'Sunset Orange', primary: '#ea580c', bg: '#f9fafb', text: '#111827' },
  { name: 'Forest Green', primary: '#15803d', bg: '#f0fdf4', text: '#166534' },
  { name: 'Midnight Blue', primary: '#1d4ed8', bg: '#eff6ff', text: '#1e40af' },
  { name: 'Rose Red', primary: '#be123c', bg: '#fff1f2', text: '#9f1239' }
];

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [activeTab, setActiveTab] = useState<'theme' | 'hero' | 'features' | 'links' | 'system'>('theme');
  const [previewDevice, setPreviewDevice] = useState<'desktop' | 'mobile'>('desktop');
  
  const [formData, setFormData] = useState({
    theme: {
      headerColor: '#ffffff',
      headerText: 'CraveWave',
      logoUrl: '',
      primaryColor: '#ea580c',
      heroImage: '',
      aboutTitle: '',
      aboutText: '',
      heroBgColor: '#f9fafb',
      landingHeroTitle: '',
      landingHeroSub: '',
      features: [
        { title: '', description: '' },
        { title: '', description: '' },
        { title: '', description: '' }
      ],
      footerColor: '#111827',
      footerText: '© 2024 CraveWave Technologies Inc.',
    } as ThemeSettings,
    homeViewMode: 'Landing Page',
    socialLinks: {
        instagram: '',
        facebook: '',
        twitter: '',
        linkedin: ''
    } as SocialLinks
  });

  useEffect(() => {
    const fetchSettings = async () => {
      const docRef = doc(db, 'settings', 'landingPage');
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        setFormData({
            theme: {
              headerColor: data.theme?.headerColor || '#ffffff',
              headerText: data.theme?.headerText || 'CraveWave',
              logoUrl: data.theme?.logoUrl || '',
              primaryColor: data.theme?.primaryColor || '#ea580c',
              heroImage: data.theme?.heroImage || '',
              aboutTitle: data.theme?.aboutTitle || 'About Our Software',
              aboutText: data.theme?.aboutText || '',
              heroBgColor: data.theme?.heroBgColor || '#f9fafb',
              landingHeroTitle: data.theme?.landingHeroTitle || 'Professional Billing Software',
              landingHeroSub: data.theme?.landingHeroSub || 'Manage your restaurant operations with ease.',
              features: data.theme?.features || [
                { title: '', description: '' },
                { title: '', description: '' },
                { title: '', description: '' }
              ],
              footerColor: data.theme?.footerColor || '#111827',
              footerText: data.theme?.footerText || '© 2024 CraveWave Technologies Inc.',
            },
            homeViewMode: data.homeViewMode || 'Landing Page',
            socialLinks: {
                instagram: data.socialLinks?.instagram || '',
                facebook: data.socialLinks?.facebook || '',
                twitter: data.socialLinks?.twitter || '',
                linkedin: data.socialLinks?.linkedin || ''
            }
        });
      }
      setLoading(false);
    };
    fetchSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const toastId = toast.loading("Saving global settings...");

    try {
      const docRef = doc(db, 'settings', 'landingPage');
      await setDoc(docRef, formData, { merge: true });
      toast.success("Global settings updated successfully!", { id: toastId });
    } catch (error) {
      console.error(error);
      toast.error("Failed to update settings: " + (error as Error).message, { id: toastId });
    } finally {
      setSaving(false);
    }
  };

  const applyPreset = (preset: typeof COLOR_PRESETS[0]) => {
    setFormData(prev => ({
      ...prev,
      theme: {
        ...prev.theme,
        primaryColor: preset.primary,
        heroBgColor: preset.bg
      }
    }));
    toast.success(`Applied ${preset.name} palette!`);
  };

  const [showCleanupModal, setShowCleanupModal] = useState(false);
  const [cleanupMessage, setCleanupMessage] = useState('');
  const [unusedCount, setUnusedCount] = useState(0);

  const startCleanupScan = async () => {
    setCleaning(true);
    const toastId = toast.loading("Scanning for unused settings...");
    try {
        const count = await getUnusedSettingsCount();
        setUnusedCount(count);
        setCleanupMessage(count > 0 
            ? `Found ${count} unused settings documents. This action will permanently delete these configuration logs and clean up redundant DB properties inside active restaurants. Are you sure you want to proceed?`
            : `No unused settings documents found. However, we can perform a maintenance scan to clean up deprecated database fields on existing restaurants. Do you want to run this?`
        );
        setShowCleanupModal(true);
        toast.dismiss(toastId);
    } catch (error) {
        toast.error("Scan failed: " + (error as Error).message, { id: toastId });
    } finally {
        setCleaning(false);
    }
  };

  const executeCleanup = async () => {
    setShowCleanupModal(false);
    setCleaning(true);
    const toastId = toast.loading("Cleaning up database...");
    try {
        let deletedSettings: string[] = [];
        if (unusedCount > 0) {
            deletedSettings = await cleanupDeprecatedSettings();
        }
        
        const cleanedRestaurants = await cleanupRestaurantFields();
        toast.success(`Cleanup complete. Deleted ${deletedSettings.length} settings docs. Cleaned ${cleanedRestaurants} restaurants.`, { id: toastId });
    } catch (error) {
        toast.error("Cleanup failed: " + (error as Error).message, { id: toastId });
    } finally {
        setCleaning(false);
    }
  };

  const handleBackup = async () => {
    setBackingUp(true);
    const toastId = toast.loading("Generating full backup...");
    try {
        const data = await generateFullBackup();
        downloadBackup(data);
        toast.success("Backup downloaded successfully!", { id: toastId });
    } catch (error) {
        console.error(error);
        toast.error("Backup failed: " + (error as Error).message, { id: toastId });
    } finally {
        setBackingUp(false);
    }
  };

  if (loading) return <div className="p-8 flex justify-center"><Loader2 className="animate-spin h-8 w-8 text-orange-600" /></div>;

  return (
    <div className="max-w-7xl mx-auto pb-10 font-sans">
      {/* Title Header */}
      <div className="mb-8 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 tracking-tight">System Global Settings</h2>
          <p className="text-gray-500 text-sm mt-1">Configure layout modes, brand visuals, landing sections, and perform database maintenance.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left Column: Form & Tab Navigation */}
        <div className="lg:col-span-8 space-y-6">
          <div className="bg-white rounded-3xl shadow-sm border border-gray-150 overflow-hidden flex flex-col md:flex-row min-h-[600px]">
            {/* Sidebar Tab Menu */}
            <div className="w-full md:w-56 bg-gray-50/50 border-r border-gray-150 p-4 flex flex-col gap-1 flex-shrink-0">
              <span className="text-[10px] font-extrabold text-gray-400 uppercase tracking-widest px-3 mb-2 block">Settings Tabs</span>
              {[
                { id: 'theme', label: '🎨 Theme & Style' },
                { id: 'hero', label: '🚀 Hero Layout' },
                { id: 'features', label: '✨ About & Cards' },
                { id: 'links', label: '🔗 Footer Links' },
                { id: 'system', label: '⚙️ Maintenance' }
              ].map(tab => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id as any)}
                  className={`w-full text-left px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer border-0 outline-none ${
                    activeTab === tab.id 
                      ? 'bg-orange-50 text-orange-700 border-l-4 border-orange-600' 
                      : 'text-gray-600 hover:bg-gray-100 border-l-4 border-transparent bg-transparent'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Form Settings Content */}
            <form onSubmit={handleSave} className="flex-1 p-6 flex flex-col justify-between">
              <div>
                {/* 1. Theme and Brand Tab */}
                {activeTab === 'theme' && (
                  <div className="space-y-6 animate-fade-in text-left">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Brand Identity & Styling</h3>
                      <p className="text-xs text-gray-450 mt-0.5 font-medium">Control the primary theme colors and branding name of your aggregator app.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Home View Mode</label>
                        <select 
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 focus:border-orange-500 outline-none font-bold text-gray-800 bg-white"
                          value={formData.homeViewMode}
                          onChange={(e) => setFormData({...formData, homeViewMode: e.target.value})}
                        >
                          <option value="Landing Page">Landing Page (Company CMS)</option>
                          <option value="Default List">Default List (Zomato-style Outlets Grid)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Brand Logo URL</label>
                        <input 
                          type="text" 
                          placeholder="https://yourlogo.com/image.png"
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.logoUrl}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, logoUrl: e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Header Brand Title</label>
                        <input 
                          type="text" 
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.headerText}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, headerText: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Header Background Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            className="h-9 w-12 p-0 border border-gray-300 rounded-lg cursor-pointer"
                            value={formData.theme.headerColor}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, headerColor: e.target.value}})}
                          />
                          <input 
                            type="text" 
                            className="flex-1 rounded-xl border-gray-250 border px-3 py-1.5 text-xs font-mono uppercase outline-none"
                            value={formData.theme.headerColor}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, headerColor: e.target.value}})}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <label className="block text-xs font-bold text-gray-705">App Theme Presets</label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {COLOR_PRESETS.map((preset, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => applyPreset(preset)}
                            className="p-2 border border-gray-200 hover:border-gray-400 rounded-xl text-[10px] font-bold flex flex-col items-center gap-1.5 cursor-pointer bg-white transition"
                          >
                            <span className="w-6 h-6 rounded-full border border-gray-100" style={{ backgroundColor: preset.primary }} />
                            <span>{preset.name}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Primary Theme Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            className="h-9 w-12 p-0 border border-gray-300 rounded-lg cursor-pointer"
                            value={formData.theme.primaryColor || '#ea580c'}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})}
                          />
                          <input 
                            type="text" 
                            className="flex-1 rounded-xl border-gray-250 border px-3 py-1.5 text-xs font-mono uppercase outline-none"
                            value={formData.theme.primaryColor || '#ea580c'}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, primaryColor: e.target.value}})}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Hero Section Bg Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            className="h-9 w-12 p-0 border border-gray-300 rounded-lg cursor-pointer"
                            value={formData.theme.heroBgColor}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, heroBgColor: e.target.value}})}
                          />
                          <input 
                            type="text" 
                            className="flex-1 rounded-xl border-gray-250 border px-3 py-1.5 text-xs font-mono uppercase outline-none"
                            value={formData.theme.heroBgColor}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, heroBgColor: e.target.value}})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 2. Hero Content Tab */}
                {activeTab === 'hero' && (
                  <div className="space-y-6 animate-fade-in text-left">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Hero banner Details</h3>
                      <p className="text-xs text-gray-450 mt-0.5 font-medium">Edit title headers and promotional graphic banners on the Landing Page.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Landing Hero Main Title</label>
                        <textarea 
                          rows={2}
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.landingHeroTitle}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, landingHeroTitle: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Landing Hero Subtitle</label>
                        <textarea 
                          rows={2}
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.landingHeroSub}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, landingHeroSub: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Landing Hero Banner Image URL</label>
                        <input 
                          type="text" 
                          placeholder="https://images.unsplash.com/your-image-id..."
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.heroImage}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, heroImage: e.target.value}})}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. About & Features Tab */}
                {activeTab === 'features' && (
                  <div className="space-y-6 animate-fade-in text-left">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">About CMS & Feature Highlights</h3>
                      <p className="text-xs text-gray-455 mt-0.5 font-medium">Control descriptive text paragraphs and features matrix on the Landing Page CMS.</p>
                    </div>

                    <div className="space-y-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">About Section Title</label>
                        <input 
                          type="text" 
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.aboutTitle}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, aboutTitle: e.target.value}})}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">About Section Paragraph Text</label>
                        <textarea 
                          rows={4}
                          className="w-full rounded-xl border-gray-250 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium leading-relaxed"
                          value={formData.theme.aboutText}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, aboutText: e.target.value}})}
                        />
                      </div>

                      <div className="space-y-4 pt-4 border-t">
                        <span className="text-xs font-bold text-gray-800 block">Features Info Grid (3 Cards)</span>
                        {[0, 1, 2].map((index) => (
                          <div key={index} className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 mb-1">Feature {index + 1} Title</label>
                              <input 
                                type="text" 
                                className="w-full rounded-xl border-gray-255 border px-3 py-1.5 text-xs bg-white outline-none"
                                value={formData.theme.features?.[index]?.title || ''}
                                onChange={(e) => {
                                    const newFeatures = [...(formData.theme.features || [])];
                                    if (!newFeatures[index]) newFeatures[index] = { title: '', description: '' };
                                    newFeatures[index].title = e.target.value;
                                    setFormData({...formData, theme: {...formData.theme, features: newFeatures}});
                                }}
                              />
                            </div>
                            <div>
                              <label className="block text-[10px] font-bold text-gray-500 mb-1">Feature {index + 1} Description</label>
                              <input 
                                type="text" 
                                className="w-full rounded-xl border-gray-255 border px-3 py-1.5 text-xs bg-white outline-none"
                                value={formData.theme.features?.[index]?.description || ''}
                                onChange={(e) => {
                                    const newFeatures = [...(formData.theme.features || [])];
                                    if (!newFeatures[index]) newFeatures[index] = { title: '', description: '' };
                                    newFeatures[index].description = e.target.value;
                                    setFormData({...formData, theme: {...formData.theme, features: newFeatures}});
                                }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. Footer & Links Tab */}
                {activeTab === 'links' && (
                  <div className="space-y-6 animate-fade-in text-left">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Footer Styling & Social links</h3>
                      <p className="text-xs text-gray-450 mt-0.5 font-medium">Configure copyright texts, footer colors, and links to brand handles.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Footer Background Color</label>
                        <div className="flex gap-2">
                          <input 
                            type="color" 
                            className="h-9 w-12 p-0 border border-gray-300 rounded-lg cursor-pointer"
                            value={formData.theme.footerColor}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerColor: e.target.value}})}
                          />
                          <input 
                            type="text" 
                            className="flex-1 rounded-xl border-gray-255 border px-3 py-1.5 text-xs font-mono uppercase outline-none"
                            value={formData.theme.footerColor}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerColor: e.target.value}})}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-705 mb-1.5">Footer Copyright Text</label>
                        <input 
                          type="text" 
                          className="w-full rounded-xl border-gray-255 border px-3 py-2 text-xs focus:ring-2 focus:ring-orange-200 outline-none font-medium"
                          value={formData.theme.footerText}
                          onChange={(e) => setFormData({...formData, theme: {...formData.theme, footerText: e.target.value}})}
                        />
                      </div>
                    </div>

                    <div className="space-y-4 pt-4 border-t">
                      <span className="text-xs font-bold text-gray-800 block">Social Media Handles</span>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Instagram URL</label>
                          <input 
                            type="text" 
                            placeholder="https://instagram.com/..."
                            className="w-full rounded-xl border-gray-255 border px-3 py-1.5 text-xs outline-none"
                            value={formData.socialLinks.instagram}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Facebook URL</label>
                          <input 
                            type="text" 
                            placeholder="https://facebook.com/..."
                            className="w-full rounded-xl border-gray-255 border px-3 py-1.5 text-xs outline-none"
                            value={formData.socialLinks.facebook}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">Twitter URL</label>
                          <input 
                            type="text" 
                            placeholder="https://twitter.com/..."
                            className="w-full rounded-xl border-gray-255 border px-3 py-1.5 text-xs outline-none"
                            value={formData.socialLinks.twitter}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, twitter: e.target.value}})}
                          />
                        </div>
                        <div>
                          <label className="block text-[10px] font-bold text-gray-500 mb-1">LinkedIn URL</label>
                          <input 
                            type="text" 
                            placeholder="https://linkedin.com/..."
                            className="w-full rounded-xl border-gray-255 border px-3 py-1.5 text-xs outline-none"
                            value={formData.socialLinks.linkedin}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, linkedin: e.target.value}})}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 5. Database & Maintenance Tab */}
                {activeTab === 'system' && (
                  <div className="space-y-6 animate-fade-in text-left">
                    <div>
                      <h3 className="text-lg font-bold text-gray-900">Database Tools & Utilities</h3>
                      <p className="text-xs text-gray-450 mt-0.5 font-medium">Generate JSON backup dumps and perform optimization cleanup sweeps.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-2">
                      <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-between min-h-[160px]">
                        <div>
                          <span className="text-xs font-extrabold text-blue-700 flex items-center gap-1.5">
                            <Database className="h-4.5 w-4.5" /> Database JSON Backup
                          </span>
                          <p className="text-[10px] text-gray-550 font-medium leading-relaxed mt-2">
                            Download a full dump of all restaurants metadata, active category menus, orders lists, and global configurations in one click.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={handleBackup}
                          disabled={backingUp}
                          className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-75 mt-4 border-0 outline-none"
                        >
                          {backingUp ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" /> : <Download className="h-3.5 w-3.5 mr-1.5" />}
                          Download Backup Dump
                        </button>
                      </div>

                      <div className="p-5 bg-red-50/55 rounded-2xl border border-red-100 flex flex-col justify-between min-h-[160px]">
                        <div>
                          <span className="text-xs font-extrabold text-red-700 flex items-center gap-1.5">
                            <Trash2 className="h-4.5 w-4.5" /> Database Maintenance
                          </span>
                          <p className="text-[10px] text-gray-555 font-medium leading-relaxed mt-2">
                            Scans the database collections for orphan settings logs or redundant config parameters. Safe operation; verified active outlets are preserved.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={startCleanupScan}
                          disabled={cleaning}
                          className="w-full flex justify-center items-center bg-red-650 hover:bg-red-750 text-white font-bold py-2 px-3 rounded-xl text-xs transition cursor-pointer disabled:opacity-75 mt-4 border-0 outline-none"
                        >
                          {cleaning ? <Loader2 className="animate-spin h-3.5 w-3.5 mr-1.5" /> : <Trash2 className="h-3.5 w-3.5 mr-1.5" />}
                          Scan & Run Cleanup
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Save Footer button (not visible on system maintenance tab) */}
              {activeTab !== 'system' && (
                <div className="pt-6 border-t border-gray-150 flex justify-end mt-8">
                  <button
                    type="submit"
                    disabled={saving}
                    className="flex items-center bg-orange-600 hover:bg-orange-700 text-white font-bold py-2.5 px-6 rounded-xl text-xs transition shadow-lg shadow-orange-100 disabled:opacity-70 cursor-pointer border-0 outline-none"
                  >
                    {saving ? (
                      <>
                        <Loader2 className="animate-spin -ml-1 mr-2 h-4 w-4" /> Saving Settings...
                      </>
                    ) : (
                      <>
                        <Save className="mr-2 h-4 w-4" /> Save Global Configuration
                      </>
                    )}
                  </button>
                </div>
              )}
            </form>
          </div>
        </div>

        {/* Right Column: Live Mockup Preview Canvas */}
        <div className="lg:col-span-4 space-y-4 sticky top-6">
          <div className="flex items-center justify-between">
            <span className="text-xs font-extrabold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
              <Sparkles className="h-4 w-4 text-orange-500" /> Interactive Mockup Preview
            </span>
            <div className="bg-gray-100 p-0.5 rounded-lg flex items-center gap-0.5 border border-gray-250">
              <button 
                type="button"
                onClick={() => setPreviewDevice('desktop')}
                className={`p-1 rounded cursor-pointer border-0 ${previewDevice === 'desktop' ? 'bg-white shadow text-orange-655 font-bold' : 'text-gray-500 bg-transparent'}`}
              >
                <Monitor className="h-4 w-4" />
              </button>
              <button 
                type="button"
                onClick={() => setPreviewDevice('mobile')}
                className={`p-1 rounded cursor-pointer border-0 ${previewDevice === 'mobile' ? 'bg-white shadow text-orange-655 font-bold' : 'text-gray-500 bg-transparent'}`}
              >
                <Smartphone className="h-4 w-4" />
              </button>
            </div>
          </div>

          {/* Device Wrapper Container */}
          <div className={`mx-auto bg-gray-900 p-2.5 shadow-2xl transition-all duration-300 ease-in-out border border-gray-800 ${
            previewDevice === 'desktop' ? 'w-full rounded-2xl' : 'w-[280px] rounded-[2rem]'
          }`}>
            <div className={`bg-white text-gray-900 overflow-hidden flex flex-col font-sans transition-all select-none ${
              previewDevice === 'desktop' ? 'aspect-video rounded-xl' : 'h-[440px] rounded-[1.5rem]'
            }`}>
              {/* Header Mockup */}
              <div 
                className="px-4 py-2.5 border-b flex justify-between items-center transition-colors"
                style={{ backgroundColor: formData.theme.headerColor || '#ffffff' }}
              >
                <div className="flex items-center gap-1.5">
                  <span className="w-5 h-5 rounded bg-orange-600 flex items-center justify-center text-[10px] text-white font-extrabold">🍴</span>
                  <span className="text-[10px] font-extrabold text-gray-800 tracking-tight">{formData.theme.headerText}</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-[8px] font-bold text-gray-500">Dashboard</span>
                  <span className="w-4 h-4 rounded-full bg-orange-100 flex items-center justify-center text-[8px] text-orange-700 font-bold">AD</span>
                </div>
              </div>

              {/* Body Content Mockup */}
              <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col bg-gray-50 text-[10px]">
                {formData.homeViewMode === 'Landing Page' ? (
                  /* Landing Page Mockup */
                  <div className="flex-1 flex flex-col">
                    {/* Hero Section */}
                    <div 
                      className="p-6 text-center space-y-2 relative overflow-hidden"
                      style={{ backgroundColor: formData.theme.heroBgColor || '#f9fafb' }}
                    >
                      <h4 className="text-xs font-extrabold leading-tight text-gray-900 break-words max-w-[90%] mx-auto">
                        {formData.theme.landingHeroTitle || 'Professional Billing & Management'}
                      </h4>
                      <p className="text-[7px] text-gray-550 font-medium leading-relaxed max-w-[80%] mx-auto line-clamp-2">
                        {formData.theme.landingHeroSub || 'The all-in-one POS solution.'}
                      </p>
                      <button 
                        type="button"
                        className="px-3 py-1 rounded text-[7px] text-white font-extrabold mx-auto block pointer-events-none border-0"
                        style={{ backgroundColor: formData.theme.primaryColor || '#ea580c' }}
                      >
                        Get Started
                      </button>
                    </div>

                    {/* About Section */}
                    <div className="p-4 bg-white border-t border-b border-gray-100 text-left space-y-1">
                      <h5 className="font-bold text-[8px] text-gray-900">{formData.theme.aboutTitle}</h5>
                      <p className="text-[6px] text-gray-440 font-medium leading-relaxed line-clamp-3">{formData.theme.aboutText || 'Designed for modern hospitality. Real-time sync, cloud based, multi-device POS operations.'}</p>
                    </div>
                  </div>
                ) : (
                  /* Default List Mode Mockup */
                  <div className="p-4 space-y-4">
                    {/* Aggregator Hero Box */}
                    <div className="bg-gradient-to-r from-orange-500 to-red-650 p-4 rounded-xl text-white space-y-1.5">
                      <h4 className="text-[10px] font-extrabold">Order from local favorites</h4>
                      <div className="w-full bg-white rounded p-1 flex items-center">
                        <span className="text-[7px] text-gray-400 font-bold">Search restaurant...</span>
                      </div>
                    </div>

                    {/* Food cards */}
                    <div className="space-y-2">
                      <span className="font-extrabold text-[8px] text-gray-700 block">Outlets</span>
                      <div className="grid grid-cols-2 gap-2">
                        {[{ name: 'SS Pizza', status: '🟢 Open' }, { name: 'Touchwood', status: '🔴 Closed' }].map((outlet, i) => (
                          <div key={i} className="bg-white rounded-lg border border-gray-205 overflow-hidden shadow-sm flex flex-col">
                            <div className="h-10 bg-gray-250 relative" />
                            <div className="p-1.5 space-y-1 flex-1 flex flex-col justify-between">
                              <div className="flex justify-between items-center">
                                <span className="font-bold text-[7px] text-gray-800">{outlet.name}</span>
                                <span className="text-[5px] font-bold text-gray-450 bg-gray-50 border px-1 rounded">{outlet.status}</span>
                              </div>
                              <span className="text-[5px] text-orange-655 font-extrabold self-end">View Menu &rarr;</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer Mockup */}
              <div 
                className="p-3 text-center transition-colors text-white mt-auto border-t"
                style={{ backgroundColor: formData.theme.footerColor || '#111827' }}
              >
                <p className="text-[5px] opacity-75 font-medium">{formData.theme.footerText}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Custom Confirmation Modal */}
      {showCleanupModal && (
        <div className="fixed inset-0 bg-black/55 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-6 shadow-2xl border border-gray-150 animate-in fade-in zoom-in duration-200 text-left">
            <div className="flex items-center gap-3 text-red-600">
              <div className="bg-red-50 p-3 rounded-full">
                <ShieldAlert className="h-6 w-6" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Database Sweep warning</h3>
            </div>
            
            <p className="text-xs text-gray-650 leading-relaxed font-medium">
              {cleanupMessage}
            </p>
            
            <div className="bg-red-50/50 border border-red-100 p-3 rounded-2xl flex items-start gap-2 text-red-800 text-[10px]">
              <span className="font-extrabold uppercase">CAUTION:</span>
              <span className="font-medium">This operation permanently deletes invalid settings configurations and purges redundant outlet parameters from Firestore collections. This action cannot be reverted.</span>
            </div>
            
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setShowCleanupModal(false)}
                className="px-4 py-2 bg-gray-150 hover:bg-gray-250 text-gray-700 rounded-xl font-bold text-xs cursor-pointer transition border-0 outline-none"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={executeCleanup}
                className="px-5 py-2 bg-red-650 hover:bg-red-755 text-white rounded-xl font-bold text-xs shadow-md shadow-red-200 cursor-pointer transition border-0 outline-none"
              >
                Confirm Sweep
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Settings;