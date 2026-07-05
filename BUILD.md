# Building UMS Dashboard and Android App

This document describes how to build standalone executables for Linux and Windows, as well as the mobile Android application.

## Prerequisites

1. Install **Node.js** (v18 is recommended as specified in `package.json`).
2. Install project dependencies:
   ```bash
   npm install
   ```

## Step 1: Package Executables using `pkg`

The application uses `pkg` to package the Node.js application into single executables. The build targets and asset configuration are defined in `package.json` under the `"pkg"` property.

Run the following command to compile the Linux and Windows binaries:
```bash
npx pkg . --out-path dist
```
This command generates:
- `dist/ums-linux` (Linux executable)
- `dist/ums-win.exe` (Windows executable)

## Step 2: Bundle with Platform Dependencies

Because the app depends on native SQLite bindings (`better-sqlite3`) and external launcher utilities (`xdg-open`), these native assets must be distributed alongside the executables.

### For Linux:
1. Keep/copy the existing files in `build/linux/`:
   - `auth.db` (Database)
   - `better_sqlite3.node` (Native SQLite addon)
   - `test_extension.node` (Helper native extension)
   - `xdg-open` (URL launcher tool)
2. Replace the old `build/linux/ums-linux` with the new one generated in `dist/ums-linux`:
   ```bash
   cp dist/ums-linux build/linux/ums-linux
   ```

### For Windows:
1. Keep/copy the existing files in `build/win/`:
   - `auth.db` (Database)
   - `better_sqlite3.node` (Native SQLite addon)
2. Replace the old `build/win/ums-win.exe` with the new one generated in `dist/ums-win.exe`:
   ```bash
   cp dist/ums-win.exe build/win/ums-win.exe
   ```

## Step 3: Create Zipped Releases

Zip the contents of the final build directories directly (do not include the outer directory name in the archive paths) using the naming convention `<os>-<version>.zip`.

For example, if the current version in `package.json` is `1.2.0`:

### Linux Release:
Set your terminal working directory to `build/linux` and run:
```bash
zip -r ../linux-1.2.0.zip .
```
This produces `build/linux-1.2.0.zip`.

### Windows Release:
Set your terminal working directory to `build/win` and run:
```bash
zip -r ../win-1.2.0.zip .
```
This produces `build/win-1.2.0.zip`.

## Step 4: Cleanup
You can safely remove the temporary `dist/` directory after files are copied:
```bash
rm -rf dist
```

---

## Building the Android Mobile App

The mobile application is built using Capacitor.

### Prerequisites

1. Set up the Android SDK (Android Studio is recommended).
2. Set the `ANDROID_HOME` or `ANDROID_SDK_ROOT` environment variables if they are not already set.

### Build Steps

1. Sync the web assets (from the `public` directory) with Capacitor:
   ```bash
   npx cap sync android
   ```
2. Build the Android application in release mode using the Gradle wrapper:
   ```bash
   cd android
   ./gradlew assembleRelease
   ```
3. The generated release APK will be located at `android/app/build/outputs/apk/release/app-release.apk`.
4. Copy the compiled APK to the root directory, naming it based on the version in `package.json` (e.g. `SGP-v1.2.1.apk`):
   ```bash
   cp android/app/build/outputs/apk/release/app-release.apk ../SGP-v<version>.apk
   ```
