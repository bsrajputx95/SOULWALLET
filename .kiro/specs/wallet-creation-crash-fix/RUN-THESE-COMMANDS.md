# Commands to Run - Metro Bundler Fix

## Status
✅ Cache cleaned
✅ .expo folder deleted  
✅ package-lock.json deleted
⏳ npm install is running (takes 5-10 minutes)

## What's Happening Now

`npm install` is currently running in your terminal. It's downloading and installing all dependencies. This is normal and takes time.

**You'll see warnings like:**
- "deprecated" packages - These are normal, ignore them
- Lots of packages being installed - This is expected

**Wait for it to finish.** You'll know it's done when you see:
```
added XXXX packages in XXs
```

## After npm install Finishes

Run this command:
```bash
npx expo start --clear
```

This will:
1. Start Metro bundler with clean cache
2. Show you a QR code
3. Display the local URL

## Then Test with Expo Go

1. Open Expo Go app on your phone
2. Scan the QR code
3. Wait for app to load (30-60 seconds first time)
4. Navigate to: Portfolio → Settings → Create Wallet
5. Enter password and confirm
6. Tap "Create New Wallet"
7. **Watch your computer console for logs**

## What to Look For

In your terminal, you should see logs like:
```
[Wallet] Starting wallet creation...
[Wallet] Importing WalletManager...
[Wallet] Creating new wallet with encryption...
[Wallet] Wallet created successfully
[Wallet] Storing wallet metadata...
[Wallet] Wallet metadata stored
```

**If it crashes**, you'll see exactly which step it fails at.

## If npm install Fails

If you see errors during npm install, try:
```bash
npm install --legacy-peer-deps
```

## If Metro Bundler Shows Errors

If `npx expo start --clear` shows errors, try:
```bash
# Nuclear option - delete everything and start fresh
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .expo -ErrorAction SilentlyContinue
Remove-Item package-lock.json -ErrorAction SilentlyContinue
npm install
npx expo start --clear
```

## If Expo Go Can't Connect

- Make sure phone and PC are on same WiFi
- Try tunnel mode: `npx expo start --tunnel`
- Check Windows Firewall isn't blocking Metro

## Quick Reference

**Clean everything:**
```bash
npm cache clean --force
Remove-Item -Recurse -Force node_modules
Remove-Item -Recurse -Force .expo
Remove-Item package-lock.json
```

**Install:**
```bash
npm install
```

**Start Metro:**
```bash
npx expo start --clear
```

**Alternative (if Expo Go doesn't work):**
```bash
npx expo run:android
```

## Expected Timeline

- npm install: 5-10 minutes (currently running)
- Metro start: 1-2 minutes
- App load in Expo Go: 30-60 seconds
- Test wallet creation: 1 minute

**Total:** ~15 minutes

## What This Fixes

This fixes the Metro bundler error "Requiring unknown module '178'" by:
1. Clearing all caches
2. Reinstalling all dependencies fresh
3. Rebuilding the module graph from scratch

## Next Steps After Testing

Once you test and see the logs:
1. If wallet creation works → Build production APK and celebrate! 🎉
2. If it still crashes → We'll see exactly where and fix that specific issue

## Questions?

- **Is npm install stuck?** No, it's just slow. Wait for it.
- **Can I cancel and restart?** Yes, but you'll have to wait again.
- **Will this affect my database?** No, Railway DB is separate.
- **Will this affect my code?** No, just reinstalling dependencies.

## Current Status

Right now, `npm install` is running. Just wait for it to complete, then run:
```bash
npx expo start --clear
```

And test with Expo Go!
