import test from 'node:test';
import assert from 'node:assert/strict';
import { filmLeaders } from '../lib/leaders.ts';
import { parseCatalog,parseDetail,parseIndustry } from '../lib/boxoffice.ts';

const film=(title,industry,worldwide,extra={})=>({id:title,title,industry,worldwide,status:'reported',languages:[],indiaNet:worldwide,...extra});
test('film groups use explicit industry metadata and never dubbed-language order',()=>{
 const groups=filmLeaders([
  film('Tamil film','Kollywood',100,{languages:['Hindi','Tamil']}),
  film('Hindi film','Bollywood',120,{languages:['Telugu','Hindi']}),
  film('Hollywood film','Hollywood',1000,{languages:['Tamil','Hindi']}),
  film('Unknown origin',null,2000,{languages:['Hindi']}),
  film('Bengali film','Bengali Tollywood',500),
 ]);
 assert.equal(groups[0].movies[0].title,'Tamil film');
 assert.equal(groups[1].movies[0].title,'Hindi film');
 assert.equal(groups[0].compared,1);assert.equal(groups[1].compared,1);
});
test('both leader groups rank worldwide gross and preserve exact ties',()=>{
 const groups=filmLeaders([film('Second','Tollywood',100,{indiaNet:999}),film('Leader A','Mollywood',200),film('Leader B','Sandalwood',200),film('Punjabi film','Pollywood',10)]);
 assert.deepEqual(groups[0].movies.map(m=>m.title),['Leader A','Leader B']);
 assert.equal(groups[0].gross,200);assert.equal(groups[1].gross,10);
});
test('unknown, invalid, failed and conflicting gross figures cannot become a leader',()=>{
 const groups=filmLeaders([film('Missing','Kollywood',null,{indiaNet:200}),film('Under review','Kollywood',400,{status:'review'}),film('Failed','Bollywood',500,{fetchError:'Network unavailable'}),film('Unavailable','Pollywood',900,{status:'unavailable'}),film('NaN','Bollywood',NaN),film('Zero','Kollywood',0),film('Negative','Kollywood',-1)]);
 assert.equal(groups[0].gross,null);assert.equal(groups[1].gross,null);
 assert.equal(groups[0].movies.length,0);assert.equal(groups[1].movies.length,0);
});
test('leader values change with newly received collection reports',()=>{
 const before=[film('One','Kollywood',100),film('Two','Mollywood',90)];
 assert.equal(filmLeaders(before)[0].movies[0].title,'One');
 const after=before.map(m=>m.title==='Two'?{...m,worldwide:110}:m);
 assert.equal(filmLeaders(after)[0].movies[0].title,'Two');
 assert.equal(before[1].worldwide,90);
});
test('classification uses exact metadata tokens, ignores generic industry keywords and rejects conflicts',()=>{
 assert.equal(parseIndustry('<head><meta content="Tamil movies, Hindi movies, Kollywood movies, bollywood, tollywood" name="keywords"></head>'),'Kollywood');
 assert.equal(parseIndustry('<meta name="keywords" content="Bengali Tollywood movies, Hindi movies">'),'Bengali Tollywood');
 assert.equal(parseIndustry('<meta name="keywords" content="Hollywood movies, Kollywood movies">'),null);
 assert.equal(parseIndustry('<head></head><a>Kollywood movies</a>'),null);
 assert.equal(parseIndustry('<meta name="keywords" content="Hindi movies, Telugu movies">'),null);
});
test('catalog industry survives a daily refresh without metadata and explicit metadata can correct it',()=>{
 const catalog=parseCatalog('<div class="movie-card bg-white"><a href="/movie/Example_2026"><h3>Example (Hollywood)</h3></a>Net:₹10Cr Gross:₹12Cr WW:₹14Cr Days:1</div>','2026-10-19T10:00:00Z');
 assert.equal(catalog[0].industry,'Hollywood');
 const url='https://www.sacnilk.com/quicknews/Example_2026_Box_Office_Collection_Day_1';
 const html='<h1>Example Box Office Collection Day 1</h1><p class="article-summary">total India net to ₹10 Cr</p>';
 assert.equal(parseDetail(html,url,catalog[0],'2026-10-19T10:00:00Z').industry,'Hollywood');
 const corrected=parseDetail('<meta name="keywords" content="Kollywood movies">'+html,url,catalog[0],'2026-10-19T10:00:00Z');
 assert.equal(corrected.industry,'Kollywood');
});
