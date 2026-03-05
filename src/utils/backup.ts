import { collection, getDocs } from 'firebase/firestore';
import { db } from '../../firebase/config';

interface BackupData {
    timestamp: string;
    restaurants: Record<string, unknown>[];
    settings: Record<string, unknown>[];
    customers: Record<string, unknown>[];
    categories: Record<string, unknown>[];
}

export const generateFullBackup = async (): Promise<BackupData> => {
  const backupData: BackupData = {
    timestamp: new Date().toISOString(),
    restaurants: [],
    settings: [],
    customers: [],
    categories: []
  };

  try {
    // 1. Fetch Settings
    const settingsSnap = await getDocs(collection(db, 'settings'));
    backupData.settings = settingsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    // 2. Fetch Customers (if any)
    try {
        const customersSnap = await getDocs(collection(db, 'customers'));
        backupData.customers = customersSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        console.log("No customers collection or permission denied");
    }

    // 3. Fetch Categories (if any top-level)
    try {
        const categoriesSnap = await getDocs(collection(db, 'categories'));
        backupData.categories = categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    } catch {
        console.log("No categories collection or permission denied");
    }

    // 4. Fetch Restaurants and their subcollections
    const restaurantsSnap = await getDocs(collection(db, 'restaurants'));
    
    // Sequential fetching to avoid overwhelming the connection if many restaurants
    for (const rDoc of restaurantsSnap.docs) {
      const rData = rDoc.data();
      const restaurantId = rDoc.id;
      
      const restaurantObj: Record<string, unknown> = {
        id: restaurantId,
        ...rData,
        subcollections: {}
      };

      const subcollections: Record<string, unknown[]> = {};

      // Fetch Menu
      const menuSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'menu'));
      subcollections.menu = menuSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch Orders
      const ordersSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'orders'));
      subcollections.orders = ordersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      // Fetch Config
      const configSnap = await getDocs(collection(db, 'restaurants', restaurantId, 'config'));
      subcollections.config = configSnap.docs.map(d => ({ id: d.id, ...d.data() }));

      restaurantObj.subcollections = subcollections;
      backupData.restaurants.push(restaurantObj);
    }

    return backupData;

  } catch (error) {
    console.error("Backup failed:", error);
    throw error;
  }
};

export const downloadBackup = (data: BackupData) => {
  const json = JSON.stringify(data, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  // Format: royals_billing_backup_DD_MM_YYYY.json
  const now = new Date();
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  
  a.download = `royals_billing_backup_${day}_${month}_${year}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};
