/**
 * Master Test Runner Script
 * 
 * Runs all integration test suites and generates a comprehensive report.
 * Usage: tsx __tests__/scripts/run-all-tests.ts
 */

import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface TestSuiteResult {
  name: string;
  passed: number;
  failed: number;
  skipped: number;
  duration: number;
  status: 'pass' | 'fail' | 'error';
  error?: string;
}

interface TestReport {
  timestamp: string;
  totalSuites: number;
  totalTests: number;
  totalPassed: number;
  totalFailed: number;
  totalSkipped: number;
  totalDuration: number;
  passRate: number;
  suites: TestSuiteResult[];
}

const TEST_SUITES = [
  { name: 'Auth', file: '__tests__/integration/auth.test.ts' },
  { name: 'Wallet', file: '__tests__/integration/wallet.test.ts' },
  { name: 'Copy Trading', file: '__tests__/integration/copy-trading.test.ts' },
  { name: 'Market', file: '__tests__/integration/market.test.ts' },
  { name: 'Social', file: '__tests__/integration/social.test.ts' },
  { name: 'Swap', file: '__tests__/integration/swap.test.ts' },
  { name: 'Transaction', file: '__tests__/integration/transaction.test.ts' },
  { name: 'Portfolio', file: '__tests__/integration/portfolio.test.ts' },
  { name: 'Health Checks', file: '__tests__/integration/health-checks.test.ts' },
  { name: 'Error Handling', file: '__tests__/integration/error-handling.test.ts' },
];

async function runTestSuite(suite: { name: string; file: string }): Promise<TestSuiteResult> {
  const startTime = Date.now();
  const outputFile = path.join(__dirname, '..', 'reports', `jest-output-${Date.now()}.json`);
  
  return new Promise((resolve) => {
    // Use --outputFile for reliable JSON output
    const jest = spawn('npx', [
      'jest', 
      suite.file, 
      '--json', 
      '--forceExit',
      `--outputFile=${outputFile}`
    ], {
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let stdout = '';
    let stderr = '';

    jest.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    jest.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    jest.on('close', (code) => {
      const duration = Date.now() - startTime;
      
      // Try to read from output file first (most reliable)
      try {
        if (fs.existsSync(outputFile)) {
          const jsonContent = fs.readFileSync(outputFile, 'utf-8');
          const result = JSON.parse(jsonContent);
          
          // Clean up temp file
          fs.unlinkSync(outputFile);
          
          resolve({
            name: suite.name,
            passed: result.numPassedTests || 0,
            failed: result.numFailedTests || 0,
            skipped: result.numPendingTests || 0,
            duration,
            status: result.numFailedTests > 0 ? 'fail' : 'pass',
          });
          return;
        }
      } catch (e) {
        // File read/parse failed, continue to fallback
        console.warn(`Warning: Could not read Jest output file for ${suite.name}`);
      }

      // Fallback: try to parse JSON from stdout
      try {
        // Look for complete JSON object in stdout
        const jsonStart = stdout.indexOf('{');
        const jsonEnd = stdout.lastIndexOf('}');
        if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
          const jsonStr = stdout.substring(jsonStart, jsonEnd + 1);
          const result = JSON.parse(jsonStr);
          if (result.numTotalTests !== undefined) {
            resolve({
              name: suite.name,
              passed: result.numPassedTests || 0,
              failed: result.numFailedTests || 0,
              skipped: result.numPendingTests || 0,
              duration,
              status: result.numFailedTests > 0 ? 'fail' : 'pass',
            });
            return;
          }
        }
      } catch (e) {
        // JSON parsing failed
      }

      // Last resort fallback: parse from text output
      console.warn(`Warning: Using text fallback for ${suite.name} results`);
      const combinedOutput = stdout + stderr;
      const passedMatch = combinedOutput.match(/(\d+) passed/);
      const failedMatch = combinedOutput.match(/(\d+) failed/);
      const skippedMatch = combinedOutput.match(/(\d+) skipped/);

      const result: TestSuiteResult = {
        name: suite.name,
        passed: passedMatch ? parseInt(passedMatch[1]) : 0,
        failed: failedMatch ? parseInt(failedMatch[1]) : 0,
        skipped: skippedMatch ? parseInt(skippedMatch[1]) : 0,
        duration,
        status: code === 0 ? 'pass' : (code === 1 ? 'fail' : 'error'),
      };
      
      if (code !== 0 && stderr) {
        result.error = stderr.slice(0, 500);
      }
      
      resolve(result);
    });

    jest.on('error', (error) => {
      resolve({
        name: suite.name,
        passed: 0,
        failed: 0,
        skipped: 0,
        duration: Date.now() - startTime,
        status: 'error',
        error: error.message,
      });
    });
  });
}

function printResult(result: TestSuiteResult): void {
  const icon = result.status === 'pass' ? '✅' : result.status === 'fail' ? '❌' : '⚠️';
  const total = result.passed + result.failed + result.skipped;
  const passRate = total > 0 ? ((result.passed / total) * 100).toFixed(1) : '0.0';
  
  console.log(`${icon} ${result.name}: ${result.passed}/${total} passed (${passRate}%) - ${result.duration}ms`);
  
  if (result.error) {
    console.log(`   Error: ${result.error.slice(0, 200)}...`);
  }
}

async function main(): Promise<void> {
  console.log('🚀 Starting Integration Test Suite\n');
  console.log('='.repeat(60));
  console.log('Running tests...\n');

  const results: TestSuiteResult[] = [];
  
  for (const suite of TEST_SUITES) {
    console.log(`Running ${suite.name} tests...`);
    const result = await runTestSuite(suite);
    results.push(result);
    printResult(result);
    console.log('');
  }

  // Calculate totals
  const totalPassed = results.reduce((sum, r) => sum + r.passed, 0);
  const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);
  const totalSkipped = results.reduce((sum, r) => sum + r.skipped, 0);
  const totalTests = totalPassed + totalFailed + totalSkipped;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const passRate = totalTests > 0 ? (totalPassed / totalTests) * 100 : 0;

  // Generate report
  const report: TestReport = {
    timestamp: new Date().toISOString(),
    totalSuites: results.length,
    totalTests,
    totalPassed,
    totalFailed,
    totalSkipped,
    totalDuration,
    passRate,
    suites: results,
  };

  // Save report
  const reportsDir = path.join(__dirname, '..', 'reports');
  if (!fs.existsSync(reportsDir)) {
    fs.mkdirSync(reportsDir, { recursive: true });
  }
  
  const reportFile = path.join(reportsDir, `test-results-${Date.now()}.json`);
  fs.writeFileSync(reportFile, JSON.stringify(report, null, 2));

  // Print summary
  console.log('='.repeat(60));
  console.log('📊 TEST SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total Suites: ${results.length}`);
  console.log(`Total Tests: ${totalTests}`);
  console.log(`✅ Passed: ${totalPassed}`);
  console.log(`❌ Failed: ${totalFailed}`);
  console.log(`⏭️  Skipped: ${totalSkipped}`);
  console.log(`⏱️  Duration: ${(totalDuration / 1000).toFixed(2)}s`);
  console.log(`\n🏥 Pass Rate: ${passRate.toFixed(1)}%`);
  console.log(`\n📁 Report saved to: ${reportFile}`);

  // Exit with appropriate code
  if (totalFailed > 0) {
    console.log('\n❌ Some tests failed');
    process.exit(1);
  } else {
    console.log('\n✅ All tests passed!');
    process.exit(0);
  }
}

main().catch((error) => {
  console.error('Test runner failed:', error);
  process.exit(1);
});
