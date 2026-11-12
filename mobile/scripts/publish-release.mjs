
import {readFileSync,existsSync,writeFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const repo='Devan920/CineTracker-';
if(process.env.GITHUB_REPOSITORY!==repo||process.env.GITHUB_REF!=='refs/heads/codex/cinetracker-android-apk')throw new Error('Unexpected release repository or branch');
const build=JSON.parse(readFileSync('artifacts/android-release.json','utf8'));
if(!/^\d+\.\d+\.\d+$/.test(build.version)||!Number.isSafeInteger(build.versionCode)||build.versionCode<1||build.channel!=='android-test'||build.commit!==process.env.GITHUB_SHA)throw new Error('Invalid release metadata');
const expected='CineTracker-'+build.version+'-debug.apk';
if(build.apk!==expected||!existsSync('artifacts/'+expected))throw new Error('Missing APK');
if(createHash('sha256').update(readFileSync('artifacts/'+expected)).digest('hex')!==build.sha256)throw new Error('APK checksum mismatch');
const tag='android-test-v'+build.version+'-'+build.versionCode;
const gh=args=>execFileSync('gh',args,{stdio:'inherit'});
const check=await fetch('https://api.github.com/repos/'+repo+'/releases/tags/'+tag);
if(check.ok){
 const release=await check.json();
 if(!release.draft){console.log('This version is already published. Increase versionCode and version for a new update.');process.exit(0);}
 throw new Error('A draft already exists for this version; inspect it before publishing.');
}
if(check.status!==404)throw new Error('Unable to check existing release');
const notes=readFileSync('mobile/CHANGELOG.md','utf8')+'\n\nBuilt from '+build.commit+'.\n';
writeFileSync('artifacts/release-notes.md',notes);
gh(['release','create',tag,'artifacts/'+expected,'artifacts/CineTracker-Android-Source.zip','artifacts/SHA256SUMS.txt','artifacts/android-release.json',
 '--repo',repo,'--target',build.commit,'--title','CineTracker '+build.version+' (Android test build)',
 '--notes-file','artifacts/release-notes.md','--draft','--prerelease']);
gh(['release','edit',tag,'--repo',repo,'--draft=false']);
console.log('Published https://github.com/'+repo+'/releases/tag/'+tag);
