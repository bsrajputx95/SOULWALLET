# Add project specific ProGuard rules here.
# By default, the flags in this file are appended to flags specified
# in /usr/local/Cellar/android-sdk/24.3.3/tools/proguard/proguard-android.txt
# You can edit the include path and order by changing the proguardFiles
# directive in build.gradle.
#
# For more details, see
#   http://developer.android.com/guide/developing/tools/proguard.html

# ============================================
# SOULWALLET ENTERPRISE SECURITY OBFUSCATION
# ============================================

# ============================================
# 1. AGGRESSIVE CODE OBFUSCATION
# ============================================

# Enable aggressive optimizations
-optimizationpasses 5
-allowaccessmodification
-dontpreverify
-repackageclasses ''
-flattenpackagehierarchy ''

# Obfuscate all classes except explicitly kept
-obfuscationdictionary proguard-dictionary.txt
-classobfuscationdictionary proguard-dictionary.txt
-packageobfuscationdictionary proguard-dictionary.txt

# Remove debug info
-renamesourcefileattribute SourceFile
-keepattributes SourceFile,LineNumberTable

# ============================================
# 2. REACT NATIVE & EXPO KEEP RULES
# ============================================

# React Native core
-keep class com.facebook.react.** { *; }
-keep class com.facebook.hermes.** { *; }
-keep class com.facebook.jni.** { *; }
-dontwarn com.facebook.react.**

# React Native Reanimated
-keep class com.swmansion.reanimated.** { *; }
-keep class com.facebook.react.turbomodule.** { *; }

# Expo modules
-keep class expo.modules.** { *; }
-keep class host.exp.exponent.** { *; }
-dontwarn expo.modules.**

# Expo SecureStore
-keep class expo.modules.securestore.** { *; }

# Expo LocalAuthentication (biometrics)
-keep class expo.modules.localauthentication.** { *; }

# Expo Crypto
-keep class expo.modules.crypto.** { *; }

# ============================================
# 3. SOLANA & CRYPTO LIBRARIES
# ============================================

# Solana Web3.js (via React Native)
-keep class org.sol4k.** { *; }
-dontwarn org.sol4k.**

# Crypto libraries
-keep class org.bouncycastle.** { *; }
-dontwarn org.bouncycastle.**

# TweetNaCl
-keep class com.nicholasding.tweetnacl.** { *; }

# ============================================
# 4. NETWORKING & SECURITY
# ============================================

# OkHttp (for SSL pinning)
-keep class okhttp3.** { *; }
-keep interface okhttp3.** { *; }
-dontwarn okhttp3.**
-dontwarn okio.**

# Retrofit (if used)
-keep class retrofit2.** { *; }
-dontwarn retrofit2.**

# ============================================
# 5. SERIALIZATION
# ============================================

# Gson
-keep class com.google.gson.** { *; }
-keepattributes Signature
-keepattributes *Annotation*

# JSON parsing
-keep class org.json.** { *; }

# ============================================
# 6. SENTRY ERROR TRACKING
# ============================================

-keep class io.sentry.** { *; }
-dontwarn io.sentry.**

# ============================================
# 7. NATIVE MODULES
# ============================================

# Keep native module classes
-keep class io.soulwallet.app.** { *; }

# Keep JNI methods
-keepclasseswithmembernames class * {
    native <methods>;
}

# ============================================
# 8. ENUM PROTECTION
# ============================================

-keepclassmembers enum * {
    public static **[] values();
    public static ** valueOf(java.lang.String);
}

# ============================================
# 9. PARCELABLE
# ============================================

-keepclassmembers class * implements android.os.Parcelable {
    public static final android.os.Parcelable$Creator CREATOR;
}

# ============================================
# 10. SERIALIZABLE
# ============================================

-keepclassmembers class * implements java.io.Serializable {
    static final long serialVersionUID;
    private static final java.io.ObjectStreamField[] serialPersistentFields;
    private void writeObject(java.io.ObjectOutputStream);
    private void readObject(java.io.ObjectInputStream);
    java.lang.Object writeReplace();
    java.lang.Object readResolve();
}

# ============================================
# 11. REFLECTION PROTECTION
# ============================================

# Keep classes accessed via reflection
-keepattributes InnerClasses
-keepattributes EnclosingMethod

# ============================================
# 12. REMOVE LOGGING IN RELEASE
# ============================================

-assumenosideeffects class android.util.Log {
    public static int v(...);
    public static int d(...);
    public static int i(...);
    public static int w(...);
    public static int e(...);
}

# ============================================
# 13. STRING ENCRYPTION (R8 Full Mode)
# ============================================

# Note: R8 full mode handles string encryption automatically
# when enabled in gradle.properties

# ============================================
# 14. ADDITIONAL SECURITY
# ============================================

# Remove unused code aggressively
-dontnote **
-dontwarn **

# Optimize method calls
-optimizations !code/simplification/arithmetic,!code/simplification/cast,!field/*,!class/merging/*
