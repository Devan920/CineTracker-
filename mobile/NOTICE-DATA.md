# Cinema directory and location lookup

`lib/cinemas-india.json` contains a filtered OpenStreetMap cinema directory for
India, including names, public venue positions and city names. It is distributed
under the Open Database License (ODbL) 1.0, with attribution to OpenStreetMap
contributors: https://www.openstreetmap.org/copyright
License: https://opendatacommons.org/licenses/odbl/1-0/

The directory is a map snapshot, not a list of current film screenings or an
inventory of free seats. Cinema capacity tags are deliberately excluded.
The app includes the same attribution and provides booking/search links for
users to verify the film, show date/time and seat availability themselves.

Location permission is requested only after an explicit user action. The app
requests approximate foreground location, rounds coordinates to two decimal
places, finds nearby cinemas locally, and keeps the selected area in session
memory. It does not send device coordinates to a cinema search server or retain
them in localStorage. There is no background location tracking.

Manual town lookup sends only the typed town name to Open-Meteo's geocoding API,
whose location data comes from GeoNames. Attribution is displayed in the app.
Open-Meteo's free endpoint is for non-commercial use within its rate limits;
this ad-free test app uses explicit searches, request pacing and memory caching.
Commercial distribution requires an appropriate service agreement.
https://open-meteo.com/en/docs/geocoding-api
https://open-meteo.com/en/terms

Directory refresh is a manual maintenance action:

    cd mobile
    node scripts/refresh-cinema-directory.mjs

The public Overpass server is not used as a runtime backend by installed apps.
Rebuild and publish an APK after updating the directory.
