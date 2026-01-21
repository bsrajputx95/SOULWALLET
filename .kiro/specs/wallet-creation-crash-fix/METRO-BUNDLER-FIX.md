# Metro Bundler Error Fix - "Requiring unknown module '178'"

## Problem
When trying to run the app with Expo Go, you're getting:
```
Error: Requiring unknown module '178'
```

This is a Metro bundler module resolution error that prevents the app from even loading. This needs to be fixed BEFORE we can test the wallet creation fixes.

## Root Cause
This error typically occurs due to:
1. **Stale Metro cache** - Old module mappings cached
2. **Corrupted node_modules** - Incomplete or broken dependencies
3. **Module resolution conflicts** - Babel/Metro config issues

## Solution - Complete Clean & Rebuild

Run these commands in order:

### Step 1: Clean Everything
```bash
# Stop any running Metro bundler (Ctrl+C if running)

# Clean npm cache
npm cache clean --force

# Delete node_modules and lock file
rmdir /s /q node_modules
del package-lock.json

# Clean Metro bundler cache
npx expo start --clear

# Clean watchman cache (if you have it installed)
watchman watch-del-all
```

### Step 2: Fresh Install
```bash
# Reinstall all dependencies
npm install

# Verify installation completed successfully
npm list --depth=0
```

### Step 3: Start Metro with Clean Cache
```bash
# Start Metro bundler with reset cache
npx expo start --clear

# Or use npm script
npm start -- --clear
```

### Step 4: Test with Expo Go
1. Open Expo Go app on your phone
2. Scan the QR code from Metro bundler
3. Wait for app to load
4. Try creating a wallet

## If Still Not Working

### Option A: Check for Conflicting Dependencies
```bash
# Check for duplicate dependencies
npm ls react-native
npm ls @solana/web3.js
npm ls expo
```

If you see multiple versions, that's the problem. Fix with:
```bash
npm dedupe
```

### Option B: Verify Expo CLI Version
```bash
# Check Expo CLI version
npx expo --version

# Update if needed
npm install -g expo-cli@latest
```

### Option C: Check Node Version
```bash
# Check Node version (should be >= 20.0.0)
node --version

# If too old, update Node.js
```

### Option D: Try Development Build Instead of Expo Go
Expo Go has limitations with native modules. If the error persists, you might need a development build:

```bash
# Create development build
npx expo run:android
```

This takes longer but includes all native modules properly.

## What This Will Do

1. **Clear all caches** - Removes stale module mappings
2. **Fresh dependencies** - Ensures all packages are properly installed
3. **Reset Metro** - Forces Metro to rebuild module graph from scratch

## Expected Result

After these steps:
- Metro bundler should start without errors
- App should load in Expo Go
- You should see the login/home screen
- Then you can test wallet creation

## Next Steps After Metro Fix

Once the app loads successfully:
1. Navigate to Portfolio → Settings → Create Wallet
2. Enter password and confirm
3. Tap "Create New Wallet"
4. Watch the console logs for "[Wallet]" messages
5. If it crashes, we'll see exactly where in the logs

## Important Notes

- **This won't affect your database** - Railway DB is separate
- **This won't affect your code changes** - Just cleans build artifacts
- **Expo Go will connect to Railway DB** - As long as your .env has the correct DATABASE_URL
- **Takes 5-10 minutes** - Most time is npm install

## Troubleshooting

### If npm install fails:
```bash
# Try with legacy peer deps
npm install --legacy-peer-deps
```

### If Metro still shows errors:
```bash
# Nuclear option - delete everything and start fresh
rmdir /s /q node_modules
rmdir /s /q .expo
del package-lock.json
npm install
npx expo start --clear
```

### If Expo Go can't connect:
- Make sure phone and PC are on same WiFi
- Try tunnel mode: `npx expo start --tunnel`
- Check firewall isn't blocking Metro bundler

## Why This Happens

Metro bundler assigns numeric IDs to modules (like '178'). When:
1. Dependencies change
2. Cache gets corrupted
3. Build is interrupted

The module IDs can get out of sync, causing "unknown module" errors.

The fix is to clear all caches and rebuild the module graph from scratch.
