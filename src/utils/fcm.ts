import { getToken, onMessage, deleteToken } from 'firebase/messaging';
import { messaging, vapidKey } from '../lib/firebase';
import { supabase } from '../lib/supabase';

export type FCMPlatform = 'web' | 'android' | 'ios';
export type FCMRole = 'admin' | 'employee';

interface RegisterServiceWorkerOptions {
  onMessage?: (payload: any) => void;
}

async function registerServiceWorkerWithConfig(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) {
    console.warn('Service Worker not supported in this browser');
    return null;
  }

  try {
    const firebaseConfig = {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
      appId: import.meta.env.VITE_FIREBASE_APP_ID
    };

    let swContent = await fetch('/firebase-messaging-sw.js').then(r => r.text());

    swContent = swContent
      .replace('FIREBASE_API_KEY_PLACEHOLDER', firebaseConfig.apiKey || '')
      .replace('FIREBASE_AUTH_DOMAIN_PLACEHOLDER', firebaseConfig.authDomain || '')
      .replace('FIREBASE_PROJECT_ID_PLACEHOLDER', firebaseConfig.projectId || '')
      .replace('FIREBASE_STORAGE_BUCKET_PLACEHOLDER', firebaseConfig.storageBucket || '')
      .replace('FIREBASE_MESSAGING_SENDER_ID_PLACEHOLDER', firebaseConfig.messagingSenderId || '')
      .replace('FIREBASE_APP_ID_PLACEHOLDER', firebaseConfig.appId || '');

    const blob = new Blob([swContent], { type: 'application/javascript' });
    const swUrl = URL.createObjectURL(blob);

    const registration = await navigator.serviceWorker.register(swUrl);
    console.log('Service Worker registered successfully');
    return registration;
  } catch (error) {
    console.error('Service Worker registration failed:', error);
    return null;
  }
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission> {
  if (!('Notification' in window)) {
    console.warn('Notifications not supported in this browser');
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  return await Notification.requestPermission();
}

export async function getFCMToken(userId: string, role: FCMRole, platform: FCMPlatform = 'web'): Promise<string | null> {
  try {
    if (!messaging) {
      console.error('Firebase messaging not initialized');
      return null;
    }

    if (!vapidKey) {
      console.error('VAPID key not configured');
      return null;
    }

    if (!('Notification' in window)) {
      console.warn('Notifications not supported in this browser');
      return null;
    }

    if (Notification.permission !== 'granted') {
      console.warn('Notification permission not granted');
      return null;
    }

    const registration = await registerServiceWorkerWithConfig();
    if (!registration) {
      console.error('Service Worker registration failed');
      return null;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (token) {
      await storeFCMToken(userId, role, platform, token);
      return token;
    } else {
      console.error('No FCM token received');
      return null;
    }
  } catch (error) {
    console.error('Error getting FCM token:', error);
    return null;
  }
}

export async function storeFCMToken(
  userId: string,
  role: FCMRole,
  platform: FCMPlatform,
  token: string
): Promise<boolean> {
  try {
    const { data: existing } = await supabase
      .from('device_push_tokens')
      .select('id, token')
      .eq('user_id', userId)
      .eq('role', role)
      .eq('platform', platform)
      .maybeSingle();

    if (existing && existing.token === token) {
      console.log('FCM token already stored');
      return true;
    }

    if (existing && existing.token !== token) {
      const { error: deleteError } = await supabase
        .from('device_push_tokens')
        .delete()
        .eq('id', existing.id);

      if (deleteError) {
        console.error('Error deleting old FCM token:', deleteError);
      }
    }

    const { error } = await supabase
      .from('device_push_tokens')
      .insert({
        user_id: userId,
        role,
        platform,
        token,
        enabled: true
      });

    if (error) {
      console.error('Error storing FCM token:', error);
      return false;
    }

    console.log('FCM token stored successfully');
    return true;
  } catch (error) {
    console.error('Error in storeFCMToken:', error);
    return false;
  }
}

export async function removeFCMToken(userId: string, role: FCMRole, platform: FCMPlatform = 'web'): Promise<boolean> {
  try {
    if (messaging) {
      await deleteToken(messaging);
    }

    const { error } = await supabase
      .from('device_push_tokens')
      .delete()
      .eq('user_id', userId)
      .eq('role', role)
      .eq('platform', platform);

    if (error) {
      console.error('Error removing FCM token:', error);
      return false;
    }

    console.log('FCM token removed successfully');
    return true;
  } catch (error) {
    console.error('Error in removeFCMToken:', error);
    return false;
  }
}

export async function refreshFCMToken(userId: string, role: FCMRole, platform: FCMPlatform = 'web'): Promise<string | null> {
  try {
    if (!messaging) {
      return null;
    }

    await deleteToken(messaging);

    return await getFCMToken(userId, role, platform);
  } catch (error) {
    console.error('Error refreshing FCM token:', error);
    return null;
  }
}

export function setupForegroundMessageListener(options?: RegisterServiceWorkerOptions): (() => void) | null {
  if (!messaging) {
    console.warn('Firebase messaging not initialized');
    return null;
  }

  const unsubscribe = onMessage(messaging, (payload) => {
    console.log('Received foreground message:', payload);

    if (options?.onMessage) {
      options.onMessage(payload);
    }

    if (payload.notification) {
      const notificationTitle = payload.notification.title || 'New Notification';
      const notificationOptions: NotificationOptions = {
        body: payload.notification.body || '',
        icon: payload.notification.icon || '/icon-192x192.png',
        badge: '/badge-72x72.png',
        data: payload.data || {},
        tag: payload.data?.tag || 'default',
      };

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notificationTitle, notificationOptions);
      }
    }
  });

  return unsubscribe;
}

export async function initializeFCM(
  userId: string,
  role: FCMRole,
  platform: FCMPlatform = 'web',
  options?: RegisterServiceWorkerOptions
): Promise<{ token: string | null; unsubscribe: (() => void) | null; needsPermission: boolean }> {
  try {
    if (!('Notification' in window)) {
      return { token: null, unsubscribe: null, needsPermission: false };
    }

    const needsPermission = Notification.permission !== 'granted';

    let token: string | null = null;
    if (!needsPermission) {
      token = await getFCMToken(userId, role, platform);
    }

    const unsubscribe = setupForegroundMessageListener(options);

    return { token, unsubscribe, needsPermission };
  } catch (error) {
    console.error('Error initializing FCM:', error);
    return { token: null, unsubscribe: null, needsPermission: false };
  }
}

export async function checkNotificationPermission(): Promise<{
  supported: boolean;
  permission: NotificationPermission | null;
  needsPermission: boolean;
}> {
  if (!('Notification' in window)) {
    return { supported: false, permission: null, needsPermission: false };
  }

  return {
    supported: true,
    permission: Notification.permission,
    needsPermission: Notification.permission !== 'granted' && Notification.permission !== 'denied'
  };
}
