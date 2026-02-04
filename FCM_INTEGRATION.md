# Firebase Cloud Messaging (FCM) Integration

This document describes the Firebase Cloud Messaging (FCM) push notification system integrated into the GPS-based Employee Attendance System.

## Overview

The system uses Firebase Cloud Messaging HTTP v1 API to send push notifications to:
- **Employees** (Web, Android, iOS)
- **Admins** (Web, Android, iOS)

## Architecture

### Frontend Components

1. **Firebase Configuration** (`src/lib/firebase.ts`)
   - Initializes Firebase app with environment variables
   - Exports Firebase messaging instance
   - Manages VAPID key for web push

2. **FCM Utilities** (`src/utils/fcm.ts`)
   - `getFCMToken()` - Requests notification permission and retrieves FCM token
   - `storeFCMToken()` - Saves token to Supabase database
   - `removeFCMToken()` - Removes token from database
   - `refreshFCMToken()` - Refreshes expired or invalid tokens
   - `initializeFCM()` - Complete initialization flow
   - `setupForegroundMessageListener()` - Handles foreground notifications

3. **React Hook** (`src/hooks/useFCM.ts`)
   - `useFCM()` - Custom React hook for FCM integration
   - Automatic initialization when user logs in
   - Handles token refresh on app visibility changes
   - Manages foreground message listeners

4. **Service Worker** (`public/firebase-messaging-sw.js`)
   - Handles background notifications when app is closed
   - Shows system notifications with custom styling
   - Handles notification click actions

### Backend Components

1. **Edge Function** (`supabase/functions/send-push/index.ts`)
   - Uses Firebase Cloud Messaging HTTP v1 API
   - Implements JWT-based authentication
   - Supports multiple targeting options:
     - Single user (by userId)
     - Multiple users (by userIds array)
     - All users in a branch (by branchId)
     - All users with a role (by role: 'admin' or 'employee')
   - Platform-specific configurations (Android, iOS, Web)
   - Automatic invalid token removal
   - Stores notifications in Supabase database

2. **Database Table** (`device_push_tokens`)
   - Stores FCM tokens for all devices
   - Prevents duplicate tokens per user/device
   - Tracks platform (web, android, ios)
   - Supports enable/disable per token

## Setup Instructions

### 1. Firebase Project Configuration

Create a Firebase project and obtain the following credentials:

```env
VITE_FIREBASE_API_KEY=your_firebase_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project_id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project_id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

### 2. Service Account Setup

For the backend edge function, add the Firebase Service Account JSON as an environment variable in Supabase:

```bash
# In Supabase Dashboard > Project Settings > Edge Functions > Secrets
FIREBASE_SERVICE_ACCOUNT_JSON={"type":"service_account","project_id":"..."}
```

To get the service account JSON:
1. Go to Firebase Console > Project Settings > Service Accounts
2. Click "Generate New Private Key"
3. Copy the entire JSON content (minified, single line)
4. Add it as the `FIREBASE_SERVICE_ACCOUNT_JSON` environment variable

### 3. VAPID Key Generation

1. Go to Firebase Console > Project Settings > Cloud Messaging
2. Under "Web Push certificates" tab
3. Generate a new key pair or use existing
4. Copy the "Key pair" value and use it as `VITE_FIREBASE_VAPID_KEY`

## Usage

### Frontend - Employee App

The FCM integration is automatic. When an employee logs in:

```typescript
// Already integrated in src/pages/EmployeeApp.tsx
useFCM({
  userId: employee?.id || null,
  role: 'employee',
  platform: 'web',
  enabled: !!employee,
  onMessage: (payload) => {
    console.log('Push notification received:', payload);
    // Handle notification in app
  }
});
```

### Frontend - Admin App

Similarly for admins:

```typescript
// Already integrated in src/components/Layout.tsx
useFCM({
  userId: user?.id || null,
  role: 'admin',
  platform: 'web',
  enabled: !!user,
  onMessage: (payload) => {
    console.log('Admin push notification received:', payload);
  }
});
```

### Backend - Sending Notifications

Call the `send-push` edge function from your application:

```typescript
const { data, error } = await supabase.functions.invoke('send-push', {
  body: {
    // Option 1: Send to single user
    userId: 'user-uuid',
    role: 'employee',

    // Option 2: Send to multiple users
    // userIds: ['uuid1', 'uuid2', 'uuid3'],

    // Option 3: Send to all users in a branch
    // branchId: 'branch-uuid',

    // Option 4: Send to all users with role
    // role: 'admin',

    title: 'Late Arrival Alert',
    body: 'You arrived 15 minutes late today',
    type: 'late_arrival',
    priority: 'high',
    data: {
      attendanceId: 'log-uuid',
      url: '/attendance'
    },
    imageUrl: 'https://example.com/image.png' // Optional
  }
});
```

## Notification Types

The system supports these notification types:

- `leave_request` - New leave request from employee
- `leave_approved` - Leave request approved
- `leave_rejected` - Leave request rejected
- `late_arrival` - Employee arrived late
- `absence` - Employee absent
- `fraud_alert` - Security/fraud detection alert
- `payroll_deduction` - Payroll penalty/deduction
- `device_change` - Device change request
- `fake_gps` - Fake GPS detected

## Platform Support

### Web Push
- Supported on Chrome, Firefox, Edge, Opera
- Requires HTTPS (except localhost)
- User must grant notification permission

### Android
- Use Firebase SDK in Android app
- Token management same as web
- Configure `google-services.json`

### iOS
- Use Firebase SDK in iOS app
- Configure APNs certificate in Firebase Console
- Handle notification permissions

## Security Features

1. **Duplicate Prevention**
   - Only one token per user/device/platform combination
   - Old tokens automatically replaced

2. **Invalid Token Cleanup**
   - Automatically removes invalid/expired tokens
   - Prevents sending to unregistered devices

3. **Permission Handling**
   - Respects user's notification permission
   - Graceful degradation if permission denied

4. **Token Refresh**
   - Automatic refresh on app visibility changes
   - Manual refresh available via `refreshToken()`

## Troubleshooting

### Notifications Not Received

1. **Check notification permission**
   ```javascript
   const permission = await Notification.requestPermission();
   console.log('Permission:', permission);
   ```

2. **Check FCM token**
   ```javascript
   const { data } = await supabase
     .from('device_push_tokens')
     .select('*')
     .eq('user_id', userId);
   console.log('Tokens:', data);
   ```

3. **Check service worker registration**
   ```javascript
   navigator.serviceWorker.getRegistrations().then(registrations => {
     console.log('Service Workers:', registrations);
   });
   ```

### Build Issues

If you encounter build errors:

1. Ensure all Firebase environment variables are set
2. Check that `firebase` package is installed
3. Verify service worker file exists in `public/` folder

### Token Not Saving

1. Check RLS policies on `device_push_tokens` table
2. Verify Supabase connection
3. Check browser console for errors

## Testing

### Test Push Notification

```bash
# Using Supabase CLI or Dashboard
curl -X POST 'https://your-project.supabase.co/functions/v1/send-push' \
  -H 'Authorization: Bearer YOUR_ANON_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "userId": "test-user-uuid",
    "role": "employee",
    "title": "Test Notification",
    "body": "This is a test",
    "type": "late_arrival",
    "priority": "normal"
  }'
```

## Performance Considerations

1. **Token Storage**
   - Tokens cached in Supabase database
   - No need to retrieve token on every app launch

2. **Background Processing**
   - Service worker handles notifications when app closed
   - Minimal battery impact

3. **Batch Sending**
   - Edge function sends to multiple tokens efficiently
   - Automatic retry for failed sends

## Migration from Legacy FCM

If migrating from legacy FCM API:

1. Update edge function to use HTTP v1 API (already done)
2. Replace server key with service account JSON
3. Update message payload structure
4. Test thoroughly before deployment

## Resources

- [Firebase Cloud Messaging Documentation](https://firebase.google.com/docs/cloud-messaging)
- [Web Push API](https://developer.mozilla.org/en-US/docs/Web/API/Push_API)
- [Service Worker API](https://developer.mozilla.org/en-US/docs/Web/API/Service_Worker_API)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
