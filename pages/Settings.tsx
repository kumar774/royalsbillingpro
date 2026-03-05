import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ThemeSettings, SocialLinks } from '../types';
import { Save, Loader2, Layout, Share2, Globe, Trash2, Database, Download } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { cleanupDeprecatedSettings, getUnusedSettingsCount, cleanupRestaurantFields } from '../src/utils/dbCleanup';
import { generateFullBackup, downloadBackup } from '../src/utils/backup';

const Settings: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [cleaning, setCleaning] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  
  const [formData, setFormData] = useState({
    // Global Theme Settings
    theme: {
      headerColor: '#ffffff',
      headerText: 'CraveWave',
      logoUrl: '',
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
      // Global Footer Settings
      footerColor: '#111827',
      footerText: '© 2024 CraveWave Technologies Inc.',
    } as ThemeSettings,
    homeViewMode: 'Landing Page', // Default to Landing Page for root
    socialMedia: {
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

  const handleCleanup = async () => {
    setCleaning(true);
    const toastId = toast.loading("Scanning for unused settings...");
    try {
        const unusedSettingsCount = await getUnusedSettingsCount();
        
        const confirmMsg = unusedSettingsCount > 0 
            ? `Found ${unusedSettingsCount} unused settings documents. Delete them and clean up restaurant fields?`
            : `No unused settings found. Clean up redundant restaurant fields?`;

        if (window.confirm(confirmMsg)) {
            toast.loading("Cleaning up...", { id: toastId });
            
            let deletedSettings: string[] = [];
            if (unusedSettingsCount > 0) {
                deletedSettings = await cleanupDeprecatedSettings();
            }
            
            const cleanedRestaurants = await cleanupRestaurantFields();
            
            toast.success(`Cleanup complete. Deleted ${deletedSettings.length} settings docs. Cleaned ${cleanedRestaurants} restaurants.`, { id: toastId });
        } else {
            toast.dismiss(toastId);
        }
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
    <div className="max-w-4xl mx-auto pb-10">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Global Landing Page CMS</h2>
        <p className="text-gray-500 text-sm">Manage the content and appearance of the main landing page (root URL).</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="border-b border-gray-200 px-6 py-4 bg-gray-50 flex items-center">
            <Globe className="h-5 w-5 text-gray-500 mr-2" />
            <h3 className="font-medium text-gray-900">Global Configuration</h3>
        </div>

        <form onSubmit={handleSave} className="p-6 space-y-8">
            
            {/* Header & Hero Section */}
            <div className="space-y-6">
                <h4 className="font-bold text-gray-900 flex items-center border-b pb-2">
                    <Layout className="h-4 w-4 mr-2 text-gray-500" /> Header & Hero Section
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Header Brand Name</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.theme.headerText}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, headerText: e.target.value}})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Home View Mode</label>
                        <select 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.homeViewMode}
                            onChange={(e) => setFormData({...formData, homeViewMode: e.target.value as 'Landing Page' | 'Default List'})}
                        >
                            <option value="Landing Page">Landing Page</option>
                            <option value="Default List">Default List (Restaurant Grid)</option>
                        </select>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Landing Hero Title</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.theme.landingHeroTitle}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, landingHeroTitle: e.target.value}})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Landing Hero Subtitle</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.theme.landingHeroSub}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, landingHeroSub: e.target.value}})}
                        />
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hero Background Color</label>
                        <div className="flex gap-2 items-center">
                            <input 
                                type="color" 
                                className="h-10 w-16 p-0 border border-gray-300 rounded cursor-pointer"
                                value={formData.theme.heroBgColor}
                                onChange={(e) => setFormData({...formData, theme: {...formData.theme, heroBgColor: e.target.value}})}
                            />
                            <input 
                                type="text" 
                                className="flex-1 rounded-lg border-gray-300 border px-3 py-2 text-sm uppercase"
                                value={formData.theme.heroBgColor}
                                onChange={(e) => setFormData({...formData, theme: {...formData.theme, heroBgColor: e.target.value}})}
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Hero Image URL</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.theme.heroImage}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, heroImage: e.target.value}})}
                            placeholder="https://images.unsplash.com/..."
                        />
                    </div>
                </div>
            </div>

            {/* About & Features */}
            <div className="space-y-6">
                <h4 className="font-bold text-gray-900 flex items-center border-b pb-2">
                    <Layout className="h-4 w-4 mr-2 text-gray-500" /> About & Features
                </h4>
                
                <div className="grid grid-cols-1 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">About Section Title</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.theme.aboutTitle}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, aboutTitle: e.target.value}})}
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">About Section Text</label>
                        <textarea 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.theme.aboutText}
                            onChange={(e) => setFormData({...formData, theme: {...formData.theme, aboutText: e.target.value}})}
                            rows={3}
                        />
                    </div>
                </div>

                <div className="space-y-4 bg-gray-50 p-4 rounded-lg">
                    <h5 className="text-sm font-bold text-gray-800">Features Grid (3 Cards)</h5>
                    {[0, 1, 2].map((index) => (
                        <div key={index} className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs font-medium text-gray-500 mb-1">Feature {index + 1} Title</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm"
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
                                <label className="block text-xs font-medium text-gray-500 mb-1">Feature {index + 1} Description</label>
                                <input 
                                    type="text" 
                                    className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm"
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

            {/* Footer & Social */}
            <div className="space-y-6">
                <h4 className="font-bold text-gray-900 flex items-center border-b pb-2">
                    <Share2 className="h-4 w-4 mr-2 text-gray-500" /> Footer & Social Media
                </h4>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
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
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Instagram</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.socialLinks.instagram}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, instagram: e.target.value}})}
                            placeholder="https://instagram.com/..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Facebook</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.socialLinks.facebook}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, facebook: e.target.value}})}
                            placeholder="https://facebook.com/..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Twitter</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.socialLinks.twitter}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, twitter: e.target.value}})}
                            placeholder="https://twitter.com/..."
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">LinkedIn</label>
                        <input 
                            type="text" 
                            className="w-full rounded-lg border-gray-300 border px-3 py-2 text-sm focus:ring-orange-500 focus:border-orange-500"
                            value={formData.socialLinks.linkedin}
                            onChange={(e) => setFormData({...formData, socialLinks: {...formData.socialLinks, linkedin: e.target.value}})}
                            placeholder="https://linkedin.com/..."
                        />
                    </div>
                </div>
            </div>

            <div className="pt-6 border-t border-gray-200 flex justify-end">
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
                            <Save className="mr-2 h-5 w-5" /> Save Global Settings
                        </>
                    )}
                </button>
            </div>
        </form>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-8">
        {/* Maintenance Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 bg-red-50 flex items-center">
                <Trash2 className="h-5 w-5 text-red-500 mr-2" />
                <h3 className="font-medium text-red-900">Maintenance Zone</h3>
            </div>
            <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                    Remove old, unused settings from the database to keep it clean. This will delete any documents in the &apos;settings&apos; collection that are not &apos;landingPage&apos; and do not belong to an active restaurant.
                </p>
                <button
                    type="button"
                    onClick={handleCleanup}
                    disabled={cleaning}
                    className="w-full flex justify-center items-center bg-red-600 hover:bg-red-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-sm disabled:opacity-70"
                >
                    {cleaning ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Trash2 className="h-4 w-4 mr-2" />}
                    Scan & Cleanup Unused Settings
                </button>
            </div>
        </div>

        {/* Backup Zone */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="border-b border-gray-200 px-6 py-4 bg-blue-50 flex items-center">
                <Database className="h-5 w-5 text-blue-500 mr-2" />
                <h3 className="font-medium text-blue-900">Database Backup</h3>
            </div>
            <div className="p-6">
                <p className="text-sm text-gray-600 mb-4">
                    Generate a complete backup of all restaurants, menus, orders, and settings. This will download a JSON file to your device.
                </p>
                <button
                    type="button"
                    onClick={handleBackup}
                    disabled={backingUp}
                    className="w-full flex justify-center items-center bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded-lg transition shadow-sm disabled:opacity-70"
                >
                    {backingUp ? <Loader2 className="animate-spin h-4 w-4 mr-2" /> : <Download className="h-4 w-4 mr-2" />}
                    Generate Full Backup (JSON)
                </button>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Settings;