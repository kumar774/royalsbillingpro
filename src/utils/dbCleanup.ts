import { collection, getDocs, deleteDoc, doc, updateDoc, deleteField } from 'firebase/firestore';
import { db } from '../../firebase/config';

export const getUnusedSettingsCount = async (): Promise<number> => {
  try {
    const settingsRef = collection(db, 'settings');
    const restaurantsRef = collection(db, 'restaurants');

    const [settingsSnap, restaurantsSnap] = await Promise.all([
      getDocs(settingsRef),
      getDocs(restaurantsRef)
    ]);

    const activeRestaurantIds = new Set(restaurantsSnap.docs.map(d => d.id));
    
    let count = 0;
    settingsSnap.docs.forEach(doc => {
      if (doc.id === 'landingPage') return;
      
      const data = doc.data();
      const matchesId = activeRestaurantIds.has(doc.id);
      const matchesField = data.restaurantId && activeRestaurantIds.has(data.restaurantId);

      if (!matchesId && !matchesField) {
        count++;
      }
    });

    return count;
  } catch (error) {
    console.error("Error counting unused settings:", error);
    return 0;
  }
};

export const cleanupDeprecatedSettings = async (): Promise<string[]> => {
  const deletedIds: string[] = [];
  try {
    const settingsRef = collection(db, 'settings');
    const restaurantsRef = collection(db, 'restaurants');

    const [settingsSnap, restaurantsSnap] = await Promise.all([
      getDocs(settingsRef),
      getDocs(restaurantsRef)
    ]);

    const activeRestaurantIds = new Set(restaurantsSnap.docs.map(d => d.id));
    
    for (const document of settingsSnap.docs) {
      if (document.id === 'landingPage') continue;

      const data = document.data();
      const matchesId = activeRestaurantIds.has(document.id);
      const matchesField = data.restaurantId && activeRestaurantIds.has(data.restaurantId);

      if (!matchesId && !matchesField) {
        await deleteDoc(doc(db, 'settings', document.id));
        deletedIds.push(document.id);
      }
    }

    return deletedIds;
  } catch (error) {
    console.error("Error cleaning up settings:", error);
    throw error;
  }
};

export const cleanupRestaurantFields = async (): Promise<number> => {
  try {
    const restaurantsRef = collection(db, 'restaurants');
    const snapshot = await getDocs(restaurantsRef);
    let count = 0;

    for (const docSnap of snapshot.docs) {
      const data = docSnap.data();
      const updates: Record<string, unknown> = {};
      
      if (data.deliveryTime !== undefined) updates.deliveryTime = deleteField();
      if (data.whatsappNumber !== undefined) updates.whatsappNumber = deleteField();
      if (data.socialMedia !== undefined) updates.socialMedia = deleteField();
      if (data.contact !== undefined) updates.contact = deleteField();
      if (data.nextOrderNumber !== undefined) updates.nextOrderNumber = deleteField();
      if (data.orderIdPrefix !== undefined) updates.orderIdPrefix = deleteField();
      if (data.upiId !== undefined) updates.upiId = deleteField();
      if (data.taxSettings !== undefined) updates.taxSettings = deleteField();
      if (data.homeViewMode !== undefined) updates.homeViewMode = deleteField();

      if (Object.keys(updates).length > 0) {
        await updateDoc(doc(db, 'restaurants', docSnap.id), updates);
        count++;
      }
    }
    return count;
  } catch (error) {
    console.error("Error cleaning up restaurant fields:", error);
    throw error;
  }
};
