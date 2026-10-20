# CineTracker 1.1.0

- See an Update available banner when a newer Android test build is published.
- Check for updates from Settings and download the new APK directly.
- Automatic checks on launch/resume, at most once every 6 hours.
- Dismiss the banner and download later from Settings.
- Offline and service errors preserve the last successful check.
- Existing dark mode, social links, watchlist, and collection updates are preserved.

## Installing this test build

Download the APK and open it on Android. This is a development-signed test build.
The original 1.0.0 APK used a temporary debug signing key, so Android may require
uninstalling that build first. Uninstalling removes local watchlists and settings.
Subsequent test builds can also have different debug keys. A persistent private
release-signing key is required before promising in-place production updates.

Update checks do not silently install APKs or run while the app is closed.
Collection figures continue to refresh every 20 minutes while the app is open;
app-version checks use a separate 6-hour interval.
