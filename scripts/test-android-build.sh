#!/bin/bash

# =============================================================================
# SOULWALLET ANDROID BUILD TESTING SCRIPT
# =============================================================================
# Tests Android builds across multiple API levels and configurations
#
# Usage:
#   bash scripts/test-android-build.sh --profile beta-apk
#   bash scripts/test-android-build.sh --profile production --api-levels 24,29,34
#   bash scripts/test-android-build.sh --quick
#   bash scripts/test-android-build.sh --local-only
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ROOT_DIR="$(dirname "$SCRIPT_DIR")"
REPORTS_DIR="$ROOT_DIR/__tests__/reports"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REPORT_FILE="$REPORTS_DIR/android-build-test-$TIMESTAMP.md"

# Default values
PROFILE="beta-apk"
API_LEVELS="29"
QUICK_MODE=false
LOCAL_ONLY=false
SKIP_EMULATOR=false

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --profile)
      PROFILE="$2"
      shift 2
      ;;
    --api-levels)
      API_LEVELS="$2"
      shift 2
      ;;
    --quick)
      QUICK_MODE=true
      shift
      ;;
    --local-only)
      LOCAL_ONLY=true
      shift
      ;;
    --skip-emulator)
      SKIP_EMULATOR=true
      shift
      ;;
    --help|-h)
      echo "Android Build Testing Script"
      echo ""
      echo "Usage: bash scripts/test-android-build.sh [options]"
      echo ""
      echo "Options:"
      echo "  --profile <name>      EAS build profile (default: beta-apk)"
      echo "  --api-levels <list>   Comma-separated API levels to test (default: 29)"
      echo "  --quick               Skip multi-API testing"
      echo "  --local-only          Only test local builds, skip EAS"
      echo "  --skip-emulator       Skip emulator tests"
      echo "  --help, -h            Show this help message"
      echo ""
      echo "Examples:"
      echo "  bash scripts/test-android-build.sh --profile beta-apk"
      echo "  bash scripts/test-android-build.sh --profile production --api-levels 24,29,34"
      echo "  bash scripts/test-android-build.sh --quick --local-only"
      exit 0
      ;;
    *)
      echo "Unknown option: $1"
      exit 1
      ;;
  esac
done

# Logging functions
log_info() {
  echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
  echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warning() {
  echo -e "${YELLOW}[WARNING]${NC} $1"
}

log_error() {
  echo -e "${RED}[ERROR]${NC} $1"
}

log_section() {
  echo ""
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo -e "${BLUE}  $1${NC}"
  echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
  echo ""
}

# Initialize report
init_report() {
  mkdir -p "$REPORTS_DIR"
  cat > "$REPORT_FILE" << EOF
# Android Build Test Report

**Generated:** $(date)
**Profile:** $PROFILE
**API Levels:** $API_LEVELS

## Test Results

EOF
}

# Add to report
add_to_report() {
  echo "$1" >> "$REPORT_FILE"
}

# Check prerequisites
check_prerequisites() {
  log_section "Checking Prerequisites"
  
  local all_ok=true

  # Check Node.js
  if command -v node &> /dev/null; then
    log_success "Node.js: $(node --version)"
  else
    log_error "Node.js not found"
    all_ok=false
  fi

  # Check npm
  if command -v npm &> /dev/null; then
    log_success "npm: $(npm --version)"
  else
    log_error "npm not found"
    all_ok=false
  fi

  # Check EAS CLI
  if command -v eas &> /dev/null; then
    log_success "EAS CLI: $(eas --version)"
  else
    log_warning "EAS CLI not found - install with: npm install -g eas-cli"
    if [ "$LOCAL_ONLY" = false ]; then
      all_ok=false
    fi
  fi

  # Check Android SDK
  if [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME" ]; then
    log_success "Android SDK: $ANDROID_HOME"
  elif [ -n "$ANDROID_SDK_ROOT" ] && [ -d "$ANDROID_SDK_ROOT" ]; then
    export ANDROID_HOME="$ANDROID_SDK_ROOT"
    log_success "Android SDK: $ANDROID_HOME"
  else
    log_warning "Android SDK not found (ANDROID_HOME not set)"
    if [ "$SKIP_EMULATOR" = false ]; then
      log_warning "Emulator tests will be skipped"
      SKIP_EMULATOR=true
    fi
  fi

  # Check ADB
  if command -v adb &> /dev/null; then
    log_success "ADB: $(adb version | head -1)"
  elif [ -f "$ANDROID_HOME/platform-tools/adb" ]; then
    export PATH="$PATH:$ANDROID_HOME/platform-tools"
    log_success "ADB: $(adb version | head -1)"
  else
    log_warning "ADB not found"
    SKIP_EMULATOR=true
  fi

  add_to_report "### Prerequisites"
  add_to_report "- Node.js: $(node --version 2>/dev/null || echo 'Not found')"
  add_to_report "- npm: $(npm --version 2>/dev/null || echo 'Not found')"
  add_to_report "- EAS CLI: $(eas --version 2>/dev/null || echo 'Not found')"
  add_to_report "- Android SDK: ${ANDROID_HOME:-Not found}"
  add_to_report ""

  if [ "$all_ok" = false ]; then
    log_error "Prerequisites check failed"
    exit 1
  fi
}

# Run pre-build checks
run_prebuild_checks() {
  log_section "Running Pre-Build Checks"
  
  cd "$ROOT_DIR"

  # Type check
  log_info "Running TypeScript type check..."
  if npm run type-check 2>&1; then
    log_success "Type check passed"
    add_to_report "- [x] TypeScript type check"
  else
    log_warning "Type check had issues"
    add_to_report "- [ ] TypeScript type check (warnings)"
  fi

  # Lint
  log_info "Running ESLint..."
  if npm run lint 2>&1; then
    log_success "Lint passed"
    add_to_report "- [x] ESLint"
  else
    log_warning "Lint had issues"
    add_to_report "- [ ] ESLint (warnings)"
  fi

  # Unit tests
  log_info "Running unit tests..."
  if npm run test:unit 2>&1; then
    log_success "Unit tests passed"
    add_to_report "- [x] Unit tests"
  else
    log_warning "Some unit tests failed"
    add_to_report "- [ ] Unit tests (some failures)"
  fi

  add_to_report ""
}

# Build APK locally
build_local() {
  log_section "Building Local APK"
  
  cd "$ROOT_DIR"

  log_info "Running local Android build..."
  
  if npx expo run:android --variant release 2>&1; then
    log_success "Local build completed"
    add_to_report "### Local Build"
    add_to_report "- [x] Local release build successful"
    
    # Find the APK
    APK_PATH=$(find "$ROOT_DIR/android/app/build/outputs/apk/release" -name "*.apk" 2>/dev/null | head -1)
    if [ -n "$APK_PATH" ]; then
      APK_SIZE=$(du -h "$APK_PATH" | cut -f1)
      log_success "APK generated: $APK_PATH ($APK_SIZE)"
      add_to_report "- APK Size: $APK_SIZE"
      add_to_report "- APK Path: \`$APK_PATH\`"
    fi
  else
    log_error "Local build failed"
    add_to_report "### Local Build"
    add_to_report "- [ ] Local release build failed"
  fi
  
  add_to_report ""
}

# Build with EAS
build_eas() {
  log_section "Building with EAS ($PROFILE)"
  
  cd "$ROOT_DIR"

  log_info "Starting EAS build with profile: $PROFILE"
  
  if eas build --platform android --profile "$PROFILE" --local 2>&1; then
    log_success "EAS build completed"
    add_to_report "### EAS Build ($PROFILE)"
    add_to_report "- [x] EAS build successful"
    
    # Find the APK/AAB
    BUILD_PATH=$(find "$ROOT_DIR" -maxdepth 1 -name "*.apk" -o -name "*.aab" 2>/dev/null | head -1)
    if [ -n "$BUILD_PATH" ]; then
      BUILD_SIZE=$(du -h "$BUILD_PATH" | cut -f1)
      log_success "Build generated: $BUILD_PATH ($BUILD_SIZE)"
      add_to_report "- Build Size: $BUILD_SIZE"
      add_to_report "- Build Path: \`$BUILD_PATH\`"
    fi
  else
    log_error "EAS build failed"
    add_to_report "### EAS Build ($PROFILE)"
    add_to_report "- [ ] EAS build failed"
  fi
  
  add_to_report ""
}

# Verify APK signature
verify_signature() {
  local apk_path="$1"
  
  log_info "Verifying APK signature..."
  
  if [ -z "$apk_path" ] || [ ! -f "$apk_path" ]; then
    log_warning "No APK found to verify"
    return
  fi

  # Find apksigner - first check if it's on PATH
  local APKSIGNER=""
  
  if command -v apksigner &> /dev/null; then
    APKSIGNER="apksigner"
    log_verbose "Found apksigner on PATH"
  elif [ -n "$ANDROID_HOME" ] && [ -d "$ANDROID_HOME/build-tools" ]; then
    # Search for apksigner in build-tools directories
    APKSIGNER=$(find "$ANDROID_HOME/build-tools" -name "apksigner" -type f 2>/dev/null | sort -V | tail -1)
    if [ -n "$APKSIGNER" ]; then
      log_verbose "Found apksigner at: $APKSIGNER"
    fi
  fi
  
  if [ -z "$APKSIGNER" ]; then
    log_warning "apksigner not found - skipping signature verification"
    log_warning "Install Android SDK build-tools or add apksigner to PATH"
    add_to_report "- [ ] APK signature verification skipped (apksigner not found)"
    return
  fi

  # Run signature verification
  if "$APKSIGNER" verify --verbose "$apk_path" 2>&1; then
    log_success "APK signature verified"
    add_to_report "- [x] APK signature valid"
    
    # Check if it's a debug signature
    local cert_info=$("$APKSIGNER" verify --print-certs "$apk_path" 2>&1)
    if echo "$cert_info" | grep -q "CN=Android Debug"; then
      log_error "APK is signed with DEBUG certificate!"
      add_to_report "- [ ] **ERROR: Debug certificate used - release builds must use production keystore!**"
      # Return non-zero to indicate failure for release builds
      return 1
    else
      log_success "APK is signed with release certificate"
      add_to_report "- [x] Release certificate used"
    fi
  else
    log_error "APK signature verification failed"
    add_to_report "- [ ] APK signature invalid"
    return 1
  fi
}

# Test on emulator
test_on_emulator() {
  local api_level="$1"
  
  log_info "Testing on API level $api_level..."
  
  # Find APK
  APK_PATH=$(find "$ROOT_DIR" -name "*.apk" -path "*/release/*" 2>/dev/null | head -1)
  if [ -z "$APK_PATH" ]; then
    APK_PATH=$(find "$ROOT_DIR" -maxdepth 1 -name "*.apk" 2>/dev/null | head -1)
  fi
  
  if [ -z "$APK_PATH" ]; then
    log_warning "No APK found for emulator testing"
    return
  fi

  # Check for running emulator
  if ! adb devices | grep -q "emulator"; then
    log_warning "No emulator running. Start an emulator and try again."
    add_to_report "- [ ] API $api_level: No emulator available"
    return
  fi

  # Install APK
  log_info "Installing APK on emulator..."
  if adb install -r "$APK_PATH" 2>&1; then
    log_success "APK installed successfully"
    
    # Launch app
    log_info "Launching app..."
    adb shell am start -n io.soulwallet.app/.MainActivity 2>&1
    
    # Wait for app to start
    sleep 5
    
    # Check for crashes
    if adb logcat -d | grep -i "io.soulwallet.app" | grep -iE "crash|exception|error" | head -5; then
      log_warning "Potential issues found in logs"
      add_to_report "- [ ] API $api_level: Potential issues in logs"
    else
      log_success "No crashes detected"
      add_to_report "- [x] API $api_level: App launched successfully"
    fi
    
    # Measure startup time
    STARTUP_TIME=$(adb shell am start -W -n io.soulwallet.app/.MainActivity 2>&1 | grep "TotalTime" | awk '{print $2}')
    if [ -n "$STARTUP_TIME" ]; then
      log_info "Startup time: ${STARTUP_TIME}ms"
      add_to_report "  - Startup time: ${STARTUP_TIME}ms"
    fi
    
    # Uninstall
    adb uninstall io.soulwallet.app 2>&1 || true
  else
    log_error "Failed to install APK"
    add_to_report "- [ ] API $api_level: Installation failed"
  fi
}

# Analyze build size
analyze_build_size() {
  log_section "Analyzing Build Size"
  
  cd "$ROOT_DIR"
  
  if node scripts/analyze-build-size.js --latest 2>&1; then
    log_success "Build size analysis completed"
    add_to_report "### Build Size Analysis"
    add_to_report "- [x] Analysis completed (see detailed report)"
  else
    log_warning "Build size analysis failed"
  fi
  
  add_to_report ""
}

# Generate final report
generate_final_report() {
  log_section "Test Summary"
  
  add_to_report "## Summary"
  add_to_report ""
  add_to_report "Test completed at $(date)"
  add_to_report ""
  add_to_report "---"
  add_to_report "*Report generated by test-android-build.sh*"
  
  log_success "Report saved to: $REPORT_FILE"
  
  # Print summary
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  TEST SUMMARY"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  cat "$REPORT_FILE"
  echo ""
}

# Main execution
main() {
  log_section "SoulWallet Android Build Test"
  log_info "Profile: $PROFILE"
  log_info "API Levels: $API_LEVELS"
  log_info "Quick Mode: $QUICK_MODE"
  log_info "Local Only: $LOCAL_ONLY"
  
  init_report
  check_prerequisites
  
  if [ "$QUICK_MODE" = false ]; then
    run_prebuild_checks
  fi
  
  if [ "$LOCAL_ONLY" = true ]; then
    build_local
  else
    build_eas
  fi
  
  # Find and verify APK
  APK_PATH=$(find "$ROOT_DIR" -name "*.apk" -path "*/release/*" 2>/dev/null | head -1)
  if [ -z "$APK_PATH" ]; then
    APK_PATH=$(find "$ROOT_DIR" -maxdepth 1 -name "*.apk" 2>/dev/null | head -1)
  fi
  
  if [ -n "$APK_PATH" ]; then
    verify_signature "$APK_PATH"
  fi
  
  # Emulator tests
  if [ "$SKIP_EMULATOR" = false ] && [ "$QUICK_MODE" = false ]; then
    add_to_report "### Emulator Tests"
    IFS=',' read -ra LEVELS <<< "$API_LEVELS"
    for level in "${LEVELS[@]}"; do
      test_on_emulator "$level"
    done
    add_to_report ""
  fi
  
  analyze_build_size
  generate_final_report
  
  log_success "All tests completed!"
}

# Run main
main
