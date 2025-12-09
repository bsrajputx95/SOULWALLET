#!/usr/bin/env node

/**
 * Automated Version Management Script
 * 
 * Bumps version across all configuration files:
 * - app.json (Expo config)
 * - package.json (npm config)
 * - android/app/build.gradle (Android config)
 * 
 * Usage:
 *   node scripts/bump-version.js --patch   # 1.0.0 → 1.0.1
 *   node scripts/bump-version.js --minor   # 1.0.1 → 1.1.0
 *   node scripts/bump-version.js --major   # 1.1.0 → 2.0.0
 *   node scripts/bump-version.js --dry-run # Preview changes without committing
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const APP_JSON_PATH = path.join(ROOT_DIR, 'app.json');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const BUILD_GRADLE_PATH = path.join(ROOT_DIR, 'android', 'app', 'build.gradle');

// Parse command line arguments
const args = process.argv.slice(2);
const bumpType = args.find(arg => ['--major', '--minor', '--patch'].includes(arg))?.replace('--', '') || 'patch';
const isDryRun = args.includes('--dry-run');
const skipGit = args.includes('--skip-git');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
Version Bump Script for SoulWallet

Usage:
  node scripts/bump-version.js [options]

Options:
  --major     Bump major version (1.0.0 → 2.0.0)
  --minor     Bump minor version (1.0.0 → 1.1.0)
  --patch     Bump patch version (1.0.0 → 1.0.1) [default]
  --dry-run   Preview changes without modifying files
  --skip-git  Skip git commit and tag creation
  --help, -h  Show this help message

Examples:
  node scripts/bump-version.js --patch
  node scripts/bump-version.js --minor --dry-run
  node scripts/bump-version.js --major --skip-git
`);
  process.exit(0);
}

/**
 * Parse semantic version string
 */
function parseVersion(version) {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Invalid version format: ${version}. Expected format: X.Y.Z`);
  }
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  };
}

/**
 * Bump version based on type
 */
function bumpVersion(version, type) {
  const parsed = parseVersion(version);
  
  switch (type) {
    case 'major':
      return `${parsed.major + 1}.0.0`;
    case 'minor':
      return `${parsed.major}.${parsed.minor + 1}.0`;
    case 'patch':
    default:
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }
}

/**
 * Calculate version code for Android
 * Formula: (major * 10000) + (minor * 100) + patch
 * Example: 1.2.3 → 10203
 */
function calculateVersionCode(version) {
  const parsed = parseVersion(version);
  return (parsed.major * 10000) + (parsed.minor * 100) + parsed.patch;
}

/**
 * Check if git working directory is clean
 */
function isGitClean() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim() === '';
  } catch (error) {
    console.warn('Warning: Could not check git status');
    return true;
  }
}

/**
 * Check if git tag already exists
 */
function tagExists(tag) {
  try {
    execSync(`git rev-parse ${tag}`, { encoding: 'utf8', stdio: 'pipe' });
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Read JSON file
 */
function readJsonFile(filePath) {
  const content = fs.readFileSync(filePath, 'utf8');
  return JSON.parse(content);
}

/**
 * Write JSON file with proper formatting
 */
function writeJsonFile(filePath, data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Update build.gradle version
 */
function updateBuildGradle(filePath, newVersion, newVersionCode) {
  let content = fs.readFileSync(filePath, 'utf8');
  
  // Update versionCode
  content = content.replace(
    /versionCode\s+\d+/,
    `versionCode ${newVersionCode}`
  );
  
  // Update versionName
  content = content.replace(
    /versionName\s+"[\d.]+"/,
    `versionName "${newVersion}"`
  );
  
  fs.writeFileSync(filePath, content, 'utf8');
}

/**
 * Main function
 */
async function main() {
  console.log('\n🚀 SoulWallet Version Bump Script\n');
  console.log(`Bump type: ${bumpType}`);
  console.log(`Dry run: ${isDryRun}`);
  console.log(`Skip git: ${skipGit}\n`);

  // Check git status
  if (!skipGit && !isDryRun && !isGitClean()) {
    console.error('❌ Error: Working directory is not clean. Commit or stash changes first.');
    process.exit(1);
  }

  // Read current version from app.json
  const appJson = readJsonFile(APP_JSON_PATH);
  const currentVersion = appJson.expo.version;
  const newVersion = bumpVersion(currentVersion, bumpType);
  const newVersionCode = calculateVersionCode(newVersion);
  const gitTag = `v${newVersion}`;

  console.log(`📦 Current version: ${currentVersion}`);
  console.log(`📦 New version: ${newVersion}`);
  console.log(`📦 New version code: ${newVersionCode}`);
  console.log(`🏷️  Git tag: ${gitTag}\n`);

  // Check if tag already exists
  if (!skipGit && !isDryRun && tagExists(gitTag)) {
    console.error(`❌ Error: Git tag ${gitTag} already exists.`);
    process.exit(1);
  }

  if (isDryRun) {
    console.log('🔍 Dry run mode - no files will be modified\n');
    console.log('Files that would be updated:');
    console.log(`  - ${APP_JSON_PATH}`);
    console.log(`  - ${PACKAGE_JSON_PATH}`);
    console.log(`  - ${BUILD_GRADLE_PATH}`);
    console.log('\nGit operations that would be performed:');
    console.log(`  - git add .`);
    console.log(`  - git commit -m "chore: bump version to ${newVersion}"`);
    console.log(`  - git tag -a ${gitTag} -m "Release ${gitTag}"`);
    console.log(`\nRun without --dry-run to apply changes.`);
    process.exit(0);
  }

  // Update app.json
  console.log('📝 Updating app.json...');
  appJson.expo.version = newVersion;
  if (appJson.expo.android) {
    appJson.expo.android.versionCode = newVersionCode;
  }
  writeJsonFile(APP_JSON_PATH, appJson);

  // Update package.json
  console.log('📝 Updating package.json...');
  const packageJson = readJsonFile(PACKAGE_JSON_PATH);
  packageJson.version = newVersion;
  writeJsonFile(PACKAGE_JSON_PATH, packageJson);

  // Update build.gradle
  console.log('📝 Updating android/app/build.gradle...');
  updateBuildGradle(BUILD_GRADLE_PATH, newVersion, newVersionCode);

  console.log('\n✅ All files updated successfully!\n');

  // Git operations
  if (!skipGit) {
    console.log('🔧 Creating git commit and tag...');
    
    try {
      execSync('git add .', { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
      execSync(`git tag -a ${gitTag} -m "Release ${gitTag}"`, { stdio: 'inherit' });
      
      console.log('\n✅ Git commit and tag created successfully!\n');
      console.log('📋 Next steps:');
      console.log(`   1. Push changes: git push origin main`);
      console.log(`   2. Push tag: git push origin ${gitTag}`);
      console.log(`   3. Build: npm run build:android:production`);
    } catch (error) {
      console.error('❌ Error during git operations:', error.message);
      process.exit(1);
    }
  } else {
    console.log('⏭️  Skipping git operations (--skip-git flag)\n');
    console.log('📋 Next steps:');
    console.log('   1. Review changes');
    console.log('   2. Commit manually');
    console.log(`   3. Create tag: git tag -a ${gitTag} -m "Release ${gitTag}"`);
  }

  console.log('\n🎉 Version bump complete!\n');
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
