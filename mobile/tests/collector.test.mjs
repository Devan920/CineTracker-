
import test from 'node:test';
import assert from 'node:assert/strict';
import {Collector} from '../src/collector.ts';
import {REFRESH_MS,SOURCE,CATALOG_URL} from '../../lib/boxoffice.ts';
const detail=SOURCE+'/quicknews/Test_2026_Box_Office_Collection_Day_2';
const live='<section data-lvp-film><h2><a href="/movie/Test_2026">Test Film</a></h2><div>Hindi · Day 2 today</div></section>';
const catalog='<div class="movie-card"><a href="/movie/Test_2026"><h3>Test Film (Bollywood)</h3></a>Net: ₹12Cr Gross: ₹14Cr WW: ₹17Cr Days: 2</div>';
const daily='<head><meta name="keywords" content="Bollywood movies"></head><h1>Test Film Box Office Collection Day 2</h1><script type="application/ld+json">{"@type":"WebPage","datePublished":"2026-10-20T10:00:00Z","dateModified":"2026-10-20T10:00:00Z"}</script><p class="article-summary">total India net to ₹12 Cr. total India gross collections to ₹14 Cr. worldwide gross collection to ₹17 Cr. total overseas gross to ₹3 Cr.</p><script>const labels=["Day 1","Day 2"];const netData=[10,2];</script>';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function fixture(){
 let clock=Date.parse('2026-10-20T12:00:00Z'),fail=false,deny=false,requests=0,extra=false;
 const store=storage();
 const fetcher=async url=>{
  requests++;if(fail)throw new Error('HTTP 503');
  if(url.endsWith('/robots.txt'))return deny?'User-agent: *\nDisallow: /':'User-agent: *\nAllow: /\nCrawl-delay: 1';
  if(url===SOURCE+'/live')return live;
  if(url===SOURCE+'/')return '<a href="'+detail+'">daily</a>';
  if(url===CATALOG_URL)return catalog+(extra?'<div class="movie-card"><a href="/movie/New_Film_2026"><h3>New Film (Mollywood)</h3></a>Net: ₹1Cr Gross: ₹1.2Cr WW: ₹2Cr Days: 1</div>':'');
  return daily;
 };
 const instance=()=>new Collector(store,fetcher,()=>clock);
 const finish=async app=>{for(let i=0;i<20;i++){clock+=2000;const r=await app.step();if(r.state==='complete'||r.state==='current')return r;}throw new Error('Refresh did not complete');};
 return {instance,finish,advance:n=>clock+=n,fail:()=>fail=true,deny:()=>deny=true,extra:()=>extra=true,count:()=>requests};
}
test('first install has no sample figures; refresh resumes, validates, and waits 20 minutes',async()=>{
 const f=fixture();let app=f.instance();
 assert.equal(app.getReport().movies.length,0);
 await app.step();app=f.instance();assert.equal(app.getReport().refreshing,true);
 await f.finish(app);
 assert.equal(app.getReport().movies[0].indiaNet,12);
 assert.equal(app.getReport().movies[0].worldwide,17);
 assert.equal(app.getReport().movies[0].industry,'Bollywood');
 const count=f.count();assert.equal((await app.step()).state,'current');assert.equal(f.count(),count);
 f.advance(REFRESH_MS);f.extra();await f.finish(app);
 assert.ok(app.getReport().movies.some(m=>m.title==='New Film'));
});
test('a source outage preserves the last successful timestamp and values',async()=>{
 const f=fixture(),app=f.instance();await f.finish(app);
 const previous=app.getReport();f.advance(REFRESH_MS);f.fail();await f.finish(app);
 assert.equal(app.getReport().sourceStatus,'error');
 assert.equal(app.getReport().checkedAt,previous.checkedAt);
 assert.equal(app.getReport().movies[0].indiaNet,previous.movies[0].indiaNet);
});
test('robots restrictions are honored without collecting blocked pages',async()=>{
 const f=fixture();f.deny();const app=f.instance();await f.finish(app);
 assert.equal(f.count(),1);assert.equal(app.getReport().movies.length,0);assert.equal(app.getReport().sourceStatus,'error');
});
test('offline first launch does not manufacture a successful check',async()=>{
 const f=fixture();f.fail();const app=f.instance();await f.finish(app);
 assert.equal(app.getReport().checkedAt,null);assert.deepEqual(app.getReport().movies,[]);
});
