
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
process.chdir(root);
const run=(args)=>execFileSync(process.execPath,['node_modules/@capacitor/cli/bin/capacitor',...args],{stdio:'inherit'});
if(!existsSync('dist/index.html'))throw new Error('Run npm run build before preparing Android.');
// Geolocation 8.0.0 chooses the combined fine/coarse alias on Android < 12 even
// with enableHighAccuracy=false. Keep this app coarse-only on every supported OS.
// The native permission check is retained; this only selects its coarse alias.
const geoSource='node_modules/@capacitor/geolocation/android/src/main/kotlin/com/capacitorjs/plugins/geolocation/GeolocationPlugin.kt';
let geo=readFileSync(geoSource,'utf8');
const coarseAlias=`private fun getAlias(call: PluginCall): String {
        val enableHighAccuracy = call.getBoolean("enableHighAccuracy") ?: false
        return if (enableHighAccuracy) LOCATION_ALIAS else COARSE_LOCATION_ALIAS
    }`;
if(!geo.includes(coarseAlias)){
 const original=/private fun getAlias\(call: PluginCall\): String \{[\s\S]*?return alias\s*\}/;
 if(!original.test(geo))throw new Error('Review the geolocation permission compatibility patch for this plugin version.');
 geo=geo.replace(original,coarseAlias);writeFileSync(geoSource,geo);
}
if(!existsSync('android'))run(['add','android']);
run(['sync','android']);
const manifest='android/app/src/main/AndroidManifest.xml';
let xml=readFileSync(manifest,'utf8');
xml=xml.replace('android:allowBackup="true"','android:allowBackup="false"')
  .replace(/android:icon="[^"]+"/,'android:icon="@drawable/cinetracker_icon"')
  .replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@drawable/cinetracker_icon"');
// Nearby cinemas only need a one-shot approximate location. No background or
// precise-location permission is requested, and GPS hardware remains optional.
if(!xml.includes('android.permission.ACCESS_COARSE_LOCATION'))xml=xml.replace('</manifest>','    <uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />\n</manifest>');
writeFileSync(manifest,xml);
mkdirSync('android/app/src/main/res/drawable',{recursive:true});
// Reuse the existing app icon without introducing new branding.
copyFileSync('../public/icons/icon-512.png','android/app/src/main/res/drawable/cinetracker_icon.png');
const build=JSON.parse(readFileSync('src/build-info.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(build.version)||!Number.isSafeInteger(build.versionCode)||build.versionCode<1)throw new Error('Invalid Android version metadata');
let gradle=readFileSync('android/app/build.gradle','utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode '+build.versionCode).replace(/versionName "[^"]+"/,'versionName "'+build.version+'"');
writeFileSync('android/app/build.gradle',gradle);
console.log('Android project prepared at ' + path.resolve('android'));

