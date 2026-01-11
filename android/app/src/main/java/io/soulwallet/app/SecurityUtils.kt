package io.soulwallet.app

import android.content.Context
import android.content.pm.PackageManager
import android.os.Build
import android.os.Debug
import android.provider.Settings
import java.io.BufferedReader
import java.io.File
import java.io.InputStreamReader
import java.net.NetworkInterface

/**
 * SecurityUtils - Enterprise-grade security detection utilities
 * Detects root, debugger, emulator, Frida, and other security threats
 */
object SecurityUtils {

    // ============================================
    // ROOT DETECTION
    // ============================================

    private val ROOT_PATHS = arrayOf(
        "/system/app/Superuser.apk",
        "/sbin/su",
        "/system/bin/su",
        "/system/xbin/su",
        "/data/local/xbin/su",
        "/data/local/bin/su",
        "/system/sd/xbin/su",
        "/system/bin/failsafe/su",
        "/data/local/su",
        "/su/bin/su",
        "/su/bin",
        "/system/xbin/daemonsu",
        "/system/etc/init.d/99telecominfra",
        "/system/bin/.ext/.su",
        "/system/usr/we-need-root/su-backup",
        "/system/xbin/mu"
    )

    private val ROOT_PACKAGES = arrayOf(
        "com.noshufou.android.su",
        "com.noshufou.android.su.elite",
        "eu.chainfire.supersu",
        "com.koushikdutta.superuser",
        "com.thirdparty.superuser",
        "com.yellowes.su",
        "com.topjohnwu.magisk",
        "com.kingroot.kinguser",
        "com.kingo.root",
        "com.smedialink.oneclickroot",
        "com.zhiqupk.root.global",
        "com.alephzain.framaroot"
    )

    private val DANGEROUS_PROPS = arrayOf(
        "ro.debuggable",
        "ro.secure"
    )

    fun isRooted(context: Context): Boolean {
        return checkRootBinaries() ||
               checkRootPackages(context) ||
               checkTestKeys() ||
               checkDangerousProps() ||
               checkRWSystem() ||
               checkSuCommand()
    }

    private fun checkRootBinaries(): Boolean {
        for (path in ROOT_PATHS) {
            if (File(path).exists()) {
                return true
            }
        }
        return false
    }

    private fun checkRootPackages(context: Context): Boolean {
        val pm = context.packageManager
        for (pkg in ROOT_PACKAGES) {
            try {
                pm.getPackageInfo(pkg, 0)
                return true
            } catch (e: PackageManager.NameNotFoundException) {
                // Package not found, continue
            }
        }
        return false
    }

    private fun checkTestKeys(): Boolean {
        val buildTags = Build.TAGS
        return buildTags != null && buildTags.contains("test-keys")
    }

    private fun checkDangerousProps(): Boolean {
        try {
            val process = Runtime.getRuntime().exec("getprop ro.debuggable")
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val result = reader.readLine()
            reader.close()
            if (result == "1") return true
        } catch (e: Exception) {
            // Ignore
        }
        return false
    }

    private fun checkRWSystem(): Boolean {
        try {
            val process = Runtime.getRuntime().exec("mount")
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            var line: String?
            while (reader.readLine().also { line = it } != null) {
                if (line!!.contains("/system") && line!!.contains("rw")) {
                    reader.close()
                    return true
                }
            }
            reader.close()
        } catch (e: Exception) {
            // Ignore
        }
        return false
    }

    private fun checkSuCommand(): Boolean {
        return try {
            val process = Runtime.getRuntime().exec(arrayOf("/system/xbin/which", "su"))
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val result = reader.readLine()
            reader.close()
            result != null
        } catch (e: Exception) {
            false
        }
    }

    // ============================================
    // DEBUGGER DETECTION
    // ============================================

    fun isDebuggerAttached(): Boolean {
        return Debug.isDebuggerConnected() || Debug.waitingForDebugger()
    }

    fun isDebuggable(context: Context): Boolean {
        return (context.applicationInfo.flags and android.content.pm.ApplicationInfo.FLAG_DEBUGGABLE) != 0
    }

    // ============================================
    // EMULATOR DETECTION
    // ============================================

    fun isEmulator(): Boolean {
        return checkEmulatorBuild() ||
               checkEmulatorHardware() ||
               checkEmulatorQemu()
    }

    private fun checkEmulatorBuild(): Boolean {
        return Build.FINGERPRINT.startsWith("generic") ||
               Build.FINGERPRINT.startsWith("unknown") ||
               Build.MODEL.contains("google_sdk") ||
               Build.MODEL.contains("Emulator") ||
               Build.MODEL.contains("Android SDK built for x86") ||
               Build.MANUFACTURER.contains("Genymotion") ||
               Build.BRAND.startsWith("generic") ||
               Build.DEVICE.startsWith("generic") ||
               Build.PRODUCT == "sdk" ||
               Build.PRODUCT == "google_sdk" ||
               Build.PRODUCT == "sdk_x86" ||
               Build.PRODUCT == "vbox86p" ||
               Build.PRODUCT == "emulator" ||
               Build.PRODUCT == "simulator" ||
               Build.HARDWARE.contains("goldfish") ||
               Build.HARDWARE.contains("ranchu")
    }

    private fun checkEmulatorHardware(): Boolean {
        return Build.HARDWARE == "goldfish" ||
               Build.HARDWARE == "ranchu" ||
               Build.HARDWARE.contains("nox") ||
               Build.HARDWARE.contains("vbox")
    }

    private fun checkEmulatorQemu(): Boolean {
        try {
            val process = Runtime.getRuntime().exec("getprop ro.kernel.qemu")
            val reader = BufferedReader(InputStreamReader(process.inputStream))
            val result = reader.readLine()
            reader.close()
            return result == "1"
        } catch (e: Exception) {
            return false
        }
    }

    // ============================================
    // FRIDA DETECTION
    // ============================================

    fun isFridaDetected(): Boolean {
        return checkFridaPort() ||
               checkFridaLibraries() ||
               checkFridaFiles()
    }

    private fun checkFridaPort(): Boolean {
        try {
            val socket = java.net.Socket()
            socket.connect(java.net.InetSocketAddress("127.0.0.1", 27042), 100)
            socket.close()
            return true // Frida default port is open
        } catch (e: Exception) {
            return false
        }
    }

    private fun checkFridaLibraries(): Boolean {
        try {
            val mapsFile = File("/proc/self/maps")
            if (mapsFile.exists()) {
                val content = mapsFile.readText()
                if (content.contains("frida") || content.contains("gadget")) {
                    return true
                }
            }
        } catch (e: Exception) {
            // Ignore
        }
        return false
    }

    private fun checkFridaFiles(): Boolean {
        val fridaPaths = arrayOf(
            "/data/local/tmp/frida-server",
            "/data/local/tmp/re.frida.server",
            "/sdcard/frida-server"
        )
        for (path in fridaPaths) {
            if (File(path).exists()) {
                return true
            }
        }
        return false
    }

    // ============================================
    // XPOSED DETECTION
    // ============================================

    fun isXposedDetected(): Boolean {
        return checkXposedInstaller() || checkXposedStackTrace()
    }

    private fun checkXposedInstaller(): Boolean {
        try {
            throw Exception("Xposed check")
        } catch (e: Exception) {
            val stackTrace = e.stackTrace
            for (element in stackTrace) {
                if (element.className.contains("de.robv.android.xposed") ||
                    element.className.contains("com.saurik.substrate")) {
                    return true
                }
            }
        }
        return false
    }

    private fun checkXposedStackTrace(): Boolean {
        try {
            Class.forName("de.robv.android.xposed.XposedBridge")
            return true
        } catch (e: ClassNotFoundException) {
            return false
        }
    }

    // ============================================
    // APK SIGNATURE VALIDATION
    // ============================================

    fun getApkSignature(context: Context): String? {
        return try {
            val packageInfo = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNING_CERTIFICATES
                )
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getPackageInfo(
                    context.packageName,
                    PackageManager.GET_SIGNATURES
                )
            }

            val signatures = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
                packageInfo.signingInfo?.apkContentsSigners
            } else {
                @Suppress("DEPRECATION")
                packageInfo.signatures
            }

            signatures?.firstOrNull()?.let { signature ->
                val md = java.security.MessageDigest.getInstance("SHA-256")
                val digest = md.digest(signature.toByteArray())
                digest.joinToString("") { "%02x".format(it) }
            }
        } catch (e: Exception) {
            null
        }
    }

    fun isValidSignature(context: Context, expectedSignature: String): Boolean {
        val currentSignature = getApkSignature(context)
        return currentSignature != null && currentSignature.equals(expectedSignature, ignoreCase = true)
    }

    // ============================================
    // INSTALLER VALIDATION
    // ============================================

    fun getInstallerPackage(context: Context): String? {
        return try {
            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.R) {
                context.packageManager.getInstallSourceInfo(context.packageName).installingPackageName
            } else {
                @Suppress("DEPRECATION")
                context.packageManager.getInstallerPackageName(context.packageName)
            }
        } catch (e: Exception) {
            null
        }
    }

    fun isInstalledFromPlayStore(context: Context): Boolean {
        val installer = getInstallerPackage(context)
        return installer == "com.android.vending" || installer == "com.google.android.feedback"
    }

    // ============================================
    // DEVELOPER OPTIONS DETECTION
    // ============================================

    fun isDeveloperOptionsEnabled(context: Context): Boolean {
        return Settings.Secure.getInt(
            context.contentResolver,
            Settings.Global.DEVELOPMENT_SETTINGS_ENABLED,
            0
        ) != 0
    }

    fun isAdbEnabled(context: Context): Boolean {
        return Settings.Secure.getInt(
            context.contentResolver,
            Settings.Global.ADB_ENABLED,
            0
        ) != 0
    }

    // ============================================
    // VPN DETECTION
    // ============================================

    fun isVpnConnected(): Boolean {
        try {
            val networkInterfaces = NetworkInterface.getNetworkInterfaces()
            while (networkInterfaces.hasMoreElements()) {
                val networkInterface = networkInterfaces.nextElement()
                val name = networkInterface.name.lowercase()
                if (name.contains("tun") || name.contains("ppp") || name.contains("pptp")) {
                    if (networkInterface.isUp) {
                        return true
                    }
                }
            }
        } catch (e: Exception) {
            // Ignore
        }
        return false
    }

    // ============================================
    // COMPREHENSIVE SECURITY CHECK
    // ============================================

    data class SecurityCheckResult(
        val isRooted: Boolean,
        val isDebuggerAttached: Boolean,
        val isDebuggable: Boolean,
        val isEmulator: Boolean,
        val isFridaDetected: Boolean,
        val isXposedDetected: Boolean,
        val isDeveloperOptionsEnabled: Boolean,
        val isAdbEnabled: Boolean,
        val isVpnConnected: Boolean,
        val riskScore: Int // 0-100, higher = more risky
    ) {
        val isHighRisk: Boolean
            get() = riskScore >= 70

        val isMediumRisk: Boolean
            get() = riskScore in 40..69

        val shouldBlockFinancialOps: Boolean
            get() = isRooted || isFridaDetected || isXposedDetected || isDebuggerAttached
    }

    fun performSecurityCheck(context: Context): SecurityCheckResult {
        val isRooted = isRooted(context)
        val isDebuggerAttached = isDebuggerAttached()
        val isDebuggable = isDebuggable(context)
        val isEmulator = isEmulator()
        val isFridaDetected = isFridaDetected()
        val isXposedDetected = isXposedDetected()
        val isDeveloperOptionsEnabled = isDeveloperOptionsEnabled(context)
        val isAdbEnabled = isAdbEnabled(context)
        val isVpnConnected = isVpnConnected()

        // Calculate risk score
        var riskScore = 0
        if (isRooted) riskScore += 40
        if (isDebuggerAttached) riskScore += 30
        if (isFridaDetected) riskScore += 30
        if (isXposedDetected) riskScore += 25
        if (isEmulator) riskScore += 15
        if (isDebuggable) riskScore += 10
        if (isDeveloperOptionsEnabled) riskScore += 5
        if (isAdbEnabled) riskScore += 5

        return SecurityCheckResult(
            isRooted = isRooted,
            isDebuggerAttached = isDebuggerAttached,
            isDebuggable = isDebuggable,
            isEmulator = isEmulator,
            isFridaDetected = isFridaDetected,
            isXposedDetected = isXposedDetected,
            isDeveloperOptionsEnabled = isDeveloperOptionsEnabled,
            isAdbEnabled = isAdbEnabled,
            isVpnConnected = isVpnConnected,
            riskScore = riskScore.coerceAtMost(100)
        )
    }
}
