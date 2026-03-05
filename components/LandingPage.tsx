import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useRestaurants } from '../context/RestaurantContext';
import { ArrowRight, CheckCircle2, Star, Zap, Shield, Loader2 } from 'lucide-react';
import { doc, onSnapshot } from 'firebase/firestore';
import { db } from '../firebase/config';
import { useTheme } from '../context/ThemeContext';
import { ThemeSettings } from '../types';

const LandingPage: React.FC = () => {
    const { restaurants } = useRestaurants();
    const { updateTheme } = useTheme();
    const [settings, setSettings] = useState<ThemeSettings | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const docRef = doc(db, 'settings', 'landingPage');
        const unsubscribe = onSnapshot(docRef, (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data();
                const themeData = data.theme as ThemeSettings;
                const fullSettings = {
                    ...themeData,
                    socialLinks: data.socialLinks
                };
                setSettings(fullSettings);
                updateTheme(fullSettings);
            }
            setLoading(false);
        }, (error) => {
            console.error("Error fetching landing page settings:", error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [updateTheme]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-orange-600" /></div>;
    }

    const features = settings?.features || [
        { title: 'Fast & Reliable', description: 'Experience lightning fast performance and 99.9% uptime for your business operations.' },
        { title: 'Secure Payments', description: 'Industry-standard encryption and secure payment gateways to protect your transactions.' },
        { title: '24/7 Support', description: 'Our dedicated support team is always available to help you with any queries or issues.' }
    ];

    const iconMap = [Zap, Shield, Star, CheckCircle2];

    return (
        <div className="min-h-screen" style={{ color: settings?.primaryTextColor || '#111827' }}>
            {/* Hero Section */}
            <section 
                className="relative pt-20 pb-32 overflow-hidden"
                style={{ backgroundColor: settings?.heroBgColor || '#f9fafb' }}
            >
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
                    <div className="text-center max-w-4xl mx-auto">
                        <h1 
                            className="text-5xl md:text-7xl font-extrabold tracking-tight leading-tight mb-6 animate-fade-in"
                            style={{ color: settings?.primaryTextColor || '#111827' }}
                        >
                            {settings?.landingHeroTitle || 'Professional Billing & Management Software'}
                        </h1>
                        <p className="text-xl md:text-2xl text-gray-600 mb-10 leading-relaxed">
                            {settings?.landingHeroSub || 'The all-in-one solution for modern restaurants to manage orders, inventory, and growth.'}
                        </p>
                        <div className="flex flex-col sm:flex-row justify-center gap-4">
                            <Link 
                                to={restaurants.length > 0 ? `/restaurant/${restaurants[0].slug}` : '/'}
                                className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-xl text-white transition-all transform hover:scale-105 shadow-xl"
                                style={{ backgroundColor: settings?.primaryColor || '#ea580c' }}
                            >
                                Get Started Now <ArrowRight className="ml-2 h-5 w-5" />
                            </Link>
                            <button className="inline-flex items-center justify-center px-8 py-4 text-lg font-bold rounded-xl bg-white text-gray-900 border-2 border-gray-200 hover:bg-gray-50 transition-all shadow-sm">
                                Watch Demo
                            </button>
                        </div>
                    </div>
                </div>
                
                {/* Decorative elements */}
                <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none opacity-20">
                    <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full blur-3xl" style={{ backgroundColor: settings?.primaryColor || '#ea580c' }}></div>
                    <div className="absolute -bottom-24 -right-24 w-96 h-96 rounded-full blur-3xl opacity-50" style={{ backgroundColor: settings?.primaryColor || '#ea580c' }}></div>
                </div>
            </section>

            {/* About Section */}
            <section className="py-24 bg-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-16 items-center">
                        <div>
                            <h2 className="text-4xl font-bold mb-6" style={{ color: settings?.primaryTextColor || '#111827' }}>
                                {settings?.aboutTitle || 'Designed for Modern Hospitality'}
                            </h2>
                            <div className="space-y-4 text-lg text-gray-600 leading-relaxed">
                                {settings?.aboutText ? (
                                    <p>{settings.aboutText}</p>
                                ) : (
                                    <>
                                        <p>
                                            Our platform was built from the ground up to solve the unique challenges faced by restaurant owners today. From seamless POS integration to real-time inventory tracking, we provide the tools you need to succeed.
                                        </p>
                                        <p>
                                            We believe that technology should empower your staff, not complicate their work. That&apos;s why our interface is intuitive, fast, and accessible from any device.
                                        </p>
                                    </>
                                )}
                            </div>
                            <div className="mt-8 flex flex-wrap gap-4">
                                {['Cloud Based', 'Real-time Sync', 'Multi-device'].map((tag) => (
                                    <span key={tag} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-full text-sm font-semibold">
                                        {tag}
                                    </span>
                                ))}
                            </div>
                        </div>
                        <div className="relative">
                            <div className="aspect-video rounded-3xl overflow-hidden shadow-2xl border-8 border-gray-50">
                                <img 
                                    src={settings?.heroImage || "https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?auto=format&fit=crop&q=80&w=1000"} 
                                    alt="Software Interface" 
                                    className="w-full h-full object-cover"
                                />
                            </div>
                            <div className="absolute -bottom-6 -left-6 bg-white p-6 rounded-2xl shadow-xl border border-gray-100 hidden md:block">
                                <div className="flex items-center gap-4">
                                    <div className="p-3 rounded-full bg-green-100 text-green-600">
                                        <Star className="h-6 w-6 fill-current" />
                                    </div>
                                    <div>
                                        <p className="text-2xl font-bold text-gray-900">4.9/5</p>
                                        <p className="text-sm text-gray-500">Customer Rating</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-gray-50">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div className="text-center mb-16">
                        <h2 className="text-4xl font-bold mb-4" style={{ color: settings?.primaryTextColor || '#111827' }}>
                            Powerful Features for Your Success
                        </h2>
                        <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                            Everything you need to run your restaurant efficiently and grow your revenue.
                        </p>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                        {features.map((feature, index) => {
                            const Icon = iconMap[index % iconMap.length];
                            return (
                                <div 
                                    key={index} 
                                    className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 hover:shadow-md transition-shadow group"
                                >
                                    <div 
                                        className="w-14 h-14 rounded-2xl flex items-center justify-center mb-6 transition-transform group-hover:scale-110"
                                        style={{ backgroundColor: `${settings?.primaryColor || '#ea580c'}15`, color: settings?.primaryColor || '#ea580c' }}
                                    >
                                        <Icon className="h-7 w-7" />
                                    </div>
                                    <h3 className="text-xl font-bold mb-3" style={{ color: settings?.primaryTextColor || '#111827' }}>
                                        {feature.title}
                                    </h3>
                                    <p className="text-gray-600 leading-relaxed">
                                        {feature.description}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24">
                <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
                    <div 
                        className="rounded-[3rem] p-12 md:p-20 text-center text-white relative overflow-hidden shadow-2xl"
                        style={{ backgroundColor: settings?.primaryColor || '#ea580c' }}
                    >
                        <div className="relative z-10">
                            <h2 className="text-4xl md:text-5xl font-bold mb-6">Ready to transform your restaurant?</h2>
                            <p className="text-xl opacity-90 mb-10 max-w-2xl mx-auto">
                                Join thousands of successful restaurant owners who trust our platform for their daily operations.
                            </p>
                            <Link 
                                to="/login"
                                className="inline-flex items-center justify-center px-10 py-4 text-lg font-bold rounded-xl bg-white text-gray-900 hover:bg-gray-50 transition-all shadow-lg"
                            >
                                Start Free Trial
                            </Link>
                        </div>
                        {/* Decorative circles */}
                        <div className="absolute top-0 right-0 -mr-20 -mt-20 w-64 h-64 rounded-full bg-white opacity-10"></div>
                        <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-64 h-64 rounded-full bg-white opacity-10"></div>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default LandingPage;
