module.exports = {
  expo: {
    name: 'Soul Wallet',
    slug: 'soulwallet2',
    version: '1.0.0',
    orientation: 'portrait',
    icon: './assets/images/icon.png',
    scheme: 'soulwallet',
    userInterfaceStyle: 'automatic',
    newArchEnabled: true,
    jsEngine: 'hermes',
    // Use static runtime version to avoid platform mismatch issues
    runtimeVersion: '1.0.0',
    updates: {
      url: 'https://u.expo.dev/39377c11-1e45-436d-95c7-267e708b6b86',
      checkAutomatically: 'ON_LOAD',
    },
    splash: {
      image: './assets/images/splash.png',
      resizeMode: 'cover',
      backgroundColor: '#101428',
    },
    android: {
      versionCode: 2,
      jsEngine: 'hermes',
      adaptiveIcon: {
        foregroundImage: './assets/images/adaptive-icon.png',
        backgroundColor: '#101428',
      },
      package: 'io.soulwallet.app',
      allowBackup: false,
      softwareKeyboardLayoutMode: 'pan',
      permissions: [
        'android.permission.INTERNET',
        'android.permission.VIBRATE',
        'android.permission.CAMERA',
      ],
      abiFilters: ['arm64-v8a'],
    },
    plugins: ['expo-router', 'expo-updates'],
    experiments: {
      typedRoutes: true,
    },
    extra: {
      router: {
        origin: 'https://rork.com/',
      },
      eas: {
        projectId: '39377c11-1e45-436d-95c7-267e708b6b86',
      },
    },
    owner: 'bhavanisinghx18',
  },
};
