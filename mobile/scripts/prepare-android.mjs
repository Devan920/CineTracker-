
import {existsSync,readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import path from 'node:path';

const root=fileURLToPath(new URL('..',import.meta.url));
process.chdir(root);
const run=(args)=>execFileSync(process.execPath,['node_modules/@capacitor/cli/bin/capacitor',...args],{stdio:'inherit'});
if(!existsSync('dist/index.html'))throw new Error('Run npm run build before preparing Android.');
if(!existsSync('android'))run(['add','android']);
run(['sync','android']);
const manifest='android/app/src/main/AndroidManifest.xml';
let xml=readFileSync(manifest,'utf8');
xml=xml.replace('android:allowBackup="true"','android:allowBackup="false"')
  .replace(/android:icon="[^"]+"/,'android:icon="@drawable/cinetracker_icon"')
  .replace(/android:roundIcon="[^"]+"/,'android:roundIcon="@drawable/cinetracker_icon"');
writeFileSync(manifest,xml);
mkdirSync('android/app/src/main/res/drawable',{recursive:true});
// Reuse the existing app icon without introducing new branding.
copyFileSync('../public/icons/icon-512.png','android/app/src/main/res/drawable/cinetracker_icon.png');
let gradle=readFileSync('android/app/build.gradle','utf8');
gradle=gradle.replace(/versionCode \d+/,'versionCode 1').replace(/versionName "[^"]+"/,'versionName "1.0.0"');
writeFileSync('android/app/build.gradle',gradle);
console.log('Android project prepared at ' + path.resolve('android'));
