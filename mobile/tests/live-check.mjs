
import {Collector} from '../src/collector.ts';
import {mkdirSync,writeFileSync} from 'node:fs';
const map=new Map();
const store={getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};
const collector=new Collector(store,async url=>{
 const response=await fetch(url,{headers:{'User-Agent':'CinePulse/1.0 (CineTracker Android build verification)','Accept':'text/html,text/plain'},redirect:'manual',signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw new Error('HTTP '+response.status);
 return response.text();
});
const started=Date.now();
while(Date.now()-started<240000){
 const result=await collector.step();
 if(result.state==='complete'||result.state==='current')break;
 await new Promise(resolve=>setTimeout(resolve,Math.max(1,result.retryAfter??1)*1000));
}
const report=collector.getReport();
const summary={checkedAt:report.checkedAt,status:report.sourceStatus,refreshing:report.refreshing,movieCount:report.movies.length,errors:report.errors};
mkdirSync('../artifacts',{recursive:true});
writeFileSync('../artifacts/live-data-check.json',JSON.stringify(summary,null,2));
console.log('Live data verification: '+JSON.stringify(summary));
// Publisher availability is recorded separately from compilation. Never add a fabricated fallback.
