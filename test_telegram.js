import { initializeApp } from "firebase/app";
import { getFirestore, collection, getDocs } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDt8jX6BVWa2cdY66zYBlSXP_3LiV8l3QQ",
  authDomain: "billing-f186b.firebaseapp.com",
  projectId: "billing-f186b",
  storageBucket: "billing-f186b.firebasestorage.app",
  messagingSenderId: "487097927220",
  appId: "1:487097927220:web:00d8dc675cc779c7f16c61"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const escapeHtml = (unsafe) => {
  if (!unsafe) return '';
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
};

async function testTelegram() {
  console.log("Fetching restaurants from Firestore...");
  const snapshot = await getDocs(collection(db, 'restaurants'));
  
  let targetToken = null;
  let targetChatId = null;

  for (const restaurantDoc of snapshot.docs) {
    const data = restaurantDoc.data();
    const configSnap = await getDocs(collection(db, 'restaurants', restaurantDoc.id, 'config'));
    configSnap.forEach(configDoc => {
      if (configDoc.id === 'main') {
        const configData = configDoc.data();
        if (configData.notificationSettings && configData.notificationSettings.telegramToken) {
          console.log(`Found telegram settings for restaurant config: ${data.name}`);
          targetToken = configData.notificationSettings.telegramToken;
          targetChatId = configData.notificationSettings.telegramChatId;
        }
      }
    });
  }

  if (!targetToken || !targetChatId) {
    console.log("No telegram settings found in any restaurant.");
    process.exit(1);
  }

  // Now let's try sending a test message!
  console.log("Attempting to send test message via Telegram API...");
  
  const testMessage = `<b>Test Notification</b>\nThis is a test message to verify escaping works: M&M's <test>`;
  const escapedMessage = `<b>Test Notification</b>\nThis is a test message to verify escaping works: ${escapeHtml("M&M's <test>")}`;
  
  try {
    const response = await fetch(`https://api.telegram.org/bot${targetToken}/sendMessage`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        chat_id: targetChatId,
        text: escapedMessage,
        parse_mode: 'HTML',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      console.error('Telegram API error:', errorData);
    } else {
      console.log('✅ Success! Test message sent to Telegram successfully.');
    }
  } catch (error) {
    console.error('Error sending Telegram message:', error);
  }
  process.exit(0);
}

testTelegram();
