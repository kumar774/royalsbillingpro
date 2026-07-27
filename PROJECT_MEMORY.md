# RoyalsBillingPro - Project Memory & Analysis

## Overview
**RoyalsBillingPro** is a comprehensive multi-tenant POS (Point of Sale), Restaurant Management, and Billing web application. It allows administrators to manage multiple restaurants, their menus, orders, expenses, customers (CRM), and settings. It also provides a customer-facing frontend for browsing menus and placing orders.

**Deployed URL**: [https://royalsbillingpro.vercel.app](https://vercel.com/kumars-projects-81e36b8a/royalsbillingpro) (Vercel)
**Project Root**: `c:\Users\AK\Desktop\royalsbillingpro-main\royalsbillingpro-main`

---

## Tech Stack
*   **Frontend Framework**: React 18 with Vite.
*   **Language**: TypeScript.
*   **Routing**: React Router DOM (v6) using `HashRouter` (as seen in `App.tsx`).
*   **Backend / Database / Storage**: Firebase (Firestore for database, Authentication for admin login, Storage for media). Project ID: `billing-f186b`.
*   **Styling & UI**: Tailwind CSS (implicitly), `lucide-react` & `react-icons` for iconography. `react-hot-toast` for notifications. `react-modal` for modals.
*   **State Management**: React Context API (`RestaurantContext`, `CartContext`, `ThemeContext`).
*   **PDF/Printing**: `jspdf`, `jspdf-react`, `html2canvas` for receipt generation (`ReceiptPDF.tsx`).
*   **Charts**: `recharts` for dashboard reports.
*   **Other Libraries**: `date-fns` for date formatting, `react-beautiful-dnd` for drag-and-drop (likely for menu category reordering), `qrcode.react` for QR code generation.

---

## Architecture & Directory Structure

The `src` directory structure is flattened into the root of the project folder:

### 1. `pages/` (Main Views)
*   **Admin Dashboard (`Dashboard.tsx`)**: The main wrapper for all admin-side views. Routes to specific components based on the `view` prop.
    *   `POS.tsx`: Point of Sale interface for staff to take orders manually.
    *   `MenuManager.tsx`: For adding, editing, and managing `MenuItem`s and categories.
    *   `Orders.tsx`: Order management (Pending, Preparing, Ready, Completed, Cancelled).
    *   `Expenses.tsx`: Expense tracking (`Expense` and `ExpenseItem`).
    *   `CRM.tsx`: Customer management.
    *   `Reports.tsx`: Analytics and sales reports using `recharts`.
    *   `Settings.tsx`: Restaurant-specific configurations (tax, notifications, theme).
    *   `ManageRestaurants.tsx` & `RestaurantConfig.tsx`: Multi-tenant management for admin to handle multiple restaurant profiles.
*   **Customer Facing**:
    *   `RestaurantFrontPage.tsx`: The landing page/menu view for a specific restaurant (accessed via `/restaurant/:slug`).
    *   `LandingPage.tsx`: The main landing page of the platform.
*   **Auth**:
    *   `Login.tsx`: Firebase authentication.

### 2. `components/` (Reusable UI)
*   `Header.tsx`, `Footer.tsx`: Shared layout components.
*   `CartDrawer.tsx`: Customer shopping cart slide-out.
*   `MenuItemCard.tsx`: Display card for individual food items.
*   `MenuSkeleton.tsx`: Loading state for the menu.
*   `ReceiptPDF.tsx`: Component dedicated to rendering printable receipts.
*   `RestaurantHero.tsx`: Customer-facing restaurant header.

### 3. `context/` (Global State)
*   `RestaurantContext.tsx`: Manages the currently selected restaurant data.
*   `CartContext.tsx`: Manages customer cart state (items, quantities, totals).
*   `ThemeContext.tsx`: Manages the application's theme/styling dynamically based on restaurant settings.

### 4. `firebase/`
*   `config.ts`: Firebase initialization and export of `auth`, `db`, and `storage` instances.

### 5. `services/`
*   `telegramService.ts`: Integration for sending order alerts/notifications to Telegram.
*   `evolutionService.ts`: Likely a WhatsApp or similar messaging API integration for notifications.

### 6. `layouts/`
*   `MainLayout.tsx`: Layout wrapper for the customer-facing side.
*   `AuthLayout.tsx`: Layout wrapper for authentication screens.

---

## Data Models (`types.ts`)
Key TypeScript interfaces that define the shape of the data in Firestore:

*   **`Restaurant`**: The core entity containing `id`, `name`, `slug`, `menu` (array of `MenuItem`), and `settings`.
*   **`MenuItem`**: Food item details (`id`, `name`, `price`, `categoryGroup`, `variants`, `image`).
*   **`Order`**: Represents a transaction. Contains `items` (array of `CartItem`), `total`, `status`, `orderType` (Dine-in, Takeaway, Delivery, POS), and `paymentStatus`.
*   **`Expense`**: For tracking business spending.
*   **`Settings`**: Various configuration objects (`RestaurantSettings`, `ThemeSettings`, `NotificationSettings`, `TaxSettings`).

---

## Routing (`App.tsx`)
The application uses `HashRouter` which is important for Vercel/Static deployments to handle client-side routing properly.
*   **Admin Routes**: `/dashboard/:restaurantId/*` (e.g., `/menu`, `/pos`, `/orders`).
*   **Customer Routes**: `/` (Main Landing), `/restaurant/:slug` (Specific Restaurant Menu).
*   **Auth Route**: `/login`.

## Important Notes for Future Development
1.  **Database operations**: All CRUD operations will go through Firebase Firestore. When modifying state, ensure it syncs with Firebase if persistence is required.
2.  **Multi-tenancy**: Always ensure that data queries and mutations are scoped to the correct `restaurantId`.
3.  **Deployment**: Since it's deployed on Vercel, any environment variables (like API keys) need to be configured in the Vercel dashboard. The Firebase config is currently hardcoded in `firebase/config.ts`.
4.  **Styling**: Use standard Tailwind CSS classes. If custom colors are needed, check `ThemeContext` as the app supports dynamic theming per restaurant.
