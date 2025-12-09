#!/usr/bin/env node

/**
 * Android Build Size Analysis Script
 * 
 * Analyzes APK/AAB size and tracks changes over time.
 * 
 * Usage:
 *   node scripts/analyze-build-size.js --apk path/to/app.apk
 *   node scripts/analyze-build-size.js --aab path/to/app.aab
 *   node scripts/analyze-build-size.js --latest
 *   node scripts/analyze-build-size.js --history
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Configuration
const ROOT_DIR = path.resolve(__dirname, '..');
const HISTORY_FILE = path.join(ROOT_DIR, 'build-size-history.json');
const REPORTS_DIR = path.join(ROOT_DIR, '__tests__', 'reports');

// Size thresholds (in MB)
const THRESHOLDS = {
  totalApk: 50,        // Universal APK should be under 50MB
  splitApk: 20,        // Split APK should be under 20MB
  aab: 25,             // AAB estimated download under 25MB
  jsBundle: 5,         // JS bundle under 5MB
  nativeLibs: 20,      // Native libraries under 20MB
  assets: 5,           // Assets under 5MB
  resources: 3,        // Resources under 3MB
  sizeIncreasePercent: 10, // Alert if size increases by more than 10%
};

// Parse command line arguments
const args = process.argv.slice(2);
const apkPath = args.find((arg, i) => args[i - 1] === '--apk');
const aabPath = args.find((arg, i) => args[i - 1] === '--aab');
const showLatest = args.includes('--latest');
const showHistory = args.includes('--history');
const outputJson = args.includes('--json');
const outputMarkdown = args.includes('--markdown');
const help = args.includes('--help') || args.includes('-h');

if (help) {
  console.log(`
Build Size Analysis Script for SoulWallet

Usage:
  node scripts/analyze-build-size.js [options]

Options:
  --apk <path>    Analyze specific APK file
  --aab <path>    Analyze specific AAB file
  --latest        Analyze latest EAS build (searches common locations)
  --history       Show build size history
  --json          Output results as JSON
  --markdown      Output results as Markdown
  --help, -h      Show this help message

Examples:
  node scripts/analyze-build-size.js --apk ./app-release.apk
  node scripts/analyze-build-size.js --aab ./app-release.aab
  node scripts/analyze-build-size.js --latest --markdown
`);
  process.exit(0);
}

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Format bytes to MB
 */
function bytesToMB(bytes) {
  return (bytes / (1024 * 1024)).toFixed(2);
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  try {
    const stats = fs.statSync(filePath);
    return stats.size;
  } catch (error) {
    return 0;
  }
}

/**
 * Check if command exists
 */
function commandExists(command) {
  try {
    execSync(`where ${command}`, { stdio: 'pipe' });
    return true;
  } catch {
    try {
      execSync(`which ${command}`, { stdio: 'pipe' });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Find latest APK/AAB in common locations
 */
function findLatestBuild() {
  const searchPaths = [
    path.join(ROOT_DIR, 'android', 'app', 'build', 'outputs', 'apk', 'release'),
    path.join(ROOT_DIR, 'android', 'app', 'build', 'outputs', 'bundle', 'release'),
    path.join(ROOT_DIR, 'dist'),
    path.join(ROOT_DIR, 'build'),
    process.env.HOME ? path.join(process.env.HOME, '.eas-build') : null,
  ].filter(Boolean);

  let latestFile = null;
  let latestTime = 0;

  for (const searchPath of searchPaths) {
    if (!fs.existsSync(searchPath)) continue;

    const files = fs.readdirSync(searchPath);
    for (const file of files) {
      if (file.endsWith('.apk') || file.endsWith('.aab')) {
        const filePath = path.join(searchPath, file);
        const stats = fs.statSync(filePath);
        if (stats.mtimeMs > latestTime) {
          latestTime = stats.mtimeMs;
          latestFile = filePath;
        }
      }
    }
  }

  return latestFile;
}

/**
 * Analyze APK contents using basic file inspection
 * (Fallback when aapt2 is not available)
 */
function analyzeApkBasic(apkPath) {
  const totalSize = getFileSize(apkPath);
  
  return {
    path: apkPath,
    filename: path.basename(apkPath),
    totalSize,
    totalSizeMB: parseFloat(bytesToMB(totalSize)),
    breakdown: {
      estimated: true,
      note: 'Detailed breakdown requires Android SDK tools (aapt2)',
    },
    timestamp: new Date().toISOString(),
  };
}

/**
 * Analyze APK contents using aapt2
 */
function analyzeApkDetailed(apkPath) {
  const totalSize = getFileSize(apkPath);
  const result = {
    path: apkPath,
    filename: path.basename(apkPath),
    totalSize,
    totalSizeMB: parseFloat(bytesToMB(totalSize)),
    breakdown: {},
    timestamp: new Date().toISOString(),
  };

  try {
    // Get APK info using aapt2
    const aaptOutput = execSync(`aapt2 dump badging "${apkPath}"`, { 
      encoding: 'utf8',
      maxBuffer: 10 * 1024 * 1024,
    });

    // Parse package info
    const packageMatch = aaptOutput.match(/package: name='([^']+)'/);
    const versionCodeMatch = aaptOutput.match(/versionCode='(\d+)'/);
    const versionNameMatch = aaptOutput.match(/versionName='([^']+)'/);
    const minSdkMatch = aaptOutput.match(/sdkVersion:'(\d+)'/);
    const targetSdkMatch = aaptOutput.match(/targetSdkVersion:'(\d+)'/);

    result.packageInfo = {
      name: packageMatch ? packageMatch[1] : 'unknown',
      versionCode: versionCodeMatch ? parseInt(versionCodeMatch[1]) : 0,
      versionName: versionNameMatch ? versionNameMatch[1] : 'unknown',
      minSdk: minSdkMatch ? parseInt(minSdkMatch[1]) : 0,
      targetSdk: targetSdkMatch ? parseInt(targetSdkMatch[1]) : 0,
    };

    // Parse native libraries
    const nativeLibs = aaptOutput.match(/native-code: '([^']+)'/);
    if (nativeLibs) {
      result.nativeLibraries = nativeLibs[1].split("' '");
    }

  } catch (error) {
    result.breakdown.error = 'Could not parse APK details: ' + error.message;
  }

  return result;
}

/**
 * Analyze build file
 */
function analyzeBuild(filePath) {
  if (!fs.existsSync(filePath)) {
    console.error(`❌ File not found: ${filePath}`);
    process.exit(1);
  }

  const isAab = filePath.endsWith('.aab');
  
  if (commandExists('aapt2') && !isAab) {
    return analyzeApkDetailed(filePath);
  } else {
    return analyzeApkBasic(filePath);
  }
}

/**
 * Load build history
 */
function loadHistory() {
  if (fs.existsSync(HISTORY_FILE)) {
    return JSON.parse(fs.readFileSync(HISTORY_FILE, 'utf8'));
  }
  return [];
}

/**
 * Save build history
 */
function saveHistory(history) {
  fs.writeFileSync(HISTORY_FILE, JSON.stringify(history, null, 2));
}

/**
 * Add analysis to history
 */
function addToHistory(analysis) {
  const history = loadHistory();
  
  // Get git commit hash
  let gitCommit = 'unknown';
  try {
    gitCommit = execSync('git rev-parse --short HEAD', { encoding: 'utf8' }).trim();
  } catch {}

  history.push({
    ...analysis,
    gitCommit,
    timestamp: new Date().toISOString(),
  });

  // Keep last 50 entries
  if (history.length > 50) {
    history.splice(0, history.length - 50);
  }

  saveHistory(history);
  return history;
}

/**
 * Compare with previous build
 */
function compareWithPrevious(analysis, history) {
  if (history.length < 2) return null;

  const previous = history[history.length - 2];
  const sizeDiff = analysis.totalSize - previous.totalSize;
  const percentDiff = ((sizeDiff / previous.totalSize) * 100).toFixed(2);

  return {
    previousSize: previous.totalSize,
    previousSizeMB: previous.totalSizeMB,
    sizeDiff,
    sizeDiffMB: parseFloat(bytesToMB(Math.abs(sizeDiff))),
    percentDiff: parseFloat(percentDiff),
    increased: sizeDiff > 0,
    previousCommit: previous.gitCommit,
  };
}

/**
 * Generate recommendations
 */
function generateRecommendations(analysis) {
  const recommendations = [];

  if (analysis.totalSizeMB > THRESHOLDS.totalApk) {
    recommendations.push({
      severity: 'high',
      message: `APK size (${analysis.totalSizeMB}MB) exceeds ${THRESHOLDS.totalApk}MB threshold`,
      suggestion: 'Enable APK splits to reduce per-architecture size',
    });
  }

  if (analysis.breakdown?.jsBundle > THRESHOLDS.jsBundle * 1024 * 1024) {
    recommendations.push({
      severity: 'medium',
      message: 'JS bundle is large',
      suggestion: 'Consider code splitting and lazy loading',
    });
  }

  if (analysis.breakdown?.assets > THRESHOLDS.assets * 1024 * 1024) {
    recommendations.push({
      severity: 'medium',
      message: 'Assets folder is large',
      suggestion: 'Convert images to WebP format and optimize',
    });
  }

  return recommendations;
}

/**
 * Output as console table
 */
function outputConsole(analysis, comparison, recommendations) {
  console.log('\n📊 Build Size Analysis Report\n');
  console.log('═'.repeat(60));
  
  console.log(`\n📦 File: ${analysis.filename}`);
  console.log(`📏 Total Size: ${formatBytes(analysis.totalSize)} (${analysis.totalSizeMB} MB)`);
  
  if (analysis.packageInfo) {
    console.log(`\n📋 Package Info:`);
    console.log(`   Name: ${analysis.packageInfo.name}`);
    console.log(`   Version: ${analysis.packageInfo.versionName} (${analysis.packageInfo.versionCode})`);
    console.log(`   Min SDK: ${analysis.packageInfo.minSdk}`);
    console.log(`   Target SDK: ${analysis.packageInfo.targetSdk}`);
  }

  if (analysis.nativeLibraries) {
    console.log(`\n🔧 Native Libraries: ${analysis.nativeLibraries.join(', ')}`);
  }

  if (comparison) {
    console.log(`\n📈 Comparison with Previous Build:`);
    console.log(`   Previous: ${comparison.previousSizeMB} MB (${comparison.previousCommit})`);
    console.log(`   Change: ${comparison.increased ? '+' : '-'}${comparison.sizeDiffMB} MB (${comparison.increased ? '+' : ''}${comparison.percentDiff}%)`);
    
    if (comparison.increased && comparison.percentDiff > THRESHOLDS.sizeIncreasePercent) {
      console.log(`   ⚠️  WARNING: Size increased by more than ${THRESHOLDS.sizeIncreasePercent}%!`);
    }
  }

  if (recommendations.length > 0) {
    console.log(`\n💡 Recommendations:`);
    for (const rec of recommendations) {
      const icon = rec.severity === 'high' ? '🔴' : rec.severity === 'medium' ? '🟡' : '🟢';
      console.log(`   ${icon} ${rec.message}`);
      console.log(`      → ${rec.suggestion}`);
    }
  }

  console.log('\n' + '═'.repeat(60));
  console.log(`\n✅ Analysis complete at ${new Date().toLocaleString()}\n`);
}

/**
 * Output as JSON
 */
function outputJsonFormat(analysis, comparison, recommendations) {
  const output = {
    analysis,
    comparison,
    recommendations,
    thresholds: THRESHOLDS,
  };
  console.log(JSON.stringify(output, null, 2));
}

/**
 * Output as Markdown
 */
function outputMarkdownFormat(analysis, comparison, recommendations) {
  let md = `# Build Size Analysis Report\n\n`;
  md += `**Generated:** ${new Date().toLocaleString()}\n\n`;
  
  md += `## Summary\n\n`;
  md += `| Metric | Value |\n`;
  md += `|--------|-------|\n`;
  md += `| File | ${analysis.filename} |\n`;
  md += `| Total Size | ${analysis.totalSizeMB} MB |\n`;
  
  if (analysis.packageInfo) {
    md += `| Package | ${analysis.packageInfo.name} |\n`;
    md += `| Version | ${analysis.packageInfo.versionName} |\n`;
  }

  if (comparison) {
    md += `\n## Size Comparison\n\n`;
    md += `| Metric | Value |\n`;
    md += `|--------|-------|\n`;
    md += `| Previous Size | ${comparison.previousSizeMB} MB |\n`;
    md += `| Change | ${comparison.increased ? '+' : '-'}${comparison.sizeDiffMB} MB |\n`;
    md += `| Percent Change | ${comparison.increased ? '+' : ''}${comparison.percentDiff}% |\n`;
  }

  if (recommendations.length > 0) {
    md += `\n## Recommendations\n\n`;
    for (const rec of recommendations) {
      md += `- **${rec.severity.toUpperCase()}**: ${rec.message}\n`;
      md += `  - ${rec.suggestion}\n`;
    }
  }

  console.log(md);
}

/**
 * Show history
 */
function displayHistory() {
  const history = loadHistory();
  
  if (history.length === 0) {
    console.log('No build history found.');
    return;
  }

  console.log('\n📊 Build Size History\n');
  console.log('═'.repeat(80));
  console.log(`${'Date'.padEnd(25)} ${'Version'.padEnd(15)} ${'Size (MB)'.padEnd(12)} ${'Commit'.padEnd(10)} Change`);
  console.log('─'.repeat(80));

  let previousSize = 0;
  for (const entry of history) {
    const date = new Date(entry.timestamp).toLocaleString();
    const version = entry.packageInfo?.versionName || 'unknown';
    const size = entry.totalSizeMB.toString();
    const commit = entry.gitCommit || 'unknown';
    
    let change = '';
    if (previousSize > 0) {
      const diff = entry.totalSize - previousSize;
      const percent = ((diff / previousSize) * 100).toFixed(1);
      change = diff > 0 ? `+${percent}%` : `${percent}%`;
    }
    
    console.log(`${date.padEnd(25)} ${version.padEnd(15)} ${size.padEnd(12)} ${commit.padEnd(10)} ${change}`);
    previousSize = entry.totalSize;
  }

  console.log('═'.repeat(80));
}

/**
 * Main function
 */
async function main() {
  if (showHistory) {
    displayHistory();
    return;
  }

  let buildPath = apkPath || aabPath;

  if (showLatest) {
    buildPath = findLatestBuild();
    if (!buildPath) {
      console.error('❌ No APK or AAB files found in common locations.');
      console.log('   Try specifying a path with --apk or --aab');
      process.exit(1);
    }
    console.log(`📍 Found latest build: ${buildPath}`);
  }

  if (!buildPath) {
    console.error('❌ No build file specified.');
    console.log('   Use --apk, --aab, or --latest');
    console.log('   Run with --help for more options');
    process.exit(1);
  }

  const analysis = analyzeBuild(buildPath);
  const history = addToHistory(analysis);
  const comparison = compareWithPrevious(analysis, history);
  const recommendations = generateRecommendations(analysis);

  // Ensure reports directory exists
  if (!fs.existsSync(REPORTS_DIR)) {
    fs.mkdirSync(REPORTS_DIR, { recursive: true });
  }

  // Output results
  if (outputJson) {
    outputJsonFormat(analysis, comparison, recommendations);
  } else if (outputMarkdown) {
    outputMarkdownFormat(analysis, comparison, recommendations);
  } else {
    outputConsole(analysis, comparison, recommendations);
  }

  // Save detailed report
  const reportPath = path.join(REPORTS_DIR, `build-size-${Date.now()}.json`);
  fs.writeFileSync(reportPath, JSON.stringify({ analysis, comparison, recommendations }, null, 2));
  console.log(`📄 Detailed report saved to: ${reportPath}`);
}

main().catch(error => {
  console.error('❌ Error:', error.message);
  process.exit(1);
});
