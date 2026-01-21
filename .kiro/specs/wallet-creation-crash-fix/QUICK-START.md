# Quick Start - Fix Metro Bundler & Test Wallet Creation

## TL;DR - Run These Commands

```bash
# 1. Clean everything
npm cache clean --force
rmdir /s /q node_modules
del package-lock.json

# 2. Fresh install
npm install

# 3. Start Metro with clean cache
npx expo start --clear
```

Then:
1. Open Expo Go on your phone
2. Scan QR code
3. Test wallet creation
4. Watch console for logs

## What This Does

- **Fixes Metro bundler error** - "Requiring unknown module '178'"
- **Allows app to load in Expo Go** - So we can test wallet creation
- **Enables real-time logging** - So we can see exactly where it crashes

## Expected Timeline

- **Clean & install:** 5-10 minutes
- **Metro start:** 1-2 minutes
- **App load in Expo Go:** 30-60 seconds
- **Test wallet creation:** 1 minute

**Total:** ~15 minutes (vs 30-40 minutes for APK build)

## What to Watch For

When you tap "Create New Wallet", watch the console for these logs:

```
[Wallet] Starting wallet creation...
[Wallet] Importing WalletManager...
[Wallet] Creating new wallet with encryption...
[Wallet] Wallet created successfully
[Wallet] Storing wallet metadata...
[Wallet] Wallet metadata stored
[Wallet] Syncing to backend (non-blocking)...
```

**If it crashes**, you'll see which step it fails at.

## Possible Outcomes

### Outcome 1: Metro Bundler Still Errors
- See `METRO-BUNDLER-FIX.md` for advanced troubleshooting
- May need to use `npx expo run:android` instead

### Outcome 2: App Loads But Wallet Still Crashes
- We'll see exactly where in the logs
- Can then fix the specific issue
- Much faster than APK build cycle

### Outcome 3: Wallet Creation Works! 🎉
- Problem was Metro bundler cache all along
- Test thoroughly to confirm
- Can then build production APK

## Why This Approach

**Before:** 
- Build APK (30-40 min)
- Install on phone
- Test
- Crash with no logs
- Repeat

**Now:**
- Fix Metro (10 min)
- Test with Expo Go (instant)
- See real-time logs
- Fix specific issue
- Repeat quickly

## If You're in a Hurry

**Minimum steps:**
```bash
npx expo start --clear
```

This might be enough if it's just a cache issue.

**If that doesn't work:**
```bash
rmdir /s /q node_modules
npm install
npx expo start --clear
```

**Nuclear option (if still broken):**
```bash
npm cache clean --force
rmdir /s /q node_modules
rmdir /s /q .expo
del package-lock.json
npm install
npx expo start --clear
```

## Questions?

- **Will this affect my database?** No, Railway DB is separate
- **Will this affect my code changes?** No, just cleans build artifacts
- **Will Expo Go connect to Railway?** Yes, if your .env has DATABASE_URL
- **Do I need to redeploy backend?** No, backend is unchanged
- **Can I still build APK after?** Yes, this doesn't affect APK builds

## Next Steps After Testing

Once we see the logs and identify the exact crash point:
1. Fix the specific issue
2. Test again with Expo Go (instant feedback)
3. Once working, build production APK
4. Deploy and celebrate! 🚀
