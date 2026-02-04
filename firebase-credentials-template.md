# Firebase Credentials Setup

## For Android

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select/Create project
3. Add Android app:
   - Package name: `com.geoshift.attendance`
4. Download `google-services.json`
5. Place at: `android/app/google-services.json`

**Example location**:
```
android/
  app/
    google-services.json  ← Place here
    build.gradle
    src/
```

## For iOS (Mac only)

1. In Firebase Console, add iOS app:
   - Bundle ID: `com.geoshift.attendance`
2. Download `GoogleService-Info.plist`
3. In Xcode:
   - Right-click on "App" folder
   - Select "Add Files to 'App'"
   - Choose `GoogleService-Info.plist`
   - Make sure "Copy items if needed" is checked

**Or manually place at**:
```
ios/
  App/
    App/
      GoogleService-Info.plist  ← Place here
      Info.plist
```

## APNs Key (iOS only)

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Keys**
3. Create new key with **APNs** service
4. Download `.p8` file
5. In Firebase Console:
   - Go to Project Settings → Cloud Messaging
   - Upload APNs key
   - Enter Key ID and Team ID

## Environment Variables (Optional)

If you want to add Firebase config to `.env` file:

```env
# Firebase Configuration (Web)
VITE_FIREBASE_API_KEY=your_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_VAPID_KEY=your_vapid_key
```

These are already configured in `src/lib/firebase.ts` for web push notifications.

## Security Notes

- ✅ `google-services.json` is in `.gitignore` (don't commit!)
- ✅ `GoogleService-Info.plist` is in `.gitignore` (don't commit!)
- ✅ APNs `.p8` key should never be committed
- ✅ Keep Firebase Server Key secret (backend only)

## Verification

After placing files:

```bash
# Check files are in correct location
ls -la android/app/google-services.json
ls -la ios/App/App/GoogleService-Info.plist

# Sync to native projects
npm run cap:sync

# Open and build
npm run cap:android  # or cap:ios
```

If files are missing, app will fail to build with Firebase errors.
