#!/bin/bash
# Image Optimization Script for SoulWallet
# Optimizes all images in assets/ directory for smaller bundle sizes

set -e

echo "========================================"
echo "SoulWallet Image Optimization"
echo "========================================"

# Check for required tools
check_tool() {
  if ! command -v "$1" &> /dev/null; then
    echo "Warning: $1 not installed, skipping $2 optimization"
    return 1
  fi
  return 0
}

# Count original sizes
echo "Calculating original sizes..."
ORIGINAL_SIZE=$(du -sh assets/ 2>/dev/null | cut -f1 || echo "unknown")
echo "Original assets size: $ORIGINAL_SIZE"

# Optimize PNG files
if check_tool pngquant "PNG"; then
  echo ""
  echo "Optimizing PNG files..."
  find assets/ -name "*.png" -type f 2>/dev/null | while read -r file; do
    if [ -f "$file" ]; then
      pngquant --quality=65-80 --ext .png --force "$file" 2>/dev/null || true
      echo "  Optimized: $file"
    fi
  done
else
  echo "Skipping PNG optimization (install pngquant)"
fi

# Optimize JPG files
if check_tool jpegoptim "JPG"; then
  echo ""
  echo "Optimizing JPG/JPEG files..."
  find assets/ -name "*.jpg" -o -name "*.jpeg" -type f 2>/dev/null | while read -r file; do
    if [ -f "$file" ]; then
      jpegoptim --max=85 --strip-all "$file" 2>/dev/null || true
      echo "  Optimized: $file"
    fi
  done
else
  echo "Skipping JPG optimization (install jpegoptim)"
fi

# Optimize SVG files (remove metadata)
if check_tool svgo "SVG"; then
  echo ""
  echo "Optimizing SVG files..."
  find assets/ -name "*.svg" -type f 2>/dev/null | while read -r file; do
    if [ -f "$file" ]; then
      svgo --quiet "$file" 2>/dev/null || true
      echo "  Optimized: $file"
    fi
  done
else
  echo "Skipping SVG optimization (install svgo: npm i -g svgo)"
fi

# Final size
echo ""
NEW_SIZE=$(du -sh assets/ 2>/dev/null | cut -f1 || echo "unknown")
echo "========================================"
echo "Image optimization complete!"
echo "Original size: $ORIGINAL_SIZE"
echo "New size: $NEW_SIZE"
echo "========================================"
