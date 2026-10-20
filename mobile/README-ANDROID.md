
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
