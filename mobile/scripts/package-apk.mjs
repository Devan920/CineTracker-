
import {readFileSync,writeFileSync,mkdirSync,copyFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const build=JSON.parse(readFileSync('mobile/src/build-info.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(build.version)||!Number.isSafeInteger(build.versionCode))throw new Error('Invalid build metadata');
mkdirSync('artifacts',{recursive:true});
const name='CineTracker-'+build.version+'-debug.apk', apk='artifacts/'+name;
copyFileSync('mobile/android/app/build/outputs/apk/debug/app-debug.apk',apk);
const tools=process.env.ANDROID_HOME+'/build-tools/36.0.0/';
execFileSync(tools+'apksigner',['verify','--verbose',apk],{stdio:'inherit'});
const info=execFileSync(tools+'aapt',['dump','badging',apk],{encoding:'utf8'});
if(!info.includes("versionCode='"+build.versionCode+"'")||!info.includes("versionName='"+build.version+"'"))throw new Error('APK version does not match update metadata');
writeFileSync('artifacts/apk-info.txt',info);
console.log(info.split('\n').slice(0,14).join('\n'));
const hash=createHash('sha256').update(readFileSync(apk)).digest('hex');
writeFileSync('artifacts/SHA256SUMS.txt',hash+'  '+name+'\n');
writeFileSync('artifacts/android-release.json',JSON.stringify({...build,apk:name,sha256:hash,commit:process.env.GITHUB_SHA},null,2)+'\n');
