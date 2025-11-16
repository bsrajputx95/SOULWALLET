#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

// Bundle size targets from txt.txt
const BUNDLE_SIZE_TARGETS = {
  android: {
    main: '2MB',      // Main bundle target
    total: '8MB'      // Total app size target
  },
  ios: {
    main: '2MB',      // Main bundle target  
    total: '8MB'      // Total app size target
  }
};

function formatBytes(bytes) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

function parseSize(sizeStr) {
  const match = sizeStr.match(/^(\d+(?:\.\d+)?)\s*(KB|MB|GB)$/i);
  if (!match) return 0;
  
  const value = parseFloat(match[1]);
  const unit = match[2].toUpperCase();
  
  switch (unit) {
    case 'KB': return value * 1024;
    case 'MB': return value * 1024 * 1024;
    case 'GB': return value * 1024 * 1024 * 1024;
    default: return value;
  }
}

function analyzeBundleSize() {
  console.log('🔍 Analyzing bundle size...\n');
  
  const results = {
    timestamp: new Date().toISOString(),
    optimizations: [],
    measurements: {}
  };

  // Check if we can analyze the bundle
  try {
    // For Expo/React Native, we'll analyze the built bundle
    console.log('📊 Bundle Size Analysis Report');
    console.log('================================\n');

    // Analyze JavaScript bundle size
    const jsFiles = [];
    const searchDirs = ['./android/app/build', './ios/build', './.expo'];
    
    for (const dir of searchDirs) {
      if (fs.existsSync(dir)) {
        try {
          const files = execSync(`find "${dir}" -name "*.bundle" -o -name "*.js" 2>/dev/null || echo ""`, { encoding: 'utf8' });
          if (files.trim()) {
            jsFiles.push(...files.trim().split('\n').filter(f => f));
          }
        } catch (e) {
          // Directory might not exist or find command failed
        }
      }
    }

    // Analyze source code size
    const sourceStats = analyzeSourceCode();
    results.measurements.source = sourceStats;

    console.log('📁 Source Code Analysis:');
    console.log(`   Total TypeScript/JavaScript files: ${sourceStats.fileCount}`);
    console.log(`   Total source size: ${formatBytes(sourceStats.totalSize)}`);
    console.log(`   Average file size: ${formatBytes(sourceStats.averageSize)}\n`);

    // Analyze node_modules size
    const nodeModulesSize = getDirectorySize('./node_modules');
    results.measurements.nodeModules = nodeModulesSize;
    
    console.log('📦 Dependencies Analysis:');
    console.log(`   node_modules size: ${formatBytes(nodeModulesSize)}\n`);

    // Check optimizations applied
    const optimizations = checkOptimizations();
    results.optimizations = optimizations;

    console.log('⚡ Applied Optimizations:');
    optimizations.forEach(opt => {
      console.log(`   ✅ ${opt}`);
    });
    console.log();

    // Bundle size targets comparison
    console.log('🎯 Bundle Size Targets:');
    console.log(`   Android Main Bundle Target: ${BUNDLE_SIZE_TARGETS.android.main}`);
    console.log(`   Android Total App Target: ${BUNDLE_SIZE_TARGETS.android.total}`);
    console.log(`   iOS Main Bundle Target: ${BUNDLE_SIZE_TARGETS.ios.main}`);
    console.log(`   iOS Total App Target: ${BUNDLE_SIZE_TARGETS.ios.total}\n`);

    // Estimated bundle size based on source
    const estimatedBundleSize = sourceStats.totalSize * 0.7; // Rough estimate after minification
    results.measurements.estimatedBundle = estimatedBundleSize;
    
    console.log('📈 Estimated Bundle Size:');
    console.log(`   Estimated minified bundle: ${formatBytes(estimatedBundleSize)}`);
    
    const androidTarget = parseSize(BUNDLE_SIZE_TARGETS.android.main);
    const iosTarget = parseSize(BUNDLE_SIZE_TARGETS.ios.main);
    
    if (estimatedBundleSize <= androidTarget) {
      console.log(`   ✅ Within Android target (${BUNDLE_SIZE_TARGETS.android.main})`);
    } else {
      console.log(`   ⚠️  Exceeds Android target by ${formatBytes(estimatedBundleSize - androidTarget)}`);
    }
    
    if (estimatedBundleSize <= iosTarget) {
      console.log(`   ✅ Within iOS target (${BUNDLE_SIZE_TARGETS.ios.main})`);
    } else {
      console.log(`   ⚠️  Exceeds iOS target by ${formatBytes(estimatedBundleSize - iosTarget)}`);
    }

    console.log('\n💡 Recommendations:');
    if (estimatedBundleSize > Math.min(androidTarget, iosTarget)) {
      console.log('   • Consider additional code splitting');
      console.log('   • Review large dependencies');
      console.log('   • Implement more aggressive tree shaking');
    } else {
      console.log('   • Bundle size is within targets! 🎉');
      console.log('   • Continue monitoring with each release');
    }

    // Save results
    const reportPath = './bundle-analysis-report.json';
    fs.writeFileSync(reportPath, JSON.stringify(results, null, 2));
    console.log(`\n📄 Detailed report saved to: ${reportPath}`);

  } catch (error) {
    console.error('❌ Error analyzing bundle:', error.message);
    console.log('\n💡 To get accurate bundle size measurements:');
    console.log('   1. Run: npx expo export --platform android');
    console.log('   2. Run: npx expo export --platform ios');
    console.log('   3. Re-run this analysis script');
  }
}

function analyzeSourceCode() {
  const extensions = ['.ts', '.tsx', '.js', '.jsx'];
  const excludeDirs = ['node_modules', '.git', '.expo', 'android/build', 'ios/build'];
  
  let totalSize = 0;
  let fileCount = 0;
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        if (!excludeDirs.some(exclude => filePath.includes(exclude))) {
          walkDir(filePath);
        }
      } else if (extensions.some(ext => file.endsWith(ext))) {
        totalSize += stat.size;
        fileCount++;
      }
    }
  }
  
  walkDir('.');
  
  return {
    totalSize,
    fileCount,
    averageSize: fileCount > 0 ? totalSize / fileCount : 0
  };
}

function getDirectorySize(dirPath) {
  if (!fs.existsSync(dirPath)) return 0;
  
  let totalSize = 0;
  
  function walkDir(dir) {
    const files = fs.readdirSync(dir);
    
    for (const file of files) {
      const filePath = path.join(dir, file);
      const stat = fs.statSync(filePath);
      
      if (stat.isDirectory()) {
        walkDir(filePath);
      } else {
        totalSize += stat.size;
      }
    }
  }
  
  try {
    walkDir(dirPath);
  } catch (error) {
    console.warn(`Warning: Could not analyze ${dirPath}:`, error.message);
  }
  
  return totalSize;
}

function checkOptimizations() {
  const optimizations = [];
  
  // Check metro.config.js optimizations
  if (fs.existsSync('./metro.config.js')) {
    const metroConfig = fs.readFileSync('./metro.config.js', 'utf8');
    
    if (metroConfig.includes('minifierConfig')) {
      optimizations.push('Metro minification enabled');
    }
    if (metroConfig.includes('inlineRequires')) {
      optimizations.push('Inline requires enabled');
    }
    if (metroConfig.includes('drop_console')) {
      optimizations.push('Console.log removal in production');
    }
    if (metroConfig.includes('createModuleIdFactory')) {
      optimizations.push('Stable module IDs for caching');
    }
  }
  
  // Check for lazy loading
  const appDir = './app';
  if (fs.existsSync(appDir)) {
    const files = fs.readdirSync(appDir, { recursive: true });
    const hasLazyLoading = files.some(file => {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        const content = fs.readFileSync(path.join(appDir, file), 'utf8');
        return content.includes('React.lazy') || content.includes('lazy(');
      }
      return false;
    });
    
    if (hasLazyLoading) {
      optimizations.push('Lazy loading implemented');
    }
  }
  
  // Check for Hermes
  if (fs.existsSync('./android/gradle.properties')) {
    const gradleProps = fs.readFileSync('./android/gradle.properties', 'utf8');
    if (gradleProps.includes('hermesEnabled=true')) {
      optimizations.push('Hermes JavaScript engine enabled');
    }
  }
  
  // Check for performance monitoring
  if (fs.existsSync('./utils/performance.ts')) {
    optimizations.push('Performance monitoring implemented');
  }
  
  return optimizations;
}

// Run the analysis
if (require.main === module) {
  analyzeBundleSize();
}

module.exports = { analyzeBundleSize, formatBytes, parseSize };