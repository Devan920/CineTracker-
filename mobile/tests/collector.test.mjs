import test from 'node:test';
import assert from 'node:assert/strict';
import {Collector} from '../src/collector.ts';
import {REFRESH_MS,INDIAN_BOX_OFFICE_RSS_URL} from '../../lib/boxoffice.ts';

const feed='<?xml version="1.0" encoding="UTF-8"?><rss version="2.0"><channel><title>Indian Box Office</title><link>https://indian-boxoffice.com/</link><description>Consensus estimates</description><item><title>Test Film box office — ₹17.0 Cr WW / ₹12.0 Cr India nett</title><link>https://indian-boxoffice.com/movies/test-film-2026/</link><guid>https://indian-boxoffice.com/movies/test-film-2026/</guid><pubDate>Tue, 20 Oct 2026 12:00:00 GMT</pubDate><description>Test Film (Hindi) — verdict Hit. India nett ₹12.0 Cr, worldwide ₹17.0 Cr.</description></item></channel></rss>';
const storage=()=>{const map=new Map();return {getItem:k=>map.get(k)??null,setItem:(k,v)=>map.set(k,v),removeItem:k=>map.delete(k)};};
function fixture(){
 let clock=Date.parse('2026-10-20T12:00:00Z'),fail=false,requests=0,response=feed;
 const store=storage();
 const fetcher=async url=>{requests++;assert.equal(url,INDIAN_BOX_OFFICE_RSS_URL);if(fail)throw new Error('HTTP 503');return response;};
 const instance=()=>new Collector(store,fetcher,()=>clock);
 const finish=async app=>{const result=await app.step();assert.equal(result.state,'complete');};
 return {instance,finish,store,advance:n=>clock+=n,fail:()=>fail=true,setResponse:value=>response=value,count:()=>requests};
}

test('first install has no sample figures and refreshes the fixed RSS feed every 20 minutes',async()=>{
 const f=fixture(),app=f.instance();
 assert.equal(app.getReport().movies.length,0);
 await f.finish(app);
 const report=app.getReport(),movie=report.movies[0];
 assert.equal(report.sourceStatus,'partial');
 assert.equal(movie.indiaNet,12);
 assert.equal(movie.indiaGross,null);
 assert.equal(movie.worldwide,17);
 assert.deepEqual(movie.languages,['Hindi']);
 assert.equal(movie.status,'estimate');
 const count=f.count();assert.equal((await app.step()).state,'current');assert.equal(f.count(),count);
 f.advance(REFRESH_MS);await f.finish(app);assert.equal(f.count(),count+1);
 const restored=f.instance();assert.equal(restored.getReport().movies[0].worldwide,17);
});

test('a source outage preserves the last successful timestamp and values',async()=>{
 const f=fixture(),app=f.instance();await f.finish(app);
 const previous=app.getReport();f.advance(REFRESH_MS);f.fail();await f.finish(app);
 assert.equal(app.getReport().sourceStatus,'error');
 assert.equal(app.getReport().checkedAt,previous.checkedAt);
 assert.equal(app.getReport().movies[0].indiaNet,previous.movies[0].indiaNet);
});

test('feed items from another origin are ignored',async()=>{
 const f=fixture(),app=f.instance();
 f.setResponse(feed.replaceAll('https://indian-boxoffice.com/movies/test-film-2026/','https://example.invalid/movies/test-film-2026/'));
 await f.finish(app);
 assert.equal(app.getReport().sourceStatus,'error');
 assert.deepEqual(app.getReport().movies,[]);
 assert.equal(app.getReport().checkedAt,null);
});

test('legacy Sacnilk snapshots are removed during migration',()=>{
 const f=fixture();
 f.store.setItem('cinetracker-native-collections-v1',JSON.stringify({version:1,report:{movies:[{sourceUrl:'https://www.sacnilk.com/live'}]}}));
 const app=f.instance();
 assert.equal(f.store.getItem('cinetracker-native-collections-v1'),null);
 assert.equal(app.getReport().movies.length,0);
});

test('offline first install does not manufacture a successful check',async()=>{
 const f=fixture();f.fail();const app=f.instance();await f.finish(app);
 assert.equal(app.getReport().checkedAt,null);
 assert.deepEqual(app.getReport().movies,[]);
});
