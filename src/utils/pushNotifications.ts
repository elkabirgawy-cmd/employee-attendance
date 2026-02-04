import { PushNotifications } from '@capacitor/push-notifications';
import { Capacitor } from '@capacitor/core';
import { supabase } from '../lib/supabase';

export interface NotificationPayload {
  title: string;
  body: string;
  data?: Record<string, any>;
}

const isNativePlatform = Capacitor.isNativePlatform();

let pushInitialized = false;
let currentUserId: string | null = null;
let currentRole: 'admin' | 'employee' | null = null;

export async function checkNativePushPermission(): Promise<{
  canRequest: boolean;
  needsPermission: boolean;
  status: 'granted' | 'denied' | 'prompt';
}> {
  if (!isNativePlatform) {
    return { canRequest: false, needsPermission: false, status: 'denied' };
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'granted') {
      return { canRequest: false, needsPermission: false, status: 'granted' };
    } else if (permStatus.receive === 'denied') {
      return { canRequest: false, needsPermission: false, status: 'denied' };
    } else {
      return { canRequest: true, needsPermission: true, status: 'prompt' };
    }
  } catch (error) {
    console.error('Error checking push permission:', error);
    return { canRequest: false, needsPermission: false, status: 'denied' };
  }
}

export async function requestNativePushPermission(userId: string, role: 'admin' | 'employee'): Promise<boolean> {
  if (!isNativePlatform) {
    console.log('Push notifications not available on web platform');
    return false;
  }

  try {
    const permRequest = await PushNotifications.requestPermissions();

    if (permRequest.receive !== 'granted') {
      console.log('Push notification permission denied');
      return false;
    }

    currentUserId = userId;
    currentRole = role;

    await PushNotifications.register();

    await setupPushListeners(userId, role);

    pushInitialized = true;
    return true;
  } catch (error) {
    console.error('Error requesting push permission:', error);
    return false;
  }
}

async function setupPushListeners(userId: string, role: 'admin' | 'employee') {
  if (!isNativePlatform) {
    return;
  }

  await PushNotifications.removeAllListeners();

  await PushNotifications.addListener('registration', async (token) => {
    console.log('Push registration success, token:', token.value);
    await saveDeviceToken(userId, role, token.value);
  });

  await PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration error:', error);
  });

  await PushNotifications.addListener('pushNotificationReceived', async (notification) => {
    console.log('Push notification received:', notification);
    window.dispatchEvent(new CustomEvent('push-notification-received', { detail: notification }));
  });

  await PushNotifications.addListener('pushNotificationActionPerformed', (notification) => {
    console.log('Push notification action performed:', notification);
    window.dispatchEvent(new CustomEvent('push-notification-action', { detail: notification }));
  });
}

export async function initializePushNotifications(userId: string, role: 'admin' | 'employee'): Promise<{ needsPermission: boolean }> {
  if (!isNativePlatform) {
    console.log('Push notifications not supported on web platform');
    return { needsPermission: false };
  }

  if (pushInitialized) {
    return { needsPermission: false };
  }

  try {
    const permStatus = await PushNotifications.checkPermissions();

    if (permStatus.receive === 'granted') {
      currentUserId = userId;
      currentRole = role;

      await PushNotifications.register();
      await setupPushListeners(userId, role);

      pushInitialized = true;
      return { needsPermission: false };
    } else if (permStatus.receive === 'prompt' || permStatus.receive === 'prompt-with-rationale') {
      return { needsPermission: true };
    } else {
      console.log('Push notification permission denied');
      return { needsPermission: false };
    }
  } catch (error) {
    console.error('Error initializing push notifications:', error);
    return { needsPermission: false };
  }
}

function generateDeviceId(): string {
  const stored = localStorage.getItem('device_id');
  if (stored) return stored;

  const newId = `${getPlatform()}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  localStorage.setItem('device_id', newId);
  return newId;
}

async function getCompanyId(userId: string): Promise<string | null> {
  try {
    const { data: adminUser } = await supabase
      .from('admin_users')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    if (adminUser) return adminUser.company_id;

    const { data: employee } = await supabase
      .from('employees')
      .select('company_id')
      .eq('user_id', userId)
      .maybeSingle();

    return employee?.company_id || null;
  } catch (error) {
    console.error('Error getting company_id:', error);
    return null;
  }
}

async function saveDeviceToken(userId: string, role: 'admin' | 'employee', token: string) {
  try {
    const platform = getPlatform();
    const deviceId = generateDeviceId();
    const companyId = await getCompanyId(userId);

    if (!companyId) {
      console.error('Cannot save device token: company_id not found');
      return;
    }

    const { data: existingDevice } = await supabase
      .from('push_devices')
      .select('*')
      .eq('device_id', deviceId)
      .maybeSingle();

    if (existingDevice) {
      await supabase
        .from('push_devices')
        .update({
          user_id: userId,
          token,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        })
        .eq('id', existingDevice.id);

      console.log('Device token updated in database');
    } else {
      await supabase
        .from('push_devices')
        .insert({
          company_id: companyId,
          user_id: userId,
          device_id: deviceId,
          platform,
          token,
          enabled: true,
          last_seen_at: new Date().toISOString(),
        });

      console.log('Device token saved to database');
    }
  } catch (error) {
    console.error('Error saving device token:', error);
  }
}

function getPlatform(): 'ios' | 'android' | 'web' {
  const userAgent = navigator.userAgent || navigator.vendor;

  if (/android/i.test(userAgent)) {
    return 'android';
  }

  if (/iPad|iPhone|iPod/.test(userAgent)) {
    return 'ios';
  }

  return 'web';
}

export async function disableDeviceOnLogout(userId: string) {
  try {
    const deviceId = generateDeviceId();

    await supabase
      .from('push_devices')
      .update({ enabled: false })
      .eq('device_id', deviceId)
      .eq('user_id', userId);

    console.log('Device disabled on logout');
  } catch (error) {
    console.error('Error disabling device:', error);
  }
}

export async function unregisterPushNotifications(userId?: string) {
  try {
    if (userId) {
      await disableDeviceOnLogout(userId);
    }

    await PushNotifications.removeAllListeners();
    pushInitialized = false;
    currentUserId = null;
    currentRole = null;
  } catch (error) {
    console.error('Error unregistering push notifications:', error);
  }
}

export async function sendTestPushNotification(userId: string): Promise<{
  success: boolean;
  message: string;
  dryRun?: boolean;
  devicesFound?: number;
}> {
  try {
    const companyId = await getCompanyId(userId);

    if (!companyId) {
      return {
        success: false,
        message: 'Could not determine company ID'
      };
    }

    const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/send-push`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify({
        company_id: companyId,
        userId,
        role: 'admin',
        title: 'Test Push Notification',
        body: 'This is a test notification from GeoShift Attendance System',
        type: 'test',
        priority: 'high',
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
      return {
        success: false,
        message: errorData.error || 'Failed to send test notification'
      };
    }

    const result = await response.json();

    if (result.mode === 'dry_run') {
      return {
        success: true,
        message: result.message || `Dry-run: Found ${result.devicesFound || 0} device(s)`,
        dryRun: true,
        devicesFound: result.devicesFound || 0
      };
    }

    if (result.ok) {
      return {
        success: true,
        message: `Test notification sent successfully to ${result.sent || 0} device(s)`,
        dryRun: false
      };
    }

    if (result.reason === 'NO_ENABLED_DEVICES') {
      return {
        success: false,
        message: 'No active devices found. Please enable push notifications first.'
      };
    }

    return {
      success: false,
      message: 'Unexpected response from push service'
    };
  } catch (error: any) {
    console.error('Error sending test notification:', error);
    return {
      success: false,
      message: error.message || 'Error sending test notification'
    };
  }
}
