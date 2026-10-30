
import {Collector} from '../src/collector.ts';
import {MovieLibrary} from '../src/movie-library.ts';
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
const library=new MovieLibrary(async url=>{
 const response=await fetch(url,{headers:{'User-Agent':'CinePulse/1.0 (CineTracker Android build verification)'},redirect:'manual',signal:AbortSignal.timeout(18000)});
 if(!response.ok)throw new Error('HTTP '+response.status);return response.text();
},store);
const archive=await library.getArchive();
let metadata;
try{const film=await library.getDetails('Manjummel Boys',2024);metadata={title:film.title,castCount:film.cast.length,storyAvailable:Boolean(film.story),checkedAt:film.checkedAt};}
catch(error){metadata={error:error.message};}
const librarySummary={archiveCount:archive.movies.length,archiveCheckedAt:archive.checkedAt,archiveError:archive.error??null,metadata};
writeFileSync('../artifacts/live-movie-library-check.json',JSON.stringify(librarySummary,null,2));
console.log('Live movie library verification: '+JSON.stringify(librarySummary));

