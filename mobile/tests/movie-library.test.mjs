import test from 'node:test';
import assert from 'node:assert/strict';
import {MovieLibrary,parseArchive,parseSearch,chooseMatch,parseFilm,ARCHIVE_URL} from '../src/movie-library.ts';
import {responseText} from '../src/http-text.ts';
const stamp='2026-10-28T12:00:00Z';
const store=()=>{const data=new Map();return {getItem:k=>data.get(k)??null,setItem:(k,v)=>data.set(k,v)};};
test('Android JSON responses work even when the plugin parses them before returning',()=>{
 const origin='https://en.wikipedia.org',data={query:{pages:[]}};
 assert.deepEqual(JSON.parse(responseText({status:200,data},origin)),data);
 assert.equal(responseText({status:200,data:'<html>report</html>'},'https://www.sacnilk.com'),'<html>report</html>');
 assert.throws(()=>responseText({status:200,data,url:'https://example.org/'},origin));
 assert.throws(()=>responseText({status:200,data:'a'.repeat(3000001)},origin));
});
const card=({title='Old Film',slug='Old_Film_2020',year=2022,ww='123.45',gross='100.25',overseas='23.20'}={})=>`<div class="movie-card bg-white"><a href="/movie/${slug}"><h3>${title}</h3></a><div>Gross:₹${gross}Cr Overseas:₹${overseas}Cr WW:₹${ww}Cr</div><!-- Desktop Table Layout --><div class="text-sm text-gray-600">${year}</div><div>Gross:₹100Cr WW:₹123Cr</div></div>`;
test('archive uses displayed release years, exact totals and safe movie paths; excludes current and undated releases',()=>{
 const movies=parseArchive(card()+card({title:'Current',year:2026})+card({title:'Unknown year',year:''})+card({title:'Bad path',slug:'https://evil.test'})+card({title:'Bad figures',slug:'Bad_2024',ww:'50'}),stamp);
 assert.equal(movies.length,1);assert.equal(movies[0].year,2022);assert.equal(movies[0].worldwide,123.45);
 assert.equal(movies[0].indiaNet,null);assert.equal(movies[0].releaseDate,null);assert.equal(movies[0].archive,true);
});
test('movie search excludes people and disambiguation; remakes require the right year or explicit choice',()=>{
 const movies=parseSearch({query:{pages:[
  {pageid:1,title:'Drishyam (2013 film)',description:'2013 Indian Malayalam film',index:1},
  {pageid:2,title:'Drishyam (2015 film)',description:'2015 Indian Hindi film',index:2},
  {pageid:3,title:'Test',description:'1990 Indian actor',index:3},
  {pageid:4,title:'Drishyam (film)',description:'2013 film',pageprops:{disambiguation:''}},
 ]}});
 assert.equal(movies.length,2);assert.equal(chooseMatch(movies,'Drishyam',2013)?.pageId,1);
 assert.equal(chooseMatch(movies,'Drishyam',null),null);assert.equal(chooseMatch(movies,'Different title',2013),null);
});
const film={parse:{title:'Example (2022 film)',text:'<table><tr><th>Directed by</th><td>Director Name</td></tr><tr><th>Starring</th><td><ul><li>Actor One<sup>[1]</sup></li><li>Actor Two</li></ul></td></tr></table><div><h2 id="Plot">Plot</h2></div><p>A group of friends go on a journey and discover a mystery. <script>steal()</script></p><h2 id="Cast">Cast</h2><p>This is not part of the story and must not appear.</p>'}};
test('cast and story are plain text, confined to the plot section, and unavailable fields remain empty',()=>{
 const d=parseFilm(film,stamp);assert.deepEqual(d.cast,['Actor One','Actor Two']);assert.equal(d.director,'Director Name');
 assert.equal(d.story,'A group of friends go on a journey and discover a mystery.');assert.ok(d.sourceUrl.startsWith('https://en.wikipedia.org/wiki/'));
 assert.equal(parseFilm({parse:{...film.parse,text:film.parse.text.replace('id="Plot"','id="Other"')}},stamp).story,null);
 assert.throws(()=>parseFilm({parse:{title:'Not a film',text:'No film infobox'}},stamp));
});
test('details reuse a saved copy offline without inventing a new successful timestamp',async()=>{
 let fail=false,clock=Date.parse(stamp),requests=0;const storage=store();
 const reader=async()=>{requests++;if(fail)throw Error('offline');return JSON.stringify(film);};
 let app=new MovieLibrary(reader,storage,()=>clock);
 const first=await app.getDetails('Example',2022,1);await app.getDetails('Example',2022,1);assert.equal(requests,1);
 clock+=8*86400000;fail=true;app=new MovieLibrary(reader,storage,()=>clock);const cached=await app.getDetails('Example',2022,1);
 assert.equal(cached.stale,true);assert.equal(cached.checkedAt,first.checkedAt);assert.deepEqual(cached.cast,first.cast);
});
test('blocked archive pages are never fetched and first launch does not fabricate totals',async()=>{
 const urls=[];const app=new MovieLibrary(async url=>{urls.push(url);return 'User-agent: *\nDisallow: /';},store());
 const result=await app.getArchive();assert.deepEqual(result.movies,[]);assert.equal(result.checkedAt,null);assert.equal(result.stale,true);
 assert.equal(urls.length,1);assert.ok(urls[0].endsWith('/robots.txt'));assert.ok(!urls.includes(ARCHIVE_URL));
});
