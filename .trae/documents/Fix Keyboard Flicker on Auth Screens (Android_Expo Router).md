## Summary

* Expo SDK 52 is installed, but Metro and Expo config packages resolved to newer incompatible versions (54.x, Metro 0.83.x). This causes `npx expo start` to error. Expo Doctor already flags these mismatches.

## Key Findings

* Expo SDK: `expo@^52.0.47` (`b:\SOULWALLET\package.json:137`)

* CLI: `@expo/cli@^54.0.18` (`b:\SOULWALLET\package.json:203`)

* Metro in lockfile: 0.83.2 (Doctor shows mismatch) (`b:\SOULWALLET\expo-doctor-output.txt:20-31`)

* Mismatched packages flagged by Doctor:

  * `@expo/config-plugins` expected `~9.0.0`, found `54.0.x` (`b:\SOULWALLET\expo-doctor-output.txt:8-11`)

  * `@expo/prebuild-config` expected `^8.0.0`, found `54.0.x` (`b:\SOULWALLET\expo-doctor-output.txt:12-15`)

  * `@expo/metro-config` expected `~0.19.0`, found `54.0.x` (`b:\SOULWALLET\expo-doctor-output.txt:16-19`)

  * `metro`, `metro-resolver`, `metro-config` expected `^0.81.0`, found `0.83.2` (`b:\SOULWALLET\expo-doctor-output.txt:20-31`)

* Current Metro config is minimal and fine for SDK 52 (`b:\SOULWALLET\metro.config.js:1-5`).

## Fix Plan

### 1) Pin compatible versions via npm overrides

* Edit the `overrides` block to force SDK 52-compatible versions:

  * `@expo/config-plugins`: `~9.0.0`

  * `@expo/prebuild-config`: `^8.0.0`

  * `@expo/metro-config`: `~0.19.0`

  * `metro`: `^0.81.0`

  * `metro-resolver`: `^0.81.0`

  * `metro-config`: `^0.81.0`

* Location: `b:\SOULWALLET\package.json:234-238` (extend existing `overrides`).

* Rationale: Keeps CLI modern while forcing transitive dependencies required by SDK 52, aligning with Expo Doctor expectations.

### 2) Optional cleanup of Expo install exclusions

* Review `expo.install.exclude` for Metro packages (`b:\SOULWALLET\package.json:273-279`). If overrides are applied, we can keep this as-is. If conflicts persist, remove the exclusions to let Expo manage Metro versions.

### 3) Clean install and caches (Windows)

* Remove `node_modules` and `.expo` cache.

* Clear npm cache.

* Reinstall dependencies.

* Commands:

  * `rimraf node_modules .expo` (or delete via Explorer)

  * `npm cache verify`

  * `npm i`

  * `npx expo doctor --fix`

  * `npx expo start -c`

### 4) Validate Babel/Reanimated order

* Confirm `react-native-reanimated/plugin` is last (it is) (`b:\SOULWALLET\babel.config.js:20-22`).

* No changes required.

### 5) Verify Node and npm versions

* Use Node 18 or 20 LTS, npm ≥ 8. Run `node -v` and `npm -v`.

* On Windows PowerShell, ensure no execution policy blocks, and that global npx uses the project-local CLI.

## Verification Steps

* Run `npx expo doctor` and confirm 17/17 checks pass.

* Start dev server: `npx expo start -c`.

* Launch Android emulator: `a`, Web: `w`. Confirm hot reload works.

* If any residual Metro resolution errors occur, restore the minimal Metro config (`b:\SOULWALLET\metro.config.js:1-5`) and remove the backup file from being used.

## Contingency

* If overrides do not fully resolve:

  * Temporarily downgrade `@expo/cli` to a version aligned with SDK 52.

  * Remove direct `metro` dependency and let Expo manage it, then reinstall.

  * Run `npx expo prebuild --clean` to regenerate native projects (only if necessary).

## Expected Outcome

* `expo start` runs reliably without Metro or config-plugin version errors, matching SDK 52 expectations.

* Expo Doctor reports all checks passed, and development build succeeds on Android/iOS/Web.

