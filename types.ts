export type CategoryType = string;

export interface Variant {
  size: string;
  price: number;
}

export interface MenuItem {
  id: string;
  name: string;
  description: string;
  price: number;
  image: string;
  categoryGroup: string;
  customCategory?: string;
  variants?: Variant[]; // Optional field for items with multiple sizes/prices
  isBestseller?: boolean;
  rating?: number;
  votes?: number;
  available?: boolean;
}

export interface Feature {
  title: string;
  description: string;
  icon?: string;
}

export interface ThemeSettings {
  headerColor?: string;
  footerColor?: string;
  headerText?: string;
  footerText?: string;
  logoUrl?: string;
  // CMS Fields for Landing Page
  heroImage?: string; 
  aboutTitle?: string;
  aboutText?: string; 
  primaryColor?: string;
  primaryTextColor?: string;
  heroBgColor?: string;
  landingHeroTitle?: string;
  landingHeroSub?: string;
  features?: Feature[];
  socialLinks?: SocialLinks;
}

export interface NotificationSettings {
  telegramEnabled: boolean;
  telegramToken: string;
  telegramChatId: string;
  customerOrderAlert: boolean;
  adminOrderAlert: boolean;
  orderStatusUpdate: boolean;
  paymentStatusUpdate: boolean;
}

export interface RestaurantSettings {
  openingHours?: string;
  deliveryTime?: string;
  defaultDeliveryCharge?: number;
  whatsappNumber?: string;
  upiId?: string;
  paymentQrLink?: string;
  orderIdPrefix?: string;
  nextOrderNumber?: number;
  receiptFooter?: string;
  selectedPrinterSize?: string;
  printerSizes?: string[];
  theme?: ThemeSettings;
  taxSettings?: TaxSettings;
  socialLinks?: SocialLinks;
  notificationSettings?: NotificationSettings;
  landingPageSettings?: LandingPageSettings;
  billingConfig?: {
    currency?: string;
    symbol?: string;
  };
}

export interface TaxSettings {
  gstPercentage: number;
  serviceChargePercentage: number;
  applyTax: boolean;
}

export interface SocialLinks {
  instagram?: string;
  facebook?: string;
  twitter?: string;
  linkedin?: string;
}

export interface LandingPageSettings {
  homeViewMode: 'Landing Page' | 'Default List';
  header: {
    logoUrl: string;
    navLinks: { label: string; url: string }[];
    backgroundColor: string;
  };
  footer: {
    aboutText: string;
    socialLinks: SocialLinks;
    backgroundColor: string;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
  };
  hero: {
    title: string;
    subtitle: string;
    backgroundImage: string;
    backgroundColor: string;
  };
  features: Feature[];
}

export interface RestaurantPageSettings {
  header: {
    bannerImage: string;
    address: string;
    phone: string;
  };
  footer: {
    text: string;
  };
  theme: {
    primaryColor: string;
    secondaryColor: string;
  };
  socialMedia: {
    whatsapp: string;
    instagram: string;
  };
}

export interface Restaurant {
  id: string;
  name: string;
  slug: string;
  cuisine: string[];
  bannerImage: string;
  logo: string;
  location: string;
  menu: MenuItem[];
  isActive?: boolean;
  categoryOrder?: string[];
}

export interface CartItem extends MenuItem {
  quantity: number;
  selectedVariant?: Variant;
}

export interface CartState {
  items: CartItem[];
  total: number;
}

export type OrderStatus = 'Pending' | 'Preparing' | 'Ready' | 'Completed' | 'Cancelled';
export type OrderType = 'Dine-in' | 'Takeaway' | 'Delivery' | 'Online' | 'POS';
export type PaymentStatus = 'Pending' | 'Paid';
export type PaymentMethod = 'Cash' | 'Online' | 'Card';

export interface Order {
  id: string;
  formattedId?: string;
  restaurantId: string;
  items: CartItem[];
  total: number;
  subtotal?: number;
  discount?: number;
  deliveryCharge?: number;
  status: OrderStatus;
  orderType: OrderType;
  source?: 'Reception' | 'Online';
  orderSource?: string;
  customerName?: string;
  customerPhone?: string;
  tableNo?: string;
  createdAt: string; 
  // Payment Tracking
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethod;
  taxDetails?: { [key: string]: number };
}

export interface LastOrderDetails {
  id: string;
  formattedId?: string;
  total: number;
  subtotal: number;
  items: CartItem[];
  date: string;
  orderType: string;
  deliveryFee: number;
  taxDetails: {
      gstAmount: number;
      serviceAmount: number;
      gstRate: number;
      serviceRate: number;
  };
  upiUrl?: string;
  paymentMethod?: PaymentMethod;
  paymentStatus?: string;
  customerName?: string;
  customerPhone?: string;
  discount?: number;
  deliveryCharge?: number;
  restaurantIds?: string[];
  paymentQrLink?: string; // New field for the payment QR link
  restaurantId?: string;
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: string;
  date: string;
  note?: string;
}