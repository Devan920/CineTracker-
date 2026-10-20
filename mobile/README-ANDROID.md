
# CineTracker Android

This app bundles the existing CineTracker screens in a Capacitor Android app. It preserves dark mode, watchlists, the leaders marquee, Devanarayanan's credit, and the three social links.

## Data behavior

The Android app reads the same public report pages through Android's HTTPS networking API and the existing validated parsers. It stores the last successful report on the device, checks every 20 minutes while open, and resumes when reopened. New releases are discovered from public listings. No ChatGPT sign-in, private-site access token, database credential, or old sample collection figures are embedded in the APK. Robots restrictions are honored; a blocked or failed request leaves existing values and timestamps intact. New installations show an empty/error state until reports can actually be loaded.

Figures remain published estimates. Neither a successful build nor a 20-minute refresh guarantees that a publisher has supplied newer figures, complete theatre coverage, or audited revenue. The regional marquee ranks film industries by worldwide gross; it does not claim region-specific ticket revenue.

## Build locally

Use Node.js 24, Java 21, Android SDK 36, and Android Studio supporting Capacitor 8.

    cd mobile
    npm install
    npm test
    npm run build
    npm run android:prepare
    cd android
    ./gradlew assembleDebug

Windows: use gradlew.bat assembleDebug.

Open the generated mobile/android folder in Android Studio. For future web changes, repeat npm run build and npm run android:prepare before building.

## Download and signing

The GitHub Actions workflow uploads CineTracker-1.0.0-debug.apk and an Android-ready source archive. The APK is signed with a development key for personal installation/testing, not a production release key. A later build can use a different debug key and may require uninstalling the previous test build. A production release requires your own securely backed-up signing key, supplied as a CI secret or through Android Studio. No private signing keys are committed or included in downloadable artifacts.

Website hosting and Android builds are separate. This change does not publish a new website version or create an unattended server scheduler.

## App update notifications (1.1.0)

The app reads public GitHub Releases for Devan920/CineTracker-. No account or API
token is stored in the APK. Settings includes Check for updates, current version,
last successful check, and Download update when a newer build exists. An in-app
banner appears on launch/resume; successful checks are cached for 6 hours and
failed automatic attempts are throttled for 15 minutes. Manual checks bypass the
cache. This is not an Android push notification or a silent installer.

Only published test releases tagged android-test-vVERSION-VERSIONCODE with an
uploaded CineTracker-VERSION-debug.apk asset are accepted. Drafts, unrelated tags,
missing files, foreign download URLs, same-version builds and downgrades are ignored.

### Publishing the next version

1. Update mobile/src/build-info.json with a higher integer versionCode and a new
   version, and match the version in mobile/package.json.
2. Update mobile/CHANGELOG.md with release notes.
3. Push the changes to codex/cinetracker-android-apk.
4. The workflow tests and builds the APK, verifies its signature and embedded
   version, uploads a source archive, then publishes a GitHub test release.
   The build job has read-only permissions; only the separate publishing job has
   contents write access. Already-published versions are not replaced.
5. Installed 1.1.0+ apps see the new release on their next eligible check, or
   immediately through Settings > Check for updates.

This remains development-signed. Configure a persistent private release signing
key before distributing production updates that must install in place. Never
commit signing keys or include them in public artifacts. The original 1.0.0
temporary debug key is not available to sign this version.

## Feedback (1.1.1)

Settings > Send feedback opens Devanarayanan's provided Instagram profile or
Telegram chat. The user writes and sends their message in that platform. No
feedback server, new sign-in flow, automatic message, or additional device
permission is needed. The original social links are also retained.
