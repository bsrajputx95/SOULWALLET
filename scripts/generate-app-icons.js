const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

// Ensure assets directories exist
const dirs = [
  'assets/images',
  'assets/adaptive-icon',
  'android/app/src/main/res/mipmap-hdpi',
  'android/app/src/main/res/mipmap-mdpi',
  'android/app/src/main/res/mipmap-xhdpi',
  'android/app/src/main/res/mipmap-xxhdpi',
  'android/app/src/main/res/mipmap-xxxhdpi',
  'ios/soulwallet/Images.xcassets/AppIcon.appiconset'
];

dirs.forEach(dir => {
  const fullPath = path.join(__dirname, '..', dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
  }
});

const sourceImage = path.join(__dirname, '..', 'soulwalleticon.jpg');

// Icon configurations
const icons = [
  // Main app icon
  { size: 1024, path: 'assets/images/icon.png', description: 'Main app icon' },
  
  // Adaptive icon for Android
  { size: 512, path: 'assets/images/adaptive-icon.png', description: 'Android adaptive icon' },
  
  // Splash screen icon
  { size: 512, path: 'assets/images/splash-icon.png', description: 'Splash screen icon' },
  
  // Web favicon
  { size: 192, path: 'assets/images/favicon.png', description: 'Web favicon' },
  
  // Android icons
  { size: 72, path: 'android/app/src/main/res/mipmap-hdpi/ic_launcher.png', description: 'Android hdpi' },
  { size: 48, path: 'android/app/src/main/res/mipmap-mdpi/ic_launcher.png', description: 'Android mdpi' },
  { size: 96, path: 'android/app/src/main/res/mipmap-xhdpi/ic_launcher.png', description: 'Android xhdpi' },
  { size: 144, path: 'android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png', description: 'Android xxhdpi' },
  { size: 192, path: 'android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png', description: 'Android xxxhdpi' },
  
  // iOS icons
  { size: 20, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-20.png' },
  { size: 40, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-40.png' },
  { size: 60, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-60.png' },
  { size: 76, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-76.png' },
  { size: 80, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-80.png' },
  { size: 87, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-87.png' },
  { size: 120, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-120.png' },
  { size: 152, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-152.png' },
  { size: 167, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-167.png' },
  { size: 180, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-180.png' },
  { size: 1024, path: 'ios/soulwallet/Images.xcassets/AppIcon.appiconset/Icon-1024.png' },
];

async function generateIcons() {
  try {
    console.log('🎨 Generating app icons from soulwalleticon.jpg...\n');
    
    for (const icon of icons) {
      const outputPath = path.join(__dirname, '..', icon.path);
      
      await sharp(sourceImage)
        .resize(icon.size, icon.size, {
          fit: 'cover',
          position: 'center'
        })
        .png({
          quality: 100,
          compressionLevel: 9
        })
        .toFile(outputPath);
      
      console.log(`✅ Generated ${icon.description || `${icon.size}x${icon.size}`} -> ${icon.path}`);
    }
    
    // Also create a rounded version for the main icon
    const roundedIconPath = path.join(__dirname, '..', 'assets/images/icon-rounded.png');
    const size = 1024;
    const roundedCorners = Buffer.from(
      `<svg><rect x="0" y="0" width="${size}" height="${size}" rx="${size * 0.2}" ry="${size * 0.2}"/></svg>`
    );
    
    await sharp(sourceImage)
      .resize(size, size)
      .composite([{
        input: roundedCorners,
        blend: 'dest-in'
      }])
      .png()
      .toFile(roundedIconPath);
    
    console.log('✅ Generated rounded icon variant');
    
    // Generate splash screen with padding
    const splashPath = path.join(__dirname, '..', 'assets/images/splash.png');
    await sharp({
      create: {
        width: 1242,
        height: 2436,
        channels: 4,
        background: { r: 16, g: 20, b: 40, alpha: 1 } // Dark blue background
      }
    })
    .composite([{
      input: await sharp(sourceImage)
        .resize(512, 512)
        .toBuffer(),
      gravity: 'center'
    }])
    .png()
    .toFile(splashPath);
    
    console.log('✅ Generated splash screen');
    
    console.log('\n🎉 All icons generated successfully!');
    console.log('📱 Remember to run "npx expo prebuild" to apply changes to native projects');
    
  } catch (error) {
    console.error('❌ Error generating icons:', error);
    process.exit(1);
  }
}

// Check if sharp is installed
try {
  require.resolve('sharp');
  generateIcons();
} catch (e) {
  console.log('📦 Installing sharp...');
  const { execSync } = require('child_process');
  execSync('npm install sharp', { stdio: 'inherit' });
  generateIcons();
}
