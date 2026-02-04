# iOS Push Notifications Setup Guide

## Prerequisites

- macOS computer (required for iOS development)
- Xcode 14 or later
- Apple Developer Account ($99/year)
- Physical iOS device (Push notifications don't work in simulator)

## Step 1: Apple Developer Portal Setup

### 1.1 Create App ID with Push Capability

1. Go to [Apple Developer Portal](https://developer.apple.com/account)
2. Navigate to **Certificates, Identifiers & Profiles**
3. Click **Identifiers** → **+** button
4. Select **App IDs** → Click **Continue**
5. Fill in:
   - **Description**: GeoShift Attendance
   - **Bundle ID**: `com.geoshift.attendance` (must match capacitor.config.ts)
6. Scroll down and check **Push Notifications**
7. Click **Continue** → **Register**

### 1.2 Generate APNs Authentication Key (Recommended Method)

1. In Apple Developer Portal, go to **Keys**
2. Click **+** button
3. Fill in:
   - **Key Name**: GeoShift Push Notifications Key
   - Check **Apple Push Notifications service (APNs)**
4. Click **Continue** → **Register**
5. **Download the .p8 file** (you can only download it once!)
6. Note down:
   - **Key ID** (10 characters)
   - **Team ID** (found in top right of developer portal)

### 1.3 Upload APNs Key to Firebase (if using FCM)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Select your project
3. Go to **Project Settings** → **Cloud Messaging** tab
4. Under **Apple app configuration**, click **Upload**
5. Upload your .p8 file and enter:
   - Key ID
   - Team ID

## Step 2: Add iOS Platform

```bash
# Install Capacitor CLI if not already installed
npm install -D @capacitor/cli

# Add iOS platform
npx cap add ios

# Sync web assets to iOS
npm run build
npx cap sync ios
```

## Step 3: Configure iOS Project in Xcode

### 3.1 Open Project in Xcode

```bash
npx cap open ios
```

### 3.2 Configure Signing

1. In Xcode, select **App** target
2. Go to **Signing & Capabilities** tab
3. Check **Automatically manage signing**
4. Select your **Team**
5. Xcode will automatically create provisioning profiles

### 3.3 Add Push Notifications Capability

1. In **Signing & Capabilities** tab
2. Click **+ Capability** button
3. Search for and add **Push Notifications**

### 3.4 Add Background Modes

1. Click **+ Capability** button again
2. Add **Background Modes**
3. Check these modes:
   - ☑️ **Remote notifications**
   - ☑️ **Background fetch** (optional, for background updates)

### 3.5 Configure Info.plist

The Info.plist is located at `ios/App/App/Info.plist`

No special configuration needed - Push notifications work automatically once capability is added.

## Step 4: Update Capacitor Configuration

The `capacitor.config.ts` is already configured:

```typescript
{
  appId: 'com.geoshift.attendance',
  appName: 'GeoShift Attendance',
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert']
    }
  }
}
```

## Step 5: Build and Test on Device

### 5.1 Connect Physical iOS Device

1. Connect your iPhone/iPad via USB
2. Trust the device when prompted
3. In Xcode, select your device from the device dropdown (top left)

### 5.2 Build and Run

1. Click the **Play** button in Xcode (or Cmd+R)
2. Wait for build to complete
3. App will install and launch on your device

### 5.3 Test Push Notifications

1. Open the app
2. Go to **Settings** → **Notifications**
3. Click **تفعيل الإشعارات** (Enable Notifications)
4. Grant permission when iOS prompts
5. Click **إرسال إشعار تجريبي** (Send Test Notification)
6. You should receive a test notification

## Step 6: Troubleshooting

### Push Notifications Not Working?

1. **Check device**:
   - Are you using a physical device? (Simulator doesn't support push)
   - Is the device connected to internet?

2. **Check Firebase**:
   - Is APNs key uploaded correctly?
   - Check Firebase console for errors

3. **Check Xcode**:
   - Is Push Notifications capability added?
   - Is Remote notifications background mode enabled?
   - Check Xcode logs for errors

4. **Check Code**:
   - Open Safari Developer tools → Connect to device
   - Check console for errors
   - Verify token is being saved to Supabase `push_devices` table

### Common Issues

**Issue**: "No valid 'aps-environment' entitlement string found"
**Solution**: Make sure Push Notifications capability is added in Xcode

**Issue**: Token registration fails
**Solution**: Check that your Bundle ID matches in:
- Xcode project settings
- Apple Developer Portal App ID
- capacitor.config.ts

**Issue**: Notifications not received
**Solution**:
- Check that app is in background/closed (foreground notifications require special handling)
- Verify APNs key is uploaded to Firebase
- Check Supabase `push_devices` table has a valid token

## Step 7: Production Deployment

### 7.1 Archive and Upload to App Store

1. In Xcode, select **Any iOS Device (arm64)** as build target
2. Go to **Product** → **Archive**
3. Wait for archive to complete
4. Click **Distribute App**
5. Follow TestFlight/App Store submission process

### 7.2 Production vs Development APNs

- Development: Used when running from Xcode
- Production: Used for TestFlight and App Store builds

Firebase automatically handles both environments when you upload your APNs key.

## Resources

- [Apple Push Notifications Documentation](https://developer.apple.com/documentation/usernotifications)
- [Capacitor Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
- [Firebase Cloud Messaging for iOS](https://firebase.google.com/docs/cloud-messaging/ios/client)
