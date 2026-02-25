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
      url: 'https://u.expo.dev/12a94060-924c-4280-a06f-a522cf7ed700',
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
        projectId: '12a94060-924c-4280-a06f-a522cf7ed700',
      },
    },
    owner: 'bhavanisinghx18',
  },
};
