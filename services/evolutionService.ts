import { toast } from 'react-hot-toast';

const EVOLUTION_BASE_URL = 'https://evolution-api-production-3ebc.up.railway.app';
const API_KEY = 'ae9ee71df7ddb5b3f09f1fff88a8785f0c9c37da6a35c972638d383d8787f124';

/**
 * RENDER PERSISTENCE CONFIGURATION:
 * To prevent instance loss on restart, you must configure a Disk on Render.
 * 1. Go to your Render Service Dashboard -> Disks.
 * 2. Create a new Disk (e.g., 'evolution-store').
 * 3. Mount path: '/evolution/store' (Check your Evolution API Dockerfile/Env for exact path, usually /evolution/store or /usr/src/app/store).
 * 4. This ensures sessions (auth keys) are saved to disk and survive restarts.
 */

export interface EvolutionSendResponse {
  key: {
    remoteJid: string;
    fromMe: boolean;
    id: string;
  };
  message: Record<string, unknown>;
  messageTimestamp: string;
  status: string;
}

/**
 * Checks the connection status of an instance.
 */
export const checkConnectionStatus = async (instanceName: string): Promise<string | null> => {
  try {
    const response = await fetch(`${EVOLUTION_BASE_URL}/instance/connectionState/${instanceName}`, {
      method: 'GET',
      headers: { 
        'apikey': API_KEY,
        'ngrok-skip-browser-warning': 'true'
      }
    });

    if (response.ok) {
      const data = await response.json();
      // Handle both v1 and v2 response structures if needed, but assuming v2 based on context
      return data?.instance?.state || data?.state || 'unknown';
    } else if (response.status === 404) {
      return null;
    }
    return 'error';
  } catch (error) {
    console.error('Failed to check connection status:', error);
    return 'error';
  }
};

/**
 * Logs out and deletes the instance.
 */
export const logoutEvolutionInstance = async (instanceName: string): Promise<void> => {
  try {
    console.log(`[DEBUG] Logging out instance '${instanceName}'...`);
    // First logout
    await fetch(`${EVOLUTION_BASE_URL}/instance/logout/${instanceName}`, {
      method: 'DELETE',
      headers: { 
        'apikey': API_KEY,
        'ngrok-skip-browser-warning': 'true'
      }
    });

    // Then delete
    await fetch(`${EVOLUTION_BASE_URL}/instance/delete/${instanceName}`, {
      method: 'DELETE',
      headers: { 
        'apikey': API_KEY,
        'ngrok-skip-browser-warning': 'true'
      }
    });
  } catch (error) {
    console.error('Failed to logout instance:', error);
    throw error;
  }
};

/**
 * Restarts the instance.
 */
export const restartInstance = async (instanceName: string): Promise<void> => {
  try {
    console.log(`[DEBUG] Restarting instance '${instanceName}'...`);
    await fetch(`${EVOLUTION_BASE_URL}/instance/restart/${instanceName}`, {
      method: 'PUT',
      headers: { 
        'apikey': API_KEY,
        'ngrok-skip-browser-warning': 'true'
      }
    });
  } catch (error) {
    console.error('Failed to restart instance:', error);
    throw error;
  }
};

/**
 * Sends a single text message via Evolution API
 */
export const sendEvolutionMessage = async (instanceName: string, number: string, text: string): Promise<EvolutionSendResponse> => {
  // Format number: remove non-digits
  let cleanNumber = number.replace(/\D/g, '');
  
  // Force add 91 if missing (assuming Indian numbers)
  if (!cleanNumber.startsWith('91')) {
    cleanNumber = '91' + cleanNumber;
  }
  
  const response = await fetch(`${EVOLUTION_BASE_URL}/message/sendText/${instanceName}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'apikey': API_KEY,
      'ngrok-skip-browser-warning': 'true'
    },
    body: JSON.stringify({
      number: cleanNumber,
      text: text,
      delay: 1200
    })
  });

  if (!response.ok) {
    const errorData = await response.json();
    throw new Error(errorData.message || 'Failed to send message via Evolution API');
  }

  return response.json();
};

/**
 * Sends bulk messages with a 3-second delay between each
 */
export const sendBulkEvolutionMessage = async (
  instanceName: string,
  numbers: string[],
  message: string,
  onProgress: (sent: number, failed: number, total: number) => void
) => {
  let sent = 0;
  let failed = 0;
  const total = numbers.length;

  for (const number of numbers) {
    try {
      console.log(`Sending message to ${number}...`);
      await sendEvolutionMessage(instanceName, number, message);
      console.log(`Sending message to ${number}... Status: Success`);
      sent++;
    } catch (error) {
      console.error(`Failed to send message to ${number}:`, error);
      console.log(`Sending message to ${number}... Status: Fail`);
      failed++;
    }
    
    onProgress(sent, failed, total);
    
    // 3-second delay between messages
    if (sent + failed < total) {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
  }

  return { sent, failed, total };
};

/**
 * Gets the QR code for an instance.
 * Strategy: Smart Check -> Create if Missing -> Return QR.
 * The polling for status 'open' is handled by the UI.
 */
export const getEvolutionQR = async (instanceName: string): Promise<string> => {
  console.log(`[DEBUG] Starting QR Fetch Sequence for '${instanceName}'...`);
  
  // STEP 1: Check Connection State
  toast.loading("Checking instance state...", { id: 'qr-status' });
  let instanceState: string | null = null;

  try {
    instanceState = await checkConnectionStatus(instanceName);
    console.log(`[DEBUG] Instance State: ${instanceState}`);
  } catch (e) {
    console.warn("[DEBUG] State check failed:", e);
  }

  // STEP 2: Create Instance if it doesn't exist (404 or null)
  if (!instanceState || instanceState === 'not_found' || instanceState === 'null') {
    console.log(`[DEBUG] Instance missing. Creating NEW instance '${instanceName}'...`);
    toast.loading("Creating new instance...", { id: 'qr-status' });

    const createResponse = await fetch(`${EVOLUTION_BASE_URL}/instance/create`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': API_KEY,
        'ngrok-skip-browser-warning': 'true'
      },
      body: JSON.stringify({
        instanceName: instanceName,
        qrcode: true,
        integration: "WHATSAPP-BAILEYS"
      })
    });

    if (!createResponse.ok) {
      const errorText = await createResponse.text();
      console.error('Evolution API Create Error:', errorText);
      toast.error(`Creation Failed: ${createResponse.status}`, { id: 'qr-status' });
      throw new Error(`Failed to create instance: ${createResponse.statusText}`);
    }

    // Wait 10 seconds for engine boot (Silent Wait)
    console.log("[DEBUG] Waiting 10s for engine boot...");
    toast.loading("Starting WhatsApp Engine...", { id: 'qr-status' });
    await new Promise(resolve => setTimeout(resolve, 10000));
  } 
  // STEP 3: Handle 'close' state
  else if (instanceState === 'close') {
    console.log(`[DEBUG] Instance is closed. Restarting '${instanceName}'...`);
    toast.loading("Restarting instance...", { id: 'qr-status' });
    
    await restartInstance(instanceName);
    
    // Wait 5 seconds for restart
    console.log("[DEBUG] Waiting 5s for restart...");
    await new Promise(resolve => setTimeout(resolve, 5000));
  }

  // STEP 4: Fetch QR
  console.log("[DEBUG] Fetching QR...");
  toast.loading("Fetching QR Code...", { id: 'qr-status' });

  const qrResponse = await fetch(`${EVOLUTION_BASE_URL}/instance/connect/${instanceName}`, {
    method: 'GET',
    headers: { 
      'apikey': API_KEY,
      'ngrok-skip-browser-warning': 'true'
    }
  });

  if (qrResponse.ok) {
    const data = await qrResponse.json();
    console.log("[DEBUG] QR Response:", data);
    
    const qr = data?.code || data?.base64 || data?.qrcode?.base64 || data?.qrcode?.code;
    
    if (qr) {
         console.log("[DEBUG] QR Code found!");
         toast.success("QR Code Received!", { id: 'qr-status' });
         return qr;
    }
  }
  
  throw new Error("Failed to retrieve QR code.");
};
