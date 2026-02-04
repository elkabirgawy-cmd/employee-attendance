import { useEffect, useRef, useState } from 'react';
import { initializeFCM, refreshFCMToken, requestWebNotificationPermission, getFCMToken, setupForegroundMessageListener, type FCMRole, type FCMPlatform } from '../utils/fcm';

interface UseFCMOptions {
  userId: string | null;
  role: FCMRole;
  platform?: FCMPlatform;
  enabled?: boolean;
  onMessage?: (payload: any) => void;
}

export function useFCM({ userId, role, platform = 'web', enabled = true, onMessage }: UseFCMOptions) {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [fcmError, setFcmError] = useState<string | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [needsPermission, setNeedsPermission] = useState(false);
  const [requestingPermission, setRequestingPermission] = useState(false);
  const unsubscribeRef = useRef<(() => void) | null>(null);
  const initTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    if (!userId || !enabled) {
      return;
    }

    let isMounted = true;

    const initialize = async () => {
      try {
        setFcmError(null);

        initTimeoutRef.current = window.setTimeout(async () => {
          if (!isMounted) return;

          const { token, unsubscribe, needsPermission: permissionNeeded } = await initializeFCM(userId, role, platform, {
            onMessage: (payload) => {
              console.log('FCM message received in app:', payload);
              if (onMessage) {
                onMessage(payload);
              }
            }
          });

          if (!isMounted) return;

          setNeedsPermission(permissionNeeded);

          if (token) {
            setFcmToken(token);
            setIsInitialized(true);
            console.log('FCM initialized successfully');
          } else if (!permissionNeeded) {
            console.warn('FCM initialization completed but no token received');
          }

          if (unsubscribe) {
            unsubscribeRef.current = unsubscribe;
          }
        }, 2000);
      } catch (error: any) {
        if (isMounted) {
          console.error('Error initializing FCM:', error);
          setFcmError(error.message || 'Failed to initialize push notifications');
        }
      }
    };

    initialize();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible' && isInitialized) {
        console.log('App became visible, checking FCM token validity');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (initTimeoutRef.current) {
        clearTimeout(initTimeoutRef.current);
      }
      if (unsubscribeRef.current) {
        unsubscribeRef.current();
        unsubscribeRef.current = null;
      }
    };
  }, [userId, role, platform, enabled, isInitialized]);

  const refreshToken = async () => {
    if (!userId) return null;

    try {
      const newToken = await refreshFCMToken(userId, role, platform);
      if (newToken) {
        setFcmToken(newToken);
        console.log('FCM token refreshed successfully');
      }
      return newToken;
    } catch (error: any) {
      console.error('Error refreshing FCM token:', error);
      setFcmError(error.message || 'Failed to refresh token');
      return null;
    }
  };

  const requestPermission = async () => {
    if (!userId) return false;

    setRequestingPermission(true);
    try {
      const permission = await requestWebNotificationPermission();

      if (permission === 'granted') {
        const token = await getFCMToken(userId, role, platform);

        if (token) {
          setFcmToken(token);
          setIsInitialized(true);
          setNeedsPermission(false);

          const unsubscribe = setupForegroundMessageListener({
            onMessage: (payload) => {
              console.log('FCM message received in app:', payload);
              if (onMessage) {
                onMessage(payload);
              }
            }
          });

          if (unsubscribe) {
            unsubscribeRef.current = unsubscribe;
          }

          console.log('FCM permission granted and initialized');
          return true;
        }
      }

      setNeedsPermission(false);
      return false;
    } catch (error: any) {
      console.error('Error requesting FCM permission:', error);
      setFcmError(error.message || 'Failed to request permission');
      return false;
    } finally {
      setRequestingPermission(false);
    }
  };

  return {
    fcmToken,
    fcmError,
    isInitialized,
    needsPermission,
    requestingPermission,
    refreshToken,
    requestPermission
  };
}
