#!/bin/bash

# =============================================================================
# SOULWALLET ASSET OPTIMIZATION SCRIPT
# =============================================================================
# Optimizes app icons, splash screens, and image assets for production
#
# Usage:
#   bash scripts/optimize-assets.sh
#   bash scripts/optimize-assets.sh --icons-only
#   bash scripts/optimize-assets.sh --webp-only
#   bash scripts/optimize-assets.sh --dry-run
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
ASSETS_DIR="$ROOT_DIR/assets"
IMAGES_DIR="$ASSETS_DIR/images"
BACKUP_DIR="$ASSETS_DIR/images/originals"
ANDROID_RES_DIR="$ROOT_DIR/android/app/src/main/res"

# Default values
ICONS_ONLY=false
WEBP_ONLY=false
DRY_RUN=false
VERBOSE=false

# Statistics
ORIGINAL_SIZE=0
OPTIMIZED_SIZE=0
FILES_PROCESSED=0

# Parse arguments
while [[ $# -gt 0 ]]; do
  case $1 in
    --icons-only)
      ICONS_ONLY=true
      shift
      ;;
    --webp-only)
      WEBP_ONLY=true
      shift
      ;;
    --dry-run)
      DRY_RUN=true
      shift
      ;;
    --verbose|-v)
      VERBOSE=true
      shift
      ;;
    --help|-h)
      echo "Asset Optimization Script for SoulWallet"
      echo ""
      echo "Usage: bash scripts/optimize-assets.sh [options]"
      echo ""
      echo "Options:"
      echo "  --icons-only    Only optimize app icons"
      echo "  --webp-only     Only generate WebP versions"
      echo "  --dry-run       Preview changes without modifying files"
      echo "  --verbose, -v   Show detailed output"
      echo "  --help, -h      Show this help message"
      echo ""
      echo "Prerequisites:"
      echo "  - ImageMagick (convert command)"
      echo "  - pngquant (PNG optimization)"
      echo "  - cwebp (WebP conversion)"
      echo "  - svgo (SVG optimization, optional)"
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

log_verbose() {
  if [ "$VERBOSE" = true ]; then
    echo -e "${BLUE}[VERBOSE]${NC} $1"
  fi
}

# Check prerequisites
check_prerequisites() {
  log_info "Checking prerequisites..."
  
  local missing=()

  # Check ImageMagick
  if ! command -v convert &> /dev/null; then
    missing+=("ImageMagick (convert)")
  else
    log_verbose "ImageMagick: $(convert --version | head -1)"
  fi

  # Check pngquant
  if ! command -v pngquant &> /dev/null; then
    missing+=("pngquant")
  else
    log_verbose "pngquant: $(pngquant --version)"
  fi

  # Check cwebp
  if ! command -v cwebp &> /dev/null; then
    missing+=("cwebp (libwebp)")
  else
    log_verbose "cwebp: $(cwebp -version 2>&1 | head -1)"
  fi

  # Check svgo (optional)
  if command -v svgo &> /dev/null; then
    log_verbose "svgo: $(svgo --version)"
  else
    log_warning "svgo not found - SVG optimization will be skipped"
  fi

  if [ ${#missing[@]} -gt 0 ]; then
    log_error "Missing required tools: ${missing[*]}"
    echo ""
    echo "Installation instructions:"
    echo "  macOS:   brew install imagemagick pngquant webp"
    echo "  Ubuntu:  sudo apt-get install imagemagick pngquant webp"
    echo "  Windows: Use chocolatey or download from official sites"
    exit 1
  fi

  log_success "All prerequisites met"
}

# Get file size in bytes
get_file_size() {
  if [[ "$OSTYPE" == "darwin"* ]]; then
    stat -f%z "$1" 2>/dev/null || echo 0
  else
    stat -c%s "$1" 2>/dev/null || echo 0
  fi
}

# Format bytes to human readable
format_bytes() {
  local bytes=$1
  if [ $bytes -lt 1024 ]; then
    echo "${bytes}B"
  elif [ $bytes -lt 1048576 ]; then
    echo "$((bytes / 1024))KB"
  else
    echo "$((bytes / 1048576))MB"
  fi
}

# Create backup
create_backup() {
  local file="$1"
  
  if [ "$DRY_RUN" = true ]; then
    log_verbose "Would backup: $file"
    return
  fi

  mkdir -p "$BACKUP_DIR"
  
  local filename=$(basename "$file")
  if [ ! -f "$BACKUP_DIR/$filename" ]; then
    cp "$file" "$BACKUP_DIR/$filename"
    log_verbose "Backed up: $filename"
  fi
}

# Optimize PNG with pngquant
optimize_png() {
  local file="$1"
  local quality="${2:-80-95}"
  
  local original_size=$(get_file_size "$file")
  ORIGINAL_SIZE=$((ORIGINAL_SIZE + original_size))
  
  # Guard against zero-byte files to prevent divide by zero
  if [ "$original_size" -eq 0 ]; then
    log_verbose "Skipping zero-byte file: $(basename "$file")"
    return
  fi
  
  if [ "$DRY_RUN" = true ]; then
    log_verbose "Would optimize PNG: $file"
    OPTIMIZED_SIZE=$((OPTIMIZED_SIZE + original_size))
    return
  fi

  create_backup "$file"
  
  # Run pngquant
  pngquant --quality="$quality" --force --output "$file" "$file" 2>/dev/null || true
  
  local new_size=$(get_file_size "$file")
  OPTIMIZED_SIZE=$((OPTIMIZED_SIZE + new_size))
  FILES_PROCESSED=$((FILES_PROCESSED + 1))
  
  # Only compute percentage if original_size > 0 (already checked above, but be safe)
  if [ "$original_size" -gt 0 ]; then
    local saved=$((original_size - new_size))
    local percent=$((saved * 100 / original_size))
    log_verbose "Optimized: $(basename "$file") - saved $(format_bytes $saved) ($percent%)"
  else
    log_verbose "Optimized: $(basename "$file") - new size $(format_bytes $new_size)"
  fi
}

# Convert to WebP
convert_to_webp() {
  local file="$1"
  local quality="${2:-80}"
  
  local webp_file="${file%.*}.webp"
  
  if [ "$DRY_RUN" = true ]; then
    log_verbose "Would convert to WebP: $file"
    return
  fi

  cwebp -q "$quality" "$file" -o "$webp_file" 2>/dev/null
  
  local original_size=$(get_file_size "$file")
  local webp_size=$(get_file_size "$webp_file")
  
  if [ $webp_size -lt $original_size ]; then
    local saved=$((original_size - webp_size))
    local percent=$((saved * 100 / original_size))
    log_verbose "Created WebP: $(basename "$webp_file") - saved $(format_bytes $saved) ($percent%)"
  else
    # WebP is larger, remove it
    rm "$webp_file"
    log_verbose "WebP larger than original, keeping PNG: $(basename "$file")"
  fi
}

# Generate Android icon sizes
generate_android_icons() {
  local source="$1"
  
  log_info "Generating Android icons from: $source"
  
  if [ ! -f "$source" ]; then
    log_error "Source icon not found: $source"
    return
  fi

  # Android icon sizes
  declare -A sizes=(
    ["mipmap-mdpi"]=48
    ["mipmap-hdpi"]=72
    ["mipmap-xhdpi"]=96
    ["mipmap-xxhdpi"]=144
    ["mipmap-xxxhdpi"]=192
  )

  for density in "${!sizes[@]}"; do
    local size=${sizes[$density]}
    local output_dir="$ANDROID_RES_DIR/$density"
    local output_file="$output_dir/ic_launcher.png"
    
    if [ "$DRY_RUN" = true ]; then
      log_verbose "Would generate: $output_file (${size}x${size})"
      continue
    fi

    mkdir -p "$output_dir"
    convert "$source" -resize "${size}x${size}" "$output_file"
    optimize_png "$output_file" "90-100"
    
    log_verbose "Generated: $density/ic_launcher.png (${size}x${size})"
  done

  log_success "Android icons generated"
}

# Generate Android adaptive icon
generate_adaptive_icon() {
  local foreground="$1"
  local background_color="${2:-#101428}"
  
  log_info "Generating adaptive icon..."
  
  if [ ! -f "$foreground" ]; then
    log_error "Foreground image not found: $foreground"
    return
  fi

  # Adaptive icon sizes (foreground needs padding)
  declare -A sizes=(
    ["mipmap-mdpi"]=108
    ["mipmap-hdpi"]=162
    ["mipmap-xhdpi"]=216
    ["mipmap-xxhdpi"]=324
    ["mipmap-xxxhdpi"]=432
  )

  for density in "${!sizes[@]}"; do
    local size=${sizes[$density]}
    local output_dir="$ANDROID_RES_DIR/$density"
    
    if [ "$DRY_RUN" = true ]; then
      log_verbose "Would generate adaptive icon: $density (${size}x${size})"
      continue
    fi

    mkdir -p "$output_dir"
    
    # Generate foreground with padding (icon should be 66% of total size)
    local icon_size=$((size * 66 / 100))
    local padding=$(((size - icon_size) / 2))
    
    convert "$foreground" \
      -resize "${icon_size}x${icon_size}" \
      -gravity center \
      -background none \
      -extent "${size}x${size}" \
      "$output_dir/ic_launcher_foreground.png"
    
    # Generate background
    convert -size "${size}x${size}" "xc:$background_color" "$output_dir/ic_launcher_background.png"
    
    log_verbose "Generated adaptive icon: $density"
  done

  log_success "Adaptive icons generated"
}

# Generate splash screen sizes
generate_splash_screens() {
  local source="$1"
  
  log_info "Generating splash screens from: $source"
  
  if [ ! -f "$source" ]; then
    log_error "Source splash not found: $source"
    return
  fi

  # Splash screen sizes
  declare -A sizes=(
    ["drawable-mdpi"]="320x480"
    ["drawable-hdpi"]="480x800"
    ["drawable-xhdpi"]="720x1280"
    ["drawable-xxhdpi"]="1080x1920"
    ["drawable-xxxhdpi"]="1440x2560"
  )

  for density in "${!sizes[@]}"; do
    local size=${sizes[$density]}
    local output_dir="$ANDROID_RES_DIR/$density"
    local output_file="$output_dir/splashscreen.png"
    
    if [ "$DRY_RUN" = true ]; then
      log_verbose "Would generate: $output_file ($size)"
      continue
    fi

    mkdir -p "$output_dir"
    convert "$source" -resize "$size" -gravity center -background "#101428" -extent "$size" "$output_file"
    optimize_png "$output_file" "85-95"
    
    log_verbose "Generated: $density/splashscreen.png ($size)"
  done

  log_success "Splash screens generated"
}

# Optimize all images in directory
optimize_all_images() {
  local dir="$1"
  
  log_info "Optimizing images in: $dir"
  
  # Find all PNG files
  while IFS= read -r -d '' file; do
    # Skip backup directory
    if [[ "$file" == *"/originals/"* ]]; then
      continue
    fi
    
    optimize_png "$file"
    
    if [ "$WEBP_ONLY" = false ]; then
      convert_to_webp "$file"
    fi
  done < <(find "$dir" -name "*.png" -type f -print0 2>/dev/null)

  # Find all JPG files
  while IFS= read -r -d '' file; do
    if [[ "$file" == *"/originals/"* ]]; then
      continue
    fi
    
    convert_to_webp "$file"
  done < <(find "$dir" -name "*.jpg" -o -name "*.jpeg" -type f -print0 2>/dev/null)
}

# Optimize SVG files
optimize_svgs() {
  local dir="$1"
  
  if ! command -v svgo &> /dev/null; then
    return
  fi

  log_info "Optimizing SVG files..."
  
  while IFS= read -r -d '' file; do
    if [ "$DRY_RUN" = true ]; then
      log_verbose "Would optimize SVG: $file"
      continue
    fi

    local original_size=$(get_file_size "$file")
    svgo --multipass "$file" -o "$file" 2>/dev/null
    local new_size=$(get_file_size "$file")
    
    local saved=$((original_size - new_size))
    if [ $saved -gt 0 ]; then
      log_verbose "Optimized SVG: $(basename "$file") - saved $(format_bytes $saved)"
    fi
  done < <(find "$dir" -name "*.svg" -type f -print0 2>/dev/null)
}

# Print summary
print_summary() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  OPTIMIZATION SUMMARY"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""
  
  if [ "$DRY_RUN" = true ]; then
    echo "  Mode: DRY RUN (no files modified)"
  else
    echo "  Files processed: $FILES_PROCESSED"
    echo "  Original size:   $(format_bytes $ORIGINAL_SIZE)"
    echo "  Optimized size:  $(format_bytes $OPTIMIZED_SIZE)"
    
    if [ $ORIGINAL_SIZE -gt 0 ]; then
      local saved=$((ORIGINAL_SIZE - OPTIMIZED_SIZE))
      local percent=$((saved * 100 / ORIGINAL_SIZE))
      echo "  Size reduction:  $(format_bytes $saved) ($percent%)"
    fi
    
    if [ -d "$BACKUP_DIR" ]; then
      echo ""
      echo "  Backups saved to: $BACKUP_DIR"
    fi
  fi
  
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
}

# Main execution
main() {
  echo ""
  echo "═══════════════════════════════════════════════════════════════"
  echo "  SOULWALLET ASSET OPTIMIZATION"
  echo "═══════════════════════════════════════════════════════════════"
  echo ""

  if [ "$DRY_RUN" = true ]; then
    log_warning "DRY RUN MODE - No files will be modified"
    echo ""
  fi

  check_prerequisites

  if [ "$ICONS_ONLY" = true ]; then
    # Only optimize icons
    if [ -f "$IMAGES_DIR/icon.png" ]; then
      generate_android_icons "$IMAGES_DIR/icon.png"
    fi
    if [ -f "$IMAGES_DIR/adaptive-icon.png" ]; then
      generate_adaptive_icon "$IMAGES_DIR/adaptive-icon.png"
    fi
  elif [ "$WEBP_ONLY" = true ]; then
    # Only generate WebP versions
    optimize_all_images "$IMAGES_DIR"
  else
    # Full optimization
    
    # Optimize icons
    if [ -f "$IMAGES_DIR/icon.png" ]; then
      optimize_png "$IMAGES_DIR/icon.png"
      generate_android_icons "$IMAGES_DIR/icon.png"
    fi
    
    # Optimize adaptive icon
    if [ -f "$IMAGES_DIR/adaptive-icon.png" ]; then
      optimize_png "$IMAGES_DIR/adaptive-icon.png"
      generate_adaptive_icon "$IMAGES_DIR/adaptive-icon.png"
    fi
    
    # Optimize splash screen
    if [ -f "$IMAGES_DIR/splash.png" ]; then
      optimize_png "$IMAGES_DIR/splash.png"
      generate_splash_screens "$IMAGES_DIR/splash.png"
    fi
    
    # Optimize all other images
    optimize_all_images "$IMAGES_DIR"
    
    # Optimize SVGs
    optimize_svgs "$IMAGES_DIR"
  fi

  print_summary
  
  log_success "Asset optimization complete!"
}

# Run main
main
