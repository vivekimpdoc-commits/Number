# APK Build Instructions (Sentinel Whitelist Booklet)

This React system contains a fully compatible, 100% offline-ready database layer powered by client-side `localStorage`. It dynamically detects when it is installed inside a mobile format (using user-agents or `file://` protocols) and defaults to **Offline APK Storage** mode automatically, enabling high-performance contact whitelisting with zero web backend requirements!

Here is how you can easily packaging this project into an Android APK on your machine.

---

## Prerequisite Requirements
Ensure you have the following installed on your machine:
1. **Node.js** (v18 or higher)
2. **Android Studio** (with Android SDK installed)
3. **Java Development Kit (JDK 17)**

---

## Step-by-Step Compilation Guide

### Step 1: Export/Download the Source Code
Export this project as a ZIP archive from the top-right settings menu in Google AI Studio, and extract it into a folder on your computer.

### Step 2: Open a Terminal in the Project Folder
Open your command line/terminal in the extracted folder and install the base web dependencies:
```bash
npm install
```

### Step 3: Run the Offical Web Build
First, compile the sanitized optimized production static assets:
```bash
npm run build
```
This compilation creates the `dist/` directory containing all your high-speed offline HTML, JS, and CSS files.

### Step 4: Add Capacitor to Your Project
We use **Capacitor** (maintained by Ionic), which is the modern industry standard for converting web applications to high-performance native Android apps. Install the core packages:
### Install Capacitor CLI:
```bash
npm install @capacitor/core
npm install --save-dev @capacitor/cli @capacitor/android
```

### Step 5: Initialize Capacitor Config
Initialize the capacitor configuration setup:
```bash
npx cap init "Sentinel Booklet" "com.sentinel. whitelistbooklet" --web-dir=dist
```
*(You can customize the package ID `com.sentinel.whitelistbooklet` if you want).*

### Step 6: Create the Android Platform
Inject and build the native Android container files:
```bash
npx cap add android
```
This creates an `android/` directory in your root folder ready to build with Gradle.

### Step 7: Sync the Web Assets
Whenever you make changes to your React UI code, rebuild the web project and sync it with the Android container:
```bash
npm run build
npx cap sync
```

### Step 8: Build the APK inside Android Studio
Launch the folder inside Android Studio:
```bash
npx cap open android
```
1. Android Studio will open and index your Android folder automatically.
2. Wait for Gradle indexing to complete (usually takes 1-2 minutes on the first startup).
3. In the top toolbar, click **Build** -> **Build Bundle(s) / APK(s)** -> **Build APK(s)**.
4. When finished, a popup will display in Android Studio: click **Locate** to retrieve your compiled, ready-to-install debug **`app-debug.apk`** file!

---

## Standalone Features inside APK Mode
- **Dual Mode Memory:** Even inside the APK, we have left the option to swap back to "Cloud Sync" if your dispatch officers require centralized cloud database backup sync.
- **Offline Importers:** The CSV / VCF backup import capabilities use direct client-side stream parsers, meaning that parsing lists can be done 100% offline.
- **Dynamic Local Search:** Search, sort, bookmark, and filter work instantly, operating securely in the sandbox.
