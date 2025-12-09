# SoulWallet Android Build & Deployment Guide

Comprehensive guide for building, testing, and deploying the SoulWallet Android app.

## Table of Contents

1. [Introduction](#introduction)
2. [Build Configuration](#build-configuration)
3. [Development Builds](#development-builds)
4. [Beta/Testing Builds](#betatesting-builds)
5. [Production Builds](#production-builds)
6. [Optimization Strategies](#optimization-strategies)
7. [Testing Checklist](#testing-checklist)
8. [Play Store Submission](#play-store-submission)
9. [Version Management](#version-management)
10. [Troubleshooting](#troubleshooting)
11. [CI/CD Integration](#cicd-integration)
12. [Best Practices](#best-practices)

---

## Introduction

### Overview

SoulWallet uses Expo with EAS Build for Android deployment. The build pipeline supports:

- **Development**: Local builds with hot reload
- **Beta APK**: Internal testing with optimizations
- **Preview**: Internal distribution with production config
- **Production**: Play Store release (AAB format)

### Required Tools

- Node.js v18+
- EAS CLI: `npm install -g eas-cli`
- Android SDK (optional for local builds)
- Java 17+ (for local builds)

### Build Profiles

| Profile | Distribution | Format | Optimizations |
|---------|-------------|--------|---------------|
| development | internal | APK | None (debug) |
| beta-apk | internal | APK | ProGuard, splits |
| preview | internal | APK | Full production |
| production | store | AAB | Full production |

---

## Build Configuration

### android/app/build.gradle

Key configuration settings:

```groovy
// ProGuard/R8 enabled via gradle.properties
def enableProguardInReleaseBuilds = findProperty('android.enableProguardInReleaseBuilds')

// APK splits for size optimization
splits {
    abi {
        enable true
        include 'armeabi-v7a', 'arm64-v8a', 'x86', 'x86_64'
        universalApk true
    }
}

// App bundle configuration
bundle {
    density { enableSplit = true }
    abi { enableSplit = true }
}
```

### android/gradle.properties

Production optimization flags:

```properties
# Enable ProGuard/R8 minification
android.enableProguardInReleaseBuilds=true

# Enable resource shrinking
android.enableShrinkResourcesInReleaseBuilds=true

# Enable R8 full mode
android.enableR8.fullMode=true
```

### eas.json

EAS Build profiles configuration:

```json
{
  "build": {
    "beta-apk": {
      "distribution": "internal",
      "android": {
        "buildType": "apk",
        "gradleCommand": ":app:assembleRelease"
      }
    },
    "production": {
      "distribution": "store",
      "autoIncrement": true,
      "android": {
        "buildType": "app-bundle"
      }
    }
  }
}
```

---

## Development Builds

### Local Development

```bash
# Start Metro bundler
npm start

# Run on connected device/emulator
npm run android

# Or with Expo CLI
npx expo run:android
```

### Development Client

```bash
# Build development client
eas build --platform android --profile development

# Install and run
adb install path/to/app.apk
```

### Hot Reload

Development builds support:
- Fast Refresh for JS changes
- Native module hot reload
- Error overlay with stack traces

---

## Beta/Testing Builds

### Build Beta APK

```bash
# Using npm script
npm run build:android:beta

# Or directly with EAS
eas build --platform android --profile beta-apk
```

### Local Beta Build

```bash
# Build locally (requires Android SDK)
npm run build:android:local

# Or
eas build --platform android --profile beta-apk --local
```

### Testing Beta Builds

```bash
# Run comprehensive tests
npm run test:android:full

# Quick test
npm run test:android:quick
```

### Distribution

Beta APKs can be distributed via:
- EAS internal distribution
- Direct APK sharing
- Firebase App Distribution
- TestFlight alternative services

---

## Production Builds

### Build Production AAB

```bash
# Using npm script
npm run build:android:production

# Or directly with EAS
eas build --platform android --profile production
```

### Pre-Production Checklist

1. **Version bump**: `npm run version:patch`
2. **Asset optimization**: `npm run optimize:assets`
3. **Run tests**: `npm run test:android:full`
4. **Build size check**: `npm run analyze:build-size`

### Signing Configuration

Production builds use EAS-managed credentials:

```bash
# Configure credentials
eas credentials

# View current credentials
eas credentials --platform android
```

For manual keystore management:
```bash
# Generate keystore
keytool -genkey -v -keystore soulwallet-release.keystore \
  -alias soulwallet -keyalg RSA -keysize 2048 -validity 10000
```

---

## Optimization Strategies

### ProGuard/R8 Rules

Located in `android/app/proguard-rules.pro`:

```proguard
# React Native Core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }

# Solana & Crypto (CRITICAL)
-keep class org.bouncycastle.** { *; }
-keep class **Crypto** { *; }

# Sentry
-keep class io.sentry.** { *; }
```

### APK Splits

Reduces APK size by 60-70%:

| Architecture | Typical Size |
|-------------|-------------|
| Universal | ~50MB |
| arm64-v8a | ~18MB |
| armeabi-v7a | ~16MB |
| x86_64 | ~20MB |
| x86 | ~18MB |

### Asset Optimization

```bash
# Full optimization
npm run optimize:assets

# Icons only
npm run optimize:icons

# WebP conversion
npm run optimize:webp
```

### Bundle Size Analysis

```bash
# Analyze latest build
npm run analyze:build-size

# Analyze specific APK
node scripts/analyze-build-size.js --apk path/to/app.apk

# View history
node scripts/analyze-build-size.js --history
```

---

## Testing Checklist

### Pre-Build Testing

```bash
# Type check
npm run type-check

# Lint
npm run lint

# Unit tests
npm run test:unit

# Integration tests
npm run test:integration
```

### Post-Build Testing

- [ ] Install APK on test devices
- [ ] Test on minimum API level (24)
- [ ] Test on latest API level (34)
- [ ] Verify ProGuard didn't break functionality
- [ ] Test critical flows:
  - [ ] User signup/login
  - [ ] Wallet creation
  - [ ] Wallet import
  - [ ] Send transaction
  - [ ] Token swap
  - [ ] Copy trading

### Multi-Device Testing

```bash
# Run full test suite
npm run test:android:full

# Test specific API levels
bash scripts/test-android-build.sh --api-levels 24,29,34
```

---

## Play Store Submission

### Prerequisites

1. Google Play Console account
2. App signing key (managed by EAS)
3. Store listing assets

### Store Listing Assets

| Asset | Size | Format |
|-------|------|--------|
| App icon | 512x512 | PNG |
| Feature graphic | 1024x500 | PNG/JPG |
| Phone screenshots | 1080x1920 | PNG/JPG |
| Tablet screenshots | 1920x1200 | PNG/JPG |

### Submission Process

```bash
# Build production AAB
npm run build:android:production

# Submit to Play Store
npm run submit:android
```

Or manually:
1. Download AAB from EAS
2. Upload to Play Console
3. Configure release track
4. Submit for review

### Release Tracks

| Track | Purpose |
|-------|---------|
| Internal | Team testing (up to 100 users) |
| Closed | Beta testing (invite only) |
| Open | Public beta |
| Production | Full release |

---

## Version Management

### Semantic Versioning

```bash
# Patch release (bug fixes): 1.0.0 → 1.0.1
npm run version:patch

# Minor release (new features): 1.0.1 → 1.1.0
npm run version:minor

# Major release (breaking changes): 1.1.0 → 2.0.0
npm run version:major
```

### Version Code Calculation

Formula: `(major * 10000) + (minor * 100) + patch`

Examples:
- 1.0.0 → 10000
- 1.2.3 → 10203
- 2.0.0 → 20000

### Files Updated

The version bump script updates:
- `app.json` (version, versionCode)
- `package.json` (version)
- `android/app/build.gradle` (versionCode, versionName)

---

## Troubleshooting

### Common Build Errors

#### ProGuard Missing Class Errors

```
Warning: class X not found
```

**Solution**: Add keep rule to `proguard-rules.pro`:
```proguard
-keep class X { *; }
```

#### Signing Errors

```
Keystore was tampered with, or password was incorrect
```

**Solution**: 
- Verify keystore password
- Check EAS credentials: `eas credentials`

#### Out of Memory

```
Java heap space
```

**Solution**: Increase Gradle JVM args in `gradle.properties`:
```properties
org.gradle.jvmargs=-Xmx4096m
```

#### Duplicate Class Errors

```
Duplicate class X found in modules Y and Z
```

**Solution**: Add exclusion in `build.gradle`:
```groovy
packagingOptions {
    exclude 'META-INF/DEPENDENCIES'
}
```

### Runtime Errors

#### Crypto Operations Failing

Check ProGuard keeps for:
- `org.bouncycastle.**`
- `tweetnacl`
- `ed25519-hd-key`

#### tRPC Calls Failing

Ensure SuperJSON and Zod classes are kept:
```proguard
-keep class superjson.** { *; }
-keep class zod.** { *; }
```

### Performance Issues

#### Slow Startup

1. Profile with Android Studio
2. Check JS bundle size
3. Enable Hermes (should be default)
4. Lazy load heavy components

#### Large APK Size

1. Run `npm run analyze:build-size`
2. Enable APK splits
3. Optimize assets
4. Remove unused dependencies

---

## CI/CD Integration

### GitHub Actions

See `.github/workflows/android-build.yml` for automated:
- Build validation on PRs
- Beta builds on main branch
- Production builds on tags
- Play Store submission

### Environment Variables

Required secrets:
- `EXPO_TOKEN`: EAS authentication
- `SENTRY_AUTH_TOKEN`: Error tracking
- `GOOGLE_SERVICES_KEY`: Play Store submission

### Build Triggers

| Event | Action |
|-------|--------|
| PR to main | Validate build |
| Push to main | Build beta APK |
| Tag v* | Build production AAB |
| Manual | Any profile |

---

## Best Practices

### Development

1. Always test on minimum API level (24)
2. Test with ProGuard enabled before release
3. Monitor APK size over time
4. Keep dependencies updated

### Security

1. Never commit keystores to git
2. Use EAS-managed credentials
3. Enable `allowBackup: false` for wallet apps
4. Rotate signing keys periodically

### Performance

1. Enable Hermes JS engine
2. Use APK splits for distribution
3. Optimize images (WebP format)
4. Lazy load heavy screens

### Release

1. Test on multiple devices
2. Start with internal/closed testing
3. Monitor crash reports (Sentry)
4. Gradual rollout (10% → 50% → 100%)

---

## Reference Links

- [EAS Build Documentation](https://docs.expo.dev/build/introduction/)
- [Android App Signing](https://docs.expo.dev/app-signing/app-credentials/)
- [ProGuard Manual](https://www.guardsquare.com/manual/configuration/usage)
- [Play Store Guidelines](https://developer.android.com/distribute/best-practices/launch)
- [React Native Performance](https://reactnative.dev/docs/performance)

---

## Appendix

### Complete ProGuard Rules Reference

See `android/app/proguard-rules.pro` for full configuration.

### Gradle Properties Reference

See `android/gradle.properties` for all build flags.

### EAS Build Profiles Reference

See `eas.json` for all profile configurations.

### Version Code Examples

| Version | Version Code |
|---------|-------------|
| 1.0.0 | 10000 |
| 1.0.1 | 10001 |
| 1.1.0 | 10100 |
| 1.2.3 | 10203 |
| 2.0.0 | 20000 |

---

*Last updated: November 2025*
