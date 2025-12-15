## Summary
The build fails because Android signing credentials do not exist on EAS for the project, and EAS is trying to generate a new keystore in non-interactive mode (which is not allowed). The punycode warning is harmless. Environment variables are partially configured via the build profile and are fine.

## Root Cause
- "Generating a new Keystore is not supported in --non-interactive mode" indicates the Android keystore is missing on EAS. EAS cannot prompt to generate/upload it during a CI/non-interactive run.
- Env resolution message shows EXPO_PUBLIC_* variables are loaded from eas.json but no plain/sensitive variables are configured on the server; this is not a blocker unless your workflow requires them (e.g., Sentry auth token, private NPM token).

## Fix Plan
### 1) Ensure Android signing credentials exist (Remote)
- Use the EAS dashboard (Project → Credentials → Android) to add/upload a release keystore.
- Or run locally (interactive):
  - `eas login`
  - `eas credentials -p android` → Generate new keystore or upload existing
  - This stores the keystore on EAS for future non-interactive builds.
- Verify on EAS that the keystore is present for your project (app ID/package `io.soulwallet.app`).

### 2) Optional: Use Local credentials instead
- If you prefer storing the keystore locally:
  - Place your release keystore in the project (e.g., `android/release.keystore`).
  - Set `credentialsSource: "local"` for the target build profile in `eas.json`.
  - Ensure Gradle signing config points to this keystore via env vars or secure files.
- Note: This approach requires build-time access to the keystore (less convenient on CI).

### 3) Configure environment variables on EAS (as needed)
- In EAS → Project → Environment, add variables for the "production" environment:
  - Plain: `EXPO_PUBLIC_API_URL`, `EXPO_PUBLIC_SOLANA_RPC_URL`, etc. (already in `eas.json` env)
  - Sensitive: `SENTRY_AUTH_TOKEN` (for source map uploads), `NPM_TOKEN` (if using private packages)
  - Secret file (if needed): `GOOGLE_SERVICES_JSON` for Android.
- Reference: Expo docs on managing environment variables in EAS.

### 4) Re-run the build non-interactively
- After credentials are present on EAS:
  - `eas build --platform android --profile production --non-interactive`
- The build will use the stored keystore and succeed.

### 5) Post-build checks
- Confirm the signed artifact (AAB/APK) is produced.
- If using Sentry, verify release and source maps upload (requires `SENTRY_AUTH_TOKEN`).

## Contingency
- If you can’t add credentials via dashboard, run a one-time interactive build locally to generate the keystore and push to EAS.
- If you need automated builds across environments, consider configuring account-wide variables and secret files on EAS.

## Expected Outcome
- Android production build runs successfully in CI/non-interactive mode using remote credentials.
- Environment variables remain consistent and visible per EAS visibility settings; no change to app behavior.
