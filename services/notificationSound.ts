/**
 * Notification Sound & Browser Notification Service
 * 
 * 1. Uses Web Audio API to generate a LOUD multi-tone notification chime.
 * 2. Provides Browser Notification API helpers for push notifications
 *    that work even when the tab is in the background.
 */

let audioContext: AudioContext | null = null;

function getAudioContext(): AudioContext {
  if (!audioContext || audioContext.state === 'closed') {
    audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
  }
  // Resume if suspended (browser autoplay policy)
  if (audioContext.state === 'suspended') {
    audioContext.resume();
  }
  return audioContext;
}

// ============================================================
// 1. NOTIFICATION SOUND (Web Audio API — LOUD)
// ============================================================

/**
 * Plays a LOUD ascending bell/chime notification sound.
 * Uses three ascending tones with high gain for clear audibility.
 */
export function playOrderNotificationSound(): void {
  try {
    const ctx = getAudioContext();
    const now = ctx.currentTime;

    // Master gain node for overall volume control
    const masterGain = ctx.createGain();
    masterGain.gain.setValueAtTime(0.8, now); // LOUD master volume
    masterGain.connect(ctx.destination);

    // Three ascending tones for a pleasant but loud chime
    const tones = [
      { freq: 587.33, start: 0,    duration: 0.18 },  // D5
      { freq: 739.99, start: 0.2,  duration: 0.18 },  // F#5
      { freq: 880.00, start: 0.4,  duration: 0.35 },  // A5 (longer, resolving)
    ];

    tones.forEach(({ freq, start, duration }) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(freq, now + start);

      // Envelope: quick attack, sustain, smooth decay
      gainNode.gain.setValueAtTime(0, now + start);
      gainNode.gain.linearRampToValueAtTime(0.6, now + start + 0.02);  // Attack — LOUD
      gainNode.gain.setValueAtTime(0.6, now + start + duration * 0.6); // Sustain — LOUD
      gainNode.gain.exponentialRampToValueAtTime(0.001, now + start + duration); // Decay

      oscillator.connect(gainNode);
      gainNode.connect(masterGain);

      oscillator.start(now + start);
      oscillator.stop(now + start + duration + 0.05);
    });

    // Second layer: a higher harmonic for richness (also louder)
    const harmonic = ctx.createOscillator();
    const harmonicGain = ctx.createGain();
    harmonic.type = 'sine';
    harmonic.frequency.setValueAtTime(1760, now + 0.4); // A6
    harmonicGain.gain.setValueAtTime(0, now + 0.4);
    harmonicGain.gain.linearRampToValueAtTime(0.2, now + 0.42);
    harmonicGain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);
    harmonic.connect(harmonicGain);
    harmonicGain.connect(masterGain);
    harmonic.start(now + 0.4);
    harmonic.stop(now + 0.95);

    // Third layer: repeat the chime after a short pause for emphasis
    setTimeout(() => {
      try {
        const ctx2 = getAudioContext();
        const now2 = ctx2.currentTime;
        const masterGain2 = ctx2.createGain();
        masterGain2.gain.setValueAtTime(0.6, now2);
        masterGain2.connect(ctx2.destination);

        const repeatTones = [
          { freq: 739.99, start: 0,    duration: 0.15 },
          { freq: 880.00, start: 0.18, duration: 0.25 },
        ];

        repeatTones.forEach(({ freq, start, duration }) => {
          const osc = ctx2.createOscillator();
          const gn = ctx2.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now2 + start);
          gn.gain.setValueAtTime(0, now2 + start);
          gn.gain.linearRampToValueAtTime(0.5, now2 + start + 0.02);
          gn.gain.exponentialRampToValueAtTime(0.001, now2 + start + duration);
          osc.connect(gn);
          gn.connect(masterGain2);
          osc.start(now2 + start);
          osc.stop(now2 + start + duration + 0.05);
        });
      } catch (e) { /* ignore repeat errors */ }
    }, 800);

  } catch (err) {
    console.warn('Could not play notification sound:', err);
  }
}

// ============================================================
// 2. BROWSER NOTIFICATION API (Push Notifications)
// ============================================================

/**
 * Request browser notification permission.
 * Should be called on Dashboard load.
 * Returns: 'granted' | 'denied' | 'default'
 */
export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Browser does not support notifications');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'default') {
    const permission = await Notification.requestPermission();
    return permission;
  }

  return Notification.permission;
}

/**
 * Send a browser push notification.
 * Works even when the tab is in the background / minimized.
 * Works on phone, laptop, PC — any device with browser notification support.
 */
export function sendBrowserNotification(title: string, body: string): void {
  if (!('Notification' in window) || Notification.permission !== 'granted') {
    return;
  }

  try {
    const notification = new Notification(title, {
      body,
      icon: '🛒',
      badge: '🔔',
      tag: 'new-order-' + Date.now(), // Unique tag so notifications don't collapse
      requireInteraction: true, // Stay visible until user dismisses
    });

    // Auto-close after 10 seconds
    setTimeout(() => {
      notification.close();
    }, 10000);
  } catch (err) {
    console.warn('Could not send browser notification:', err);
  }
}
