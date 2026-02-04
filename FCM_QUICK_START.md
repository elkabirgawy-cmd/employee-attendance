# FCM Quick Start Guide

## Step 1: Configure Firebase Credentials

Replace the placeholder values in `.env` with your actual Firebase project credentials:

```env
# Get these from Firebase Console > Project Settings > General
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789
VITE_FIREBASE_APP_ID=1:123456789:web:abc123def456

# Get this from Firebase Console > Project Settings > Cloud Messaging > Web Push certificates
VITE_FIREBASE_VAPID_KEY=BNxyz123...
```

## Step 2: Configure Service Account (Backend)

In your Supabase Dashboard:

1. Go to Project Settings > Edge Functions > Secrets
2. Add a new secret: `FIREBASE_SERVICE_ACCOUNT_JSON`
3. Paste your Firebase service account JSON (minified, single line)

To get the service account JSON:
- Firebase Console > Project Settings > Service Accounts
- Click "Generate New Private Key"
- Copy the entire JSON content (remove line breaks)

## Step 3: Test Push Notifications

### Test from Browser Console

```javascript
// Check if notifications work
await Notification.requestPermission();

// Check if token is stored
const { data } = await supabase
  .from('device_push_tokens')
  .select('*')
  .eq('user_id', 'your-user-id');
console.log('FCM Tokens:', data);
```

### Send Test Notification

```javascript
const { data, error } = await supabase.functions.invoke('send-push', {
  body: {
    userId: 'user-uuid',
    role: 'employee',
    title: 'Test Notification',
    body: 'FCM is working!',
    type: 'late_arrival',
    priority: 'high'
  }
});
console.log('Result:', data);
```

## That's It!

Your FCM integration is ready. Notifications will automatically:
- Request permission when user logs in
- Store FCM token in database
- Handle foreground and background notifications
- Auto-refresh tokens when needed
- Clean up invalid tokens

For detailed documentation, see `FCM_INTEGRATION.md`.
