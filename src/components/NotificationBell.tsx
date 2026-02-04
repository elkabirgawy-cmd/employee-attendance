import { useEffect, useState } from 'react';
import { Bell, X, Calendar, CheckCircle, AlertTriangle, Shield } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Notification {
  id: string;
  user_id: string;
  role: 'admin' | 'employee';
  type: string;
  title: string;
  body: string;
  data: Record<string, any>;
  read: boolean;
  priority: 'normal' | 'high';
  created_at: string;
  read_at: string | null;
}

interface NotificationBellProps {
  onNotificationClick?: (type: string, data: Record<string, any>) => void;
}

export default function NotificationBell({ onNotificationClick }: NotificationBellProps) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    if (user?.id) {
      fetchNotifications();

      const subscription = supabase
        .channel('notifications')
        .on('postgres_changes', {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
        }, (payload) => {
          if (payload.new && (payload.new as any).user_id === user.id) {
            fetchNotifications();
          }
        })
        .subscribe();

      const handlePushReceived = () => {
        fetchNotifications();
      };

      window.addEventListener('push-notification-received', handlePushReceived);

      return () => {
        subscription.unsubscribe();
        window.removeEventListener('push-notification-received', handlePushReceived);
      };
    }
  }, [user?.id]);

  async function fetchNotifications() {
    if (!user?.id) return;

    const { data } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    if (data) {
      setNotifications(data);
      setUnreadCount(data.filter(n => !n.read).length);
    }
  }

  async function markAsRead(notificationId: string) {
    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('id', notificationId);

    fetchNotifications();
  }

  async function markAllAsRead() {
    if (!user?.id) return;

    await supabase
      .from('notifications')
      .update({ read: true, read_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('read', false);

    fetchNotifications();
  }

  function handleNotificationClick(notification: Notification) {
    markAsRead(notification.id);

    if (onNotificationClick) {
      onNotificationClick(notification.type, notification.data);
    }

    setShowDropdown(false);
  }

  function getNotificationIcon(type: string) {
    switch (type) {
      case 'leave_request':
      case 'leave_approved':
      case 'leave_rejected':
        return <Calendar className="w-5 h-5 text-blue-600" />;
      case 'fraud_alert':
      case 'fake_gps':
      case 'device_change':
        return <Shield className="w-5 h-5 text-red-600" />;
      case 'late_arrival':
      case 'absence':
        return <AlertTriangle className="w-5 h-5 text-orange-600" />;
      default:
        return <Bell className="w-5 h-5 text-blue-600" />;
    }
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowDropdown(!showDropdown)}
        className="relative p-2 hover:bg-gray-100 rounded-lg transition-colors"
      >
        <Bell className="w-6 h-6 text-gray-600" />
        {unreadCount > 0 && (
          <span className="absolute top-0 right-0 w-5 h-5 bg-red-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {showDropdown && (
        <>
          <div
            className="fixed inset-0 z-40"
            onClick={() => setShowDropdown(false)}
          />
          <div className="absolute left-0 mt-2 w-96 bg-white rounded-xl shadow-2xl border border-gray-200 z-50" dir="rtl">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="font-bold text-gray-800">الإشعارات</h3>
              <div className="flex items-center gap-2">
                {unreadCount > 0 && (
                  <button
                    onClick={markAllAsRead}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                  >
                    تعليم الكل كمقروء
                  </button>
                )}
                <button
                  onClick={() => setShowDropdown(false)}
                  className="p-1 hover:bg-gray-100 rounded"
                >
                  <X className="w-5 h-5 text-gray-500" />
                </button>
              </div>
            </div>

            <div className="max-h-96 overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-gray-500">
                  <Bell className="w-12 h-12 mx-auto mb-3 opacity-50" />
                  <p>لا توجد إشعارات</p>
                </div>
              ) : (
                notifications.map(notification => (
                  <div
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className={`p-4 border-b hover:bg-gray-50 cursor-pointer transition-colors ${
                      !notification.read ? 'bg-blue-50' : ''
                    } ${notification.priority === 'high' ? 'border-r-4 border-r-red-500' : ''}`}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${
                        notification.priority === 'high' ? 'bg-red-100' : 'bg-blue-100'
                      }`}>
                        {getNotificationIcon(notification.type)}
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between mb-1">
                          <h4 className="font-bold text-gray-800 text-sm">
                            {notification.title}
                          </h4>
                          {!notification.read && (
                            <div className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0 mt-1" />
                          )}
                        </div>
                        <p className="text-sm text-gray-600 mb-2">{notification.body}</p>
                        <p className="text-xs text-gray-400">
                          {new Date(notification.created_at).toLocaleString('ar-SA', {
                            month: 'short',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </p>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
