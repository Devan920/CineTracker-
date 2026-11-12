
import test from 'node:test';
import assert from 'node:assert/strict';
import {UpdateChecker, selectUpdate, UPDATE_INTERVAL} from '../src/updates.ts';
const root='https://github.com/Devan920/CineTracker-/releases/';
function release(version='1.2.0',build=3) {
 const tag='android-test-v'+version+'-'+build, filename='CineTracker-'+version+'-debug.apk';
 return {tag_name:tag,draft:false,prerelease:true,html_url:root+'tag/'+tag,
  published_at:'2026-10-20T18:00:00Z',assets:[{name:filename,state:'uploaded',size:3000000,
  browser_download_url:root+'download/'+tag+'/'+filename}]};
}
function storage(){const data=new Map();return {getItem:key=>data.get(key)??null,setItem:(key,value)=>data.set(key,value)};}
test('only a newer published Android APK in the correct repository becomes an update',()=>{
 const candidate=release();
 assert.equal(selectUpdate([release('1.0.0',1),candidate,release('1.1.0',2)],2)?.versionCode,3);
 assert.equal(selectUpdate([release('1.1.0',2)],2),null);
 for(const invalid of [
  {...candidate,draft:true}, {...candidate,prerelease:false}, {...candidate,assets:[]},
  {...candidate,tag_name:'Movie'}, {...candidate,html_url:'https://evil.example/release'},
  {...candidate,assets:[{...candidate.assets[0],browser_download_url:'https://evil.example/update.apk'}]},
  {...candidate,assets:[{...candidate.assets[0],state:'open'}]},
  {...candidate,assets:[{...candidate.assets[0],size:0}]},
 ]) assert.equal(selectUpdate([invalid],2),null);
 assert.throws(()=>selectUpdate({message:'Rate limited'},2));
});
test('automatic checks throttle, manual checks refresh, and dismissal survives restart',async()=>{
 let now=Date.parse('2026-10-20T18:30:00Z'), calls=0;
 const cache=storage(), opts={version:'1.1.0',build:2,storage:cache,now:()=>now,
  fetchReleases:async()=>{calls++;return [release()];}};
 const checker=new UpdateChecker(opts);
 assert.equal((await checker.check()).status,'available');
 await checker.check();assert.equal(calls,1);
 await checker.check(true);assert.equal(calls,2);
 checker.dismiss();assert.equal(checker.getSnapshot().dismissedBuild,3);
 const restarted=new UpdateChecker(opts);
 assert.equal(restarted.getSnapshot().latest.version,'1.2.0');
 assert.equal(restarted.getSnapshot().dismissedBuild,3);
 await restarted.check();assert.equal(calls,2);
 now+=UPDATE_INTERVAL;await restarted.check();assert.equal(calls,3);
 // An installed update must not continue advertising itself from cached metadata.
 const upgraded=new UpdateChecker({...opts,version:'1.2.0',build:3});
 assert.equal(upgraded.getSnapshot().latest,null);
});
test('failed checks retain known updates and last success, then recover without a false latest claim',async()=>{
 let fail=false, calls=0;
 const checker=new UpdateChecker({version:'1.1.0',build:2,storage:storage(),
  fetchReleases:async()=>{calls++;if(fail)throw new Error('Service unavailable');return [release()];}});
 await checker.check();const checkedAt=checker.getSnapshot().checkedAt;
 fail=true;await checker.check(true);
 assert.equal(checker.getSnapshot().status,'error');
 assert.equal(checker.getSnapshot().latest.versionCode,3);
 assert.equal(checker.getSnapshot().checkedAt,checkedAt);
 await checker.check();assert.equal(calls,2);
 fail=false;assert.equal((await checker.check(true)).status,'available');
 const offline=new UpdateChecker({version:'1.1.0',build:2,storage:storage(),online:()=>false,
  fetchReleases:async()=>{throw new Error('Must not request while offline');}});
 assert.equal((await offline.check(true)).status,'error');
 assert.equal(offline.getSnapshot().checkedAt,null);
});
test('concurrent update checks share a request and storage failures never break the app',async()=>{
 let resolve, calls=0;
 const waiting=new Promise(r=>{resolve=r;});
 const checker=new UpdateChecker({version:'1.1.0',build:2,
  storage:{getItem(){throw new Error('Storage unavailable');},setItem(){throw new Error('Full');}},
  fetchReleases:async()=>{calls++;return waiting;}});
 const first=checker.check(), second=checker.check(true);
 assert.equal(first,second);
 resolve([]);await first;
 assert.equal(calls,1);assert.equal(checker.getSnapshot().status,'current');
});
