import React, { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, updateDoc, arrayUnion } from 'firebase/firestore';
import { db } from '../firebase/config';
import { ManagedApp } from '../types';
import { Lock, AlertTriangle, RefreshCw, ExternalLink, Download, Wrench, ShieldAlert } from 'lucide-react';

interface AppLicenseGuardProps {
  children: React.ReactNode;
}

export const AppLicenseGuard: React.FC<AppLicenseGuardProps> = ({ children }) => {
  const [appId, setAppId] = useState<string | null>(null);
  const [appConfig, setAppConfig] = useState<ManagedApp | null>(null);
  const [loading, setLoading] = useState(true);
  const [deviceBlocked, setDeviceBlocked] = useState(false);

  // Helper to ensure WhatsApp links trigger direct native app intent instead of loading web page
  const formatDirectActionUrl = (url?: string | null): string => {
    if (!url) return '';
    const trimmed = url.trim();

    if (trimmed.startsWith('whatsapp://') || trimmed.startsWith('intent:') || trimmed.startsWith('tel:') || trimmed.startsWith('mailto:')) {
      return trimmed;
    }

    if (trimmed.includes('wa.me') || trimmed.includes('api.whatsapp.com')) {
      try {
        const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
        let phone = '';
        let text = '';

        if (parsed.hostname.includes('wa.me')) {
          phone = parsed.pathname.replace(/^\/+/, '').replace(/\D/g, '');
          text = parsed.searchParams.get('text') || '';
        } else if (parsed.hostname.includes('whatsapp.com')) {
          phone = (parsed.searchParams.get('phone') || '').replace(/\D/g, '');
          text = parsed.searchParams.get('text') || '';
        }

        if (phone) {
          return `whatsapp://send?phone=${phone}${text ? `&text=${encodeURIComponent(text)}` : ''}`;
        }
      } catch {
        const phoneMatch = trimmed.match(/(?:wa\.me\/|phone=)(\d+)/);
        const textMatch = trimmed.match(/[?&]text=([^&]+)/);
        if (phoneMatch && phoneMatch[1]) {
          const phone = phoneMatch[1];
          const text = textMatch ? textMatch[1] : '';
          return `whatsapp://send?phone=${phone}${text ? `&text=${text}` : ''}`;
        }
      }
    }

    return trimmed;
  };

  // Helper to extract query parameter from either window.location.search or window.location.hash
  const getQueryParam = (param: string): string | null => {
    const searchParams = new URLSearchParams(window.location.search);
    if (searchParams.get(param)) return searchParams.get(param);
    const hash = window.location.hash;
    if (hash.includes('?')) {
      const hashParams = new URLSearchParams(hash.substring(hash.indexOf('?')));
      if (hashParams.get(param)) return hashParams.get(param);
    }
    return null;
  };

  const clientVersion = getQueryParam('appVersion') || '1.0.0';

  useEffect(() => {
    // Check if an appId is passed via URL query or stored in localStorage
    const detectedAppId = getQueryParam('appId') || localStorage.getItem('active_client_app_id');
    if (detectedAppId) {
      setAppId(detectedAppId.toUpperCase());
      localStorage.setItem('active_client_app_id', detectedAppId.toUpperCase());
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!appId) return;

    const q = query(collection(db, 'master_apps'), where('appId', '==', appId));
    const unsub = onSnapshot(q, async (snapshot) => {
      if (snapshot.empty) {
        setAppConfig(null);
        setLoading(false);
        return;
      }

      const appDoc = snapshot.docs[0];
      const data = { id: appDoc.id, ...appDoc.data() } as ManagedApp;
      setAppConfig(data);

      // Handle Device Registration & Binding
      try {
        let deviceId = localStorage.getItem('app_device_uuid');
        if (!deviceId) {
          deviceId = 'DEV_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
          localStorage.setItem('app_device_uuid', deviceId);
        }

        const registered = data.registeredDevices || [];
        const maxLimit = data.maxAllowedDevices || 1;

        if (!registered.includes(deviceId)) {
          if (registered.length < maxLimit) {
            // Register this new device
            await updateDoc(doc(db, 'master_apps', appDoc.id), {
              registeredDevices: arrayUnion(deviceId)
            });
            setDeviceBlocked(false);
          } else {
            // Exceeded max device limit
            setDeviceBlocked(true);
          }
        } else {
          setDeviceBlocked(false);
        }
      } catch (e) {
        console.error('Device verification error:', e);
      }

      setLoading(false);
    }, (err) => {
      console.error('License verification error:', err);
      setLoading(false);
    });

    return () => unsub();
  }, [appId]);

  // If no appId is associated with this session, let user browse normally (Admin / Customer web mode)
  if (!appId) {
    return <>{children}</>;
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center justify-center space-y-3">
        <RefreshCw className="h-8 w-8 animate-spin text-orange-500" />
        <p className="text-xs font-semibold tracking-wider text-gray-400">Verifying App License...</p>
      </div>
    );
  }

  // App Not Found
  if (!appConfig) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
            <ShieldAlert className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Unregistered App License</h2>
          <p className="text-xs text-gray-400">
            No active configuration found for License ID: <span className="font-mono text-orange-400 font-bold">{appId}</span>.
          </p>
        </div>
      </div>
    );
  }

  // 1. Maintenance Mode
  if (appConfig.maintenanceMode) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-gray-900 border border-gray-800 p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-amber-500/10 text-amber-500 rounded-2xl flex items-center justify-center mx-auto">
            <Wrench className="h-8 w-8 animate-pulse" />
          </div>
          <h2 className="text-xl font-bold">Under Maintenance</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            {appConfig.maintenanceMessage || 'System maintenance in progress. Please check back shortly.'}
          </p>
        </div>
      </div>
    );
  }

  // 2. Force App Update (Version Check)
  if (appConfig.minRequiredVersion && appConfig.updateUrl) {
    const isOutdated = compareVersions(clientVersion, appConfig.minRequiredVersion) < 0;
    if (isOutdated) {
      return (
        <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
          <div className="max-w-md bg-gray-900 border border-blue-900/50 p-8 rounded-3xl shadow-2xl space-y-5">
            <div className="w-16 h-16 bg-blue-500/10 text-blue-400 rounded-2xl flex items-center justify-center mx-auto">
              <Download className="h-8 w-8 animate-bounce" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Update Required</h2>
              <p className="text-xs text-gray-400 mt-2 leading-relaxed">
                {appConfig.forceUpdateMessage || 'A new update is available. You must install the latest version to continue.'}
              </p>
            </div>
            <a
              href={appConfig.updateUrl}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center justify-center w-full px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-2xl shadow-lg transition"
            >
              <Download className="h-4 w-4 mr-2" /> Download Update Now
            </a>
          </div>
        </div>
      );
    }
  }

  // 3. Device Limit Exceeded
  if (deviceBlocked) {
    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-gray-900 border border-red-900/50 p-8 rounded-3xl shadow-2xl space-y-4">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8" />
          </div>
          <h2 className="text-xl font-bold">Device Limit Exceeded</h2>
          <p className="text-xs text-gray-400 leading-relaxed">
            This app license is restricted to a maximum of {appConfig.maxAllowedDevices} device(s). 
            Please contact the administrator to reset your registered devices.
          </p>
          {appConfig.redirectUrl && (
            <a
              href={formatDirectActionUrl(appConfig.redirectUrl)}
              className="inline-flex items-center justify-center w-full px-5 py-3 bg-[#FF5722] text-white font-bold rounded-xl text-xs shadow-md transition"
            >
              Contact Admin <ExternalLink className="h-3.5 w-3.5 ml-1.5" />
            </a>
          )}
        </div>
      </div>
    );
  }

  // 4. Expiry & Kill-Switch Enforcement
  const isSuspended = appConfig.status === 'suspended';
  const isExpiredByDate = !appConfig.isLifetime && appConfig.expiryDate && (new Date() > new Date(appConfig.expiryDate));

  if (isSuspended || isExpiredByDate) {
    // If redirect URL is provided, redirect automatically after 2 seconds
    if (appConfig.redirectUrl) {
      setTimeout(() => {
        window.location.href = formatDirectActionUrl(appConfig.redirectUrl!);
      }, 2000);
    }

    return (
      <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center p-6 text-center">
        <div className="max-w-md bg-gray-900 border border-red-900/40 p-8 rounded-3xl shadow-2xl space-y-5 animate-fade-in">
          <div className="w-16 h-16 bg-red-500/10 text-red-500 rounded-2xl flex items-center justify-center mx-auto">
            <Lock className="h-8 w-8 animate-pulse" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-white">Subscription Expired</h2>
            <p className="text-xs text-gray-400 mt-2 leading-relaxed">
              {appConfig.lockMessage || 'Your app license has expired. Please contact support to renew your subscription.'}
            </p>
          </div>

          {appConfig.redirectUrl && (
            <a
              href={formatDirectActionUrl(appConfig.redirectUrl)}
              className="inline-flex items-center justify-center w-full px-6 py-3.5 bg-[#FF5722] hover:bg-[#F4511E] text-white font-bold rounded-2xl shadow-xl transition active:scale-95 text-sm"
            >
              <span>Renew Subscription Now</span>
              <ExternalLink className="h-4 w-4 ml-2" />
            </a>
          )}

          <p className="text-[10px] text-gray-500 font-mono">
            License ID: {appConfig.appId} • Status: {isSuspended ? 'SUSPENDED' : 'EXPIRED'}
          </p>
        </div>
      </div>
    );
  }

  // 5. Active - Calculate Pre-Expiry Warning
  let warningBanner = null;
  if (!appConfig.isLifetime && appConfig.expiryDate) {
    const diffDays = Math.ceil((new Date(appConfig.expiryDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
    const threshold = appConfig.warningDaysBeforeExpiry || 3;

    if (diffDays > 0 && diffDays <= threshold) {
      warningBanner = (
        <div className="bg-gradient-to-r from-amber-600 to-orange-600 text-white px-4 py-2 text-xs font-bold flex items-center justify-between shadow-md z-[9999] shrink-0">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-4 w-4 text-amber-200" />
            <span>{appConfig.warningNoticeText || `Subscription expiring in ${diffDays} day(s)!`}</span>
          </div>
          {appConfig.redirectUrl && (
            <a
              href={formatDirectActionUrl(appConfig.redirectUrl)}
              className="underline text-white hover:text-amber-100 flex items-center text-[11px]"
            >
              Renew <ExternalLink className="h-3 w-3 ml-1" />
            </a>
          )}
        </div>
      );
    }
  }

  // 6. Announcement Banner
  let announcementBanner = null;
  if (appConfig.showAnnouncement && appConfig.announcementNotice) {
    announcementBanner = (
      <div className="bg-blue-600 text-white px-4 py-2 text-xs font-semibold flex items-center justify-center space-x-2 shadow-sm z-[9998] shrink-0">
        <span>📢 {appConfig.announcementNotice}</span>
      </div>
    );
  }

  return (
    <>
      {warningBanner}
      {announcementBanner}
      {children}
    </>
  );
};

// Version compare helper (e.g. "1.0.0" vs "1.1.0")
function compareVersions(v1: string, v2: string): number {
  const p1 = v1.split('.').map(Number);
  const p2 = v2.split('.').map(Number);
  for (let i = 0; i < Math.max(p1.length, p2.length); i++) {
    const num1 = p1[i] || 0;
    const num2 = p2[i] || 0;
    if (num1 > num2) return 1;
    if (num1 < num2) return -1;
  }
  return 0;
}

export default AppLicenseGuard;
