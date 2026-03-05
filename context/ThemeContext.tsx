import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import { ThemeSettings } from '../types';

interface ThemeContextType {
  theme: ThemeSettings;
  updateTheme: (settings: ThemeSettings) => void;
  resetTheme: () => void;
}

const defaultTheme: ThemeSettings = {
  headerColor: '#ffffff', // white
  footerColor: '#111827', // gray-900
  headerText: 'CraveWave',
  footerText: '© 2024 CraveWave Technologies Inc.',
  logoUrl: '',
  primaryColor: '#ea580c',
  primaryTextColor: '#111827',
  heroBgColor: '#f9fafb',
  landingHeroTitle: 'Professional Billing & Management Software',
  landingHeroSub: 'The all-in-one solution for modern restaurants to manage orders, inventory, and growth.',
  aboutTitle: 'Designed for Modern Hospitality',
  aboutText: '',
  features: [
    { title: 'Fast & Reliable', description: 'Experience lightning fast performance and 99.9% uptime for your business operations.' },
    { title: 'Secure Payments', description: 'Industry-standard encryption and secure payment gateways to protect your transactions.' },
    { title: '24/7 Support', description: 'Our dedicated support team is always available to help you with any queries or issues.' }
  ],
  socialLinks: {
    instagram: '',
    facebook: '',
    twitter: '',
    linkedin: '',
  }
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<ThemeSettings>(defaultTheme);

  const updateTheme = useCallback((settings: ThemeSettings) => {
    setTheme(() => ({ ...defaultTheme, ...settings }));
  }, []);

  const resetTheme = useCallback(() => {
    setTheme(defaultTheme);
  }, []);

  const value = React.useMemo(() => ({ 
    theme, 
    updateTheme, 
    resetTheme 
  }), [theme, updateTheme, resetTheme]);

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
};
