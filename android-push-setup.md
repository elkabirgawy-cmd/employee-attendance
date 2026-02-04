# Android Push Notifications Setup Guide

## Prerequisites

- Node.js and npm installed
- Android Studio installed
- Firebase project created
- Windows, macOS, or Linux computer

## Step 1: Firebase Setup

### 1.1 Create/Open Firebase Project

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Create a new project or select existing one
3. Project name: **GeoShift Attendance**

### 1.2 Add Android App to Firebase

1. In Firebase Console, click **Add app** → **Android**
2. Fill in:
   - **Android package name**: `com.geoshift.attendance`
     (must match `appId` in capacitor.config.ts)
   - **App nickname**: GeoShift Attendance (optional)
   - **Debug signing certificate SHA-1**: (optional, for testing)

3. Click **Register app**

### 1.3 Download google-services.json

1. Download `google-services.json` file
2. You'll place this file in the Android project later

### 1.4 Enable Cloud Messaging

1. In Firebase Console, go to **Project Settings**
2. Go to **Cloud Messaging** tab
3. Note your **Server Key** (for backend use)

## Step 2: Add Android Platform

```bash
# Add Android platform
npx cap add android

# Build web assets
npm run build

# Sync to Android
npx cap sync android
```

## Step 3: Configure Android Project

### 3.1 Place google-services.json

Copy the downloaded `google-services.json` to:
```
android/app/google-services.json
```

### 3.2 Update build.gradle Files

The files should already be configured, but verify:

**android/build.gradle** (project-level):
```gradle
buildscript {
    dependencies {
        // Check this line exists
        classpath 'com.google.gms:google-services:4.3.15'
    }
}
```

**android/app/build.gradle** (app-level):
```gradle
// At the bottom of the file, add:
apply plugin: 'com.google.gms.google-services'
```

### 3.3 Update AndroidManifest.xml

The manifest is at `android/app/src/main/AndroidManifest.xml`

Add these permissions (if not already present):
```xml
<manifest ...>
    <!-- Internet permission -->
    <uses-permission android:name="android.permission.INTERNET" />

    <!-- Push notifications -->
    <uses-permission android:name="android.permission.POST_NOTIFICATIONS"/>
    <uses-permission android:name="android.permission.WAKE_LOCK" />
    <uses-permission android:name="com.google.android.c2dm.permission.RECEIVE" />
</manifest>
```

## Step 4: Open in Android Studio

```bash
npx cap open android
```

Android Studio will open. Wait for Gradle sync to complete.

## Step 5: Build and Run

### 5.1 Using Android Studio

1. Connect Android device via USB OR start an emulator
2. Enable **USB Debugging** on device (Settings → Developer Options)
3. Click **Run** button (green play icon) in Android Studio
4. Select your device
5. Wait for build and installation

### 5.2 Using Command Line

```bash
# Build APK
cd android
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug
```

## Step 6: Test Push Notifications

### 6.1 Enable Notifications in App

1. Open the app on your Android device
2. Go to **Settings** → **Notifications** section
3. Click **تفعيل الإشعارات** (Enable Notifications)
4. Grant permission when Android prompts

### 6.2 Send Test Notification

1. Still in Settings → Notifications
2. Click **إرسال إشعار تجريبي** (Send Test Notification)
3. You should receive a notification

### 6.3 Verify in Supabase

1. Open Supabase dashboard
2. Go to **Table Editor** → `push_devices` table
3. You should see a new row with:
   - platform: `android`
   - token: FCM token (long string)
   - enabled: `true`

## Step 7: Build Production APK/AAB

### 7.1 Generate Signing Key

```bash
# Create a keystore
keytool -genkey -v -keystore geoshift-release-key.keystore -alias geoshift -keyalg RSA -keysize 2048 -validity 10000
```

Follow prompts and remember your passwords!

### 7.2 Configure Signing

Create `android/app/keystore.properties`:
```properties
storePassword=YOUR_STORE_PASSWORD
keyPassword=YOUR_KEY_PASSWORD
keyAlias=geoshift
storeFile=../geoshift-release-key.keystore
```

**Important**: Add `keystore.properties` to `.gitignore`!

### 7.3 Build Release APK

```bash
cd android
./gradlew assembleRelease
```

APK will be at: `android/app/build/outputs/apk/release/app-release.apk`

### 7.4 Build App Bundle (for Google Play)

```bash
cd android
./gradlew bundleRelease
```

AAB will be at: `android/app/build/outputs/bundle/release/app-release.aab`

## Step 8: Troubleshooting

### Notifications Not Working?

1. **Check google-services.json**:
   - Is it in `android/app/` folder?
   - Does package name match `com.geoshift.attendance`?

2. **Check Firebase**:
   - Is Cloud Messaging enabled?
   - Check Firebase Console for errors

3. **Check Permissions**:
   - Did user grant notification permission?
   - Check Android Settings → Apps → GeoShift → Notifications

4. **Check Logcat**:
   - In Android Studio, open **Logcat**
   - Filter by "capacitor" or "firebase"
   - Look for error messages

### Common Issues

**Issue**: "google-services.json not found"
**Solution**: Make sure file is in `android/app/` folder and run `npx cap sync`

**Issue**: "Package name mismatch"
**Solution**: Ensure package name matches in:
- capacitor.config.ts (`appId`)
- android/app/build.gradle (`applicationId`)
- google-services.json (`package_name`)

**Issue**: FCM token not received
**Solution**:
- Check internet connection
- Verify google-services.json is correct
- Check Logcat for FCM errors
- Try clearing app data and reinstalling

**Issue**: Notifications not appearing
**Solution**:
- Check if notifications are enabled in Android Settings
- Verify token is saved in Supabase `push_devices` table
- Test with Firebase Console → Cloud Messaging → Send test message

## Testing on Multiple Devices

You can test on multiple Android devices simultaneously:

1. Each device will get a unique FCM token
2. Tokens are automatically saved with unique `device_id`
3. Test notification goes to the most recently active device
4. All enabled devices will receive real notifications

## Firebase Cloud Messaging (FCM) Notes

- FCM is free for unlimited messages
- Tokens can expire - app automatically refreshes them
- Tokens are device-specific (different per device)
- App can have multiple tokens (one per device)

## Resources

- [Capacitor Android Setup](https://capacitorjs.com/docs/android)
- [Firebase Cloud Messaging](https://firebase.google.com/docs/cloud-messaging/android/client)
- [Android Notifications Guide](https://developer.android.com/develop/ui/views/notifications)
- [Capacitor Push Notifications Plugin](https://capacitorjs.com/docs/apis/push-notifications)
