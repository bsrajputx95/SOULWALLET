package io.soulwallet.app

import android.app.Application
import android.content.res.Configuration
import android.util.Log

import com.facebook.react.PackageList
import com.facebook.react.ReactApplication
import com.facebook.react.ReactNativeApplicationEntryPoint.loadReactNative
import com.facebook.react.ReactNativeHost
import com.facebook.react.ReactPackage
import com.facebook.react.ReactHost
import com.facebook.react.common.ReleaseLevel
import com.facebook.react.defaults.DefaultNewArchitectureEntryPoint
import com.facebook.react.defaults.DefaultReactNativeHost

import expo.modules.ApplicationLifecycleDispatcher
import expo.modules.ReactNativeHostWrapper

class MainApplication : Application(), ReactApplication {

  companion object {
    private const val TAG = "SoulWallet"
    
    // Security check result cached for the app lifecycle
    var securityCheckResult: SecurityUtils.SecurityCheckResult? = null
      private set
    
    fun isSecurityCheckPassed(): Boolean {
      return securityCheckResult?.shouldBlockFinancialOps != true
    }
  }

  override val reactNativeHost: ReactNativeHost = ReactNativeHostWrapper(
      this,
      object : DefaultReactNativeHost(this) {
        override fun getPackages(): List<ReactPackage> =
            PackageList(this).packages.apply {
              // Packages that cannot be autolinked yet can be added manually here, for example:
              // add(MyReactNativePackage())
            }

          override fun getJSMainModuleName(): String = ".expo/.virtual-metro-entry"

          override fun getUseDeveloperSupport(): Boolean = BuildConfig.DEBUG

          override val isNewArchEnabled: Boolean = BuildConfig.IS_NEW_ARCHITECTURE_ENABLED
      }
  )

  override val reactHost: ReactHost
    get() = ReactNativeHostWrapper.createReactHost(applicationContext, reactNativeHost)

  override fun onCreate() {
    super.onCreate()
    
    // Perform security checks on app startup (production only)
    if (!BuildConfig.DEBUG) {
      performSecurityChecks()
    }
    
    DefaultNewArchitectureEntryPoint.releaseLevel = try {
      ReleaseLevel.valueOf(BuildConfig.REACT_NATIVE_RELEASE_LEVEL.uppercase())
    } catch (e: IllegalArgumentException) {
      ReleaseLevel.STABLE
    }
    loadReactNative(this)
    ApplicationLifecycleDispatcher.onApplicationCreate(this)
  }

  override fun onConfigurationChanged(newConfig: Configuration) {
    super.onConfigurationChanged(newConfig)
    ApplicationLifecycleDispatcher.onConfigurationChanged(this, newConfig)
  }

  /**
   * Perform comprehensive security checks on app startup
   * Results are cached and accessible via companion object
   */
  private fun performSecurityChecks() {
    try {
      securityCheckResult = SecurityUtils.performSecurityCheck(this)
      
      val result = securityCheckResult!!
      
      // Log security status (in production, this would be sent to backend)
      Log.i(TAG, "Security Check - Risk Score: ${result.riskScore}")
      
      if (result.isRooted) {
        Log.w(TAG, "Security Alert: Device appears to be rooted")
      }
      
      if (result.isFridaDetected) {
        Log.w(TAG, "Security Alert: Frida detected")
      }
      
      if (result.isXposedDetected) {
        Log.w(TAG, "Security Alert: Xposed framework detected")
      }
      
      if (result.isDebuggerAttached) {
        Log.w(TAG, "Security Alert: Debugger attached")
      }
      
      if (result.isEmulator) {
        Log.w(TAG, "Security Alert: Running on emulator")
      }
      
      // High risk devices get logged for monitoring
      if (result.isHighRisk) {
        Log.e(TAG, "HIGH RISK DEVICE DETECTED - Risk Score: ${result.riskScore}")
        // In production, send alert to backend:
        // sendSecurityAlertToBackend(result)
      }
      
    } catch (e: Exception) {
      Log.e(TAG, "Security check failed: ${e.message}")
    }
  }
}
