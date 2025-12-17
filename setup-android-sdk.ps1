# Android SDK Setup Script
# Run this in PowerShell as Administrator

Write-Host "Setting up Android SDK for local APK builds..." -ForegroundColor Green

# Step 1: Create SDK directory
$sdkPath = "$env:LOCALAPPDATA\Android\Sdk"
Write-Host "`nStep 1: Creating SDK directory at $sdkPath" -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path $sdkPath | Out-Null
New-Item -ItemType Directory -Force -Path "$sdkPath\cmdline-tools" | Out-Null

Write-Host "✓ SDK directory created" -ForegroundColor Green

# Step 2: Download command line tools
Write-Host "`nStep 2: Downloading Android Command Line Tools..." -ForegroundColor Yellow
Write-Host "Please download manually from: https://developer.android.com/studio#command-line-tools-only" -ForegroundColor Cyan
Write-Host "Look for: 'Command line tools only' for Windows" -ForegroundColor Cyan
Write-Host "Download: commandlinetools-win-XXXXXX_latest.zip" -ForegroundColor Cyan
Write-Host "`nAfter downloading, extract the ZIP and move the 'cmdline-tools' folder to:" -ForegroundColor Yellow
Write-Host "$sdkPath\cmdline-tools\latest" -ForegroundColor Cyan
Write-Host "`nPress Enter when done..." -ForegroundColor Yellow
Read-Host

# Step 3: Set environment variables
Write-Host "`nStep 3: Setting environment variables..." -ForegroundColor Yellow

[System.Environment]::SetEnvironmentVariable('ANDROID_HOME', $sdkPath, 'User')
Write-Host "✓ ANDROID_HOME set to: $sdkPath" -ForegroundColor Green

$currentPath = [System.Environment]::GetEnvironmentVariable('Path', 'User')
if ($currentPath -notlike "*Android\Sdk\platform-tools*") {
    $newPath = "$currentPath;$sdkPath\platform-tools;$sdkPath\cmdline-tools\latest\bin"
    [System.Environment]::SetEnvironmentVariable('Path', $newPath, 'User')
    Write-Host "✓ Added Android SDK to PATH" -ForegroundColor Green
} else {
    Write-Host "✓ Android SDK already in PATH" -ForegroundColor Green
}

# Refresh environment in current session
$env:ANDROID_HOME = $sdkPath
$env:Path += ";$sdkPath\platform-tools;$sdkPath\cmdline-tools\latest\bin"

Write-Host "`nStep 4: Installing SDK packages..." -ForegroundColor Yellow
Write-Host "Run these commands after restarting your terminal:" -ForegroundColor Cyan
Write-Host ""
Write-Host "sdkmanager --sdk_root=`$env:ANDROID_HOME `"platform-tools`" `"platforms;android-34`" `"build-tools;34.0.0`"" -ForegroundColor White
Write-Host ""

Write-Host "`n✓ Setup complete! " -ForegroundColor Green
Write-Host "`nIMPORTANT: " -ForegroundColor Red
Write-Host "1. Close ALL PowerShell windows" -ForegroundColor Yellow
Write-Host "2. Open a NEW PowerShell window" -ForegroundColor Yellow
Write-Host "3. Verify with: adb --version" -ForegroundColor Yellow
Write-Host "`nThen you can build with:" -ForegroundColor Green
Write-Host "eas build --platform android --local --profile preview" -ForegroundColor Cyan
