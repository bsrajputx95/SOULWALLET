// Simple script to create placeholder image files for Expo
const fs = require('fs');
const path = require('path');

// Create assets directory if it doesn't exist
const assetsDir = path.join(__dirname, '..', 'assets');
if (!fs.existsSync(assetsDir)) {
  fs.mkdirSync(assetsDir, { recursive: true });
}

// Create a simple 1x1 pixel PNG (transparent)
const transparentPNG = Buffer.from([
  0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A,
  0x00, 0x00, 0x00, 0x0D, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x04, 0x00, 0x00, 0x00, 0x04, 0x00,
  0x08, 0x06, 0x00, 0x00, 0x00, 0xA9, 0xF1, 0x9E,
  0x7E, 0x00, 0x00, 0x00, 0x13, 0x49, 0x44, 0x41,
  0x54, 0x78, 0x9C, 0x62, 0x00, 0x01, 0x00, 0x00,
  0x05, 0x00, 0x01, 0x0D, 0x0A, 0x2D, 0xB4, 0x00,
  0x00, 0x00, 0x00, 0x49, 0x45, 0x4E, 0x44, 0xAE,
  0x42, 0x60, 0x82
]);

// Create icon.png (1024x1024)
fs.writeFileSync(path.join(assetsDir, 'icon.png'), transparentPNG);
console.log('✓ Created icon.png');

// Create splash.png (1242x2436)
fs.writeFileSync(path.join(assetsDir, 'splash.png'), transparentPNG);
console.log('✓ Created splash.png');

// Create adaptive-icon.png (1024x1024)
fs.writeFileSync(path.join(assetsDir, 'adaptive-icon.png'), transparentPNG);
console.log('✓ Created adaptive-icon.png');

// Create favicon.png (48x48)
fs.writeFileSync(path.join(assetsDir, 'favicon.png'), transparentPNG);
console.log('✓ Created favicon.png');

console.log('\n✨ All placeholder assets created successfully!');
console.log('Note: These are minimal placeholders. Replace with actual assets for production.');
