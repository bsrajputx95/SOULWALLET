# =============================================================================
# SOULWALLET PROGUARD/R8 RULES
# =============================================================================
# Comprehensive ProGuard rules for production builds
# These rules ensure all critical libraries work correctly after obfuscation
#
# For more details, see:
#   http://developer.android.com/guide/developing/tools/proguard.html
#
# =============================================================================
# TODO: OPTIMIZATION PASS SCHEDULED
# =============================================================================
# These rules are intentionally broad to ensure functionality during initial
# production deployment. Schedule a follow-up optimization pass to:
#
# 1. Use R8's -whyareyoukeeping output to identify which rules are actually
#    triggered during the build
#
# 2. Systematically verify which keep patterns are needed by:
#    - Running: ./gradlew assembleRelease -Pandroid.enableR8.fullMode=true
#    - Testing all critical wallet flows after each rule removal
#    - Using scripts/test-android-build.sh to validate functionality
#
# 3. Patterns to review for potential removal/narrowing:
#    - **Crypto**, **crypto**, **Cipher**, **cipher**, **Key**, **key** (very broad)
#    - Vendor-specific packages not in dependency tree (io.parity.**, etc.)
#    - Duplicate rules (some classes covered by parent package rules)
#
# 4. After each adjustment:
#    - Run: npm run test:android:full
#    - Test: wallet creation, signing, swapping, copy trading
#    - Monitor: APK size reduction and Sentry for runtime errors
#
# Target: Balance maximum code shrinking with production stability
# =============================================================================

# =============================================================================
# OPTIMIZATION SETTINGS
# =============================================================================
-optimizationpasses 5
-dontusemixedcaseclassnames
-verbose
-dontpreverify

# Preserve line numbers for stack traces (critical for debugging)
-keepattributes SourceFile,LineNumberTable
-renamesourcefileattribute SourceFile

# Keep annotations for reflection
-keepattributes *Annotation*
-keepattributes Signature
-keepattributes Exceptions
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# =============================================================================
# REACT NATIVE CORE
# =============================================================================
# Keep React Native bridge classes
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }

# Keep TurboModules and Fabric components
-keep class com.facebook.react.turbomodule.** { *; }
-keep class com.facebook.react.fabric.** { *; }
-keep class com.facebook.react.bridge.** { *; }
-keep class com.facebook.react.uimanager.** { *; }
-keep class com.facebook.react.views.** { *; }
-keep class com.facebook.react.modules.** { *; }

# Keep JSC (fallback JavaScript engine)
-keep class org.webkit.** { *; }
-keep class com.facebook.jsc.** { *; }

# Keep native methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# =============================================================================
# REACT NATIVE REANIMATED
# =============================================================================
-keep class com.swmansion.reanimated.** { *; }
-keep class com.swmansion.gesturehandler.** { *; }

# =============================================================================
# REACT NATIVE GESTURE HANDLER
# =============================================================================
-keep class com.swmansion.gesturehandler.react.** { *; }

# =============================================================================
# REACT NATIVE SVG
# =============================================================================
-keep class com.horcrux.svg.** { *; }

# =============================================================================
# EXPO MODULES
# =============================================================================
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }

# Expo Secure Store (critical for wallet security)
-keep class expo.modules.securestore.** { *; }

# Expo Clipboard
-keep class expo.modules.clipboard.** { *; }

# Expo Haptics
-keep class expo.modules.haptics.** { *; }

# Expo Linking
-keep class expo.modules.linking.** { *; }

# Expo Image
-keep class expo.modules.image.** { *; }

# Expo Constants
-keep class expo.modules.constants.** { *; }

# =============================================================================
# SOLANA & CRYPTO LIBRARIES (CRITICAL FOR WALLET FUNCTIONALITY)
# =============================================================================
# These rules are essential - without them, wallet operations will fail!

# Keep all crypto-related classes
-keep class org.bouncycastle.** { *; }
-keep class org.spongycastle.** { *; }

# TweetNaCl (Ed25519 signing)
-keep class com.nicholasding.tweetnacl.** { *; }
-keep class org.libsodium.** { *; }

# BIP39 mnemonic generation
-keep class io.github.novacrypto.** { *; }
-keep class cash.z.ecc.android.bip39.** { *; }

# Ed25519 HD key derivation
-keep class io.parity.** { *; }

# BS58 encoding (Solana addresses)
-keep class io.matthewnelson.encoding.** { *; }

# Crypto-JS
-keep class org.nicholasding.cryptojs.** { *; }

# Keep all classes with crypto in the name
-keep class **Crypto** { *; }
-keep class **crypto** { *; }
-keep class **Cipher** { *; }
-keep class **cipher** { *; }
-keep class **Key** { *; }
-keep class **key** { *; }

# =============================================================================
# ASYNC STORAGE
# =============================================================================
-keep class com.reactnativecommunity.asyncstorage.** { *; }

# =============================================================================
# REACT NATIVE QR CODE
# =============================================================================
-keep class com.github.nicholasding.qrcode.** { *; }

# =============================================================================
# SENTRY ERROR TRACKING
# =============================================================================
-keep class io.sentry.** { *; }
-keep class io.sentry.android.** { *; }
-keep class io.sentry.react.** { *; }

# Preserve stack traces for Sentry
-keepattributes SourceFile,LineNumberTable
-keep public class * extends java.lang.Exception

# =============================================================================
# NETWORKING & HTTP
# =============================================================================
-keep class okhttp3.** { *; }
-keep class okio.** { *; }
-keep class retrofit2.** { *; }

# =============================================================================
# JSON SERIALIZATION
# =============================================================================
-keep class com.google.gson.** { *; }
-keep class org.json.** { *; }

# Keep classes that use @SerializedName
-keepclassmembers class * {
    @com.google.gson.annotations.SerializedName <fields>;
}

# =============================================================================
# ENUMS
# =============================================================================
-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# =============================================================================
# PARCELABLE
# =============================================================================
-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# =============================================================================
# SERIALIZABLE
# =============================================================================
-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# =============================================================================
# WEBVIEW
# =============================================================================
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String, android.graphics.Bitmap);
    public boolean *(android.webkit.WebView, java.lang.String);
}
-keepclassmembers class * extends android.webkit.WebViewClient {
    public void *(android.webkit.WebView, java.lang.String);
}

# =============================================================================
# FRESCO (IMAGE LOADING)
# =============================================================================
-keep class com.facebook.fresco.** { *; }
-keep class com.facebook.imagepipeline.** { *; }
-keep class com.facebook.drawee.** { *; }

# =============================================================================
# HERMES ENGINE
# =============================================================================
-keep class com.facebook.hermes.unicode.** { *; }
-keep class com.facebook.jni.** { *; }

# =============================================================================
# ADDITIONAL REACT NATIVE LIBRARIES
# =============================================================================
# React Native Share
-keep class cl.json.** { *; }

# React Native Screens
-keep class com.swmansion.rnscreens.** { *; }

# React Native Safe Area Context
-keep class com.th3rdwave.safeareacontext.** { *; }

# =============================================================================
# SUPPRESS WARNINGS
# =============================================================================
-dontwarn com.facebook.react.**
-dontwarn com.facebook.hermes.**
-dontwarn org.bouncycastle.**
-dontwarn org.conscrypt.**
-dontwarn okhttp3.**
-dontwarn okio.**
-dontwarn javax.annotation.**
-dontwarn org.codehaus.mojo.animal_sniffer.**

# =============================================================================
# PROJECT SPECIFIC RULES
# =============================================================================
# Add any additional project-specific keep rules below this line
