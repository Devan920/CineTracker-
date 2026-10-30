import test from 'node:test';
import assert from 'node:assert/strict';
import {approximateLocation,parseCinemaDirectory,nearbyCinemas,parseTowns,cinemaLinks,setArea,getArea} from '../../lib/theatres.ts';
import {requestApproximateLocation} from '../src/location.ts';
import {TownSearch} from '../src/towns.ts';

const area={id:'test',label:'Test town',kind:'town',latitude:8.7,longitude:76.8};
test('cinema map data cannot turn capacity or opening hours into showtimes or free seats',()=>{
 const data={osm3s:{timestamp_osm_base:'2026-10-30T08:00:00Z'},elements:[
  {type:'node',id:1,lat:8.701,lon:76.801,tags:{amenity:'cinema',name:'Near Cinema',capacity:'400',opening_hours:'24/7'}},
  {type:'way',id:2,center:{lat:8.75,lon:76.85},tags:{amenity:'cinema',name:'Far Cinema'}},
  {type:'node',id:3,lat:8.7,lon:76.8,tags:{amenity:'cinema',name:'Closed Cinema',disused:'yes'}},
  {type:'node',id:4,lat:8.7,lon:76.8,tags:{amenity:'theatre',name:'Not a cinema'}},
 ]};
 const directory=parseCinemaDirectory(data,'2026-10-30T08:30:00Z');assert.equal(directory.cinemas.length,2);
 assert.deepEqual(Object.keys(directory.cinemas[0]).sort(),['city','id','latitude','longitude','name']);
 const result=nearbyCinemas(directory,area,10);assert.equal(result[0].name,'Near Cinema');assert.equal(result[1].name,'Far Cinema');
 assert.deepEqual(nearbyCinemas(directory,{...area,latitude:NaN}),[]);assert.deepEqual(nearbyCinemas(directory,area,1000),[]);
 assert.throws(()=>parseCinemaDirectory({...data,remark:'runtime error: Query timed out'},'2026-10-30'));
});
test('location asks only for approximate permission; denial never reads a position',async()=>{
 const calls=[];const plugin={checkPermissions:async()=>({coarseLocation:'prompt'}),requestPermissions:async options=>{calls.push(options);return {coarseLocation:'denied'};},getCurrentPosition:async()=>{throw Error('must not read');}};
 await assert.rejects(requestApproximateLocation(plugin),/not granted/);assert.deepEqual(calls,[{permissions:['coarseLocation']}]);
});
test('granted location is a one-shot coarse position with rounded coordinates',async()=>{
 let options;const plugin={checkPermissions:async()=>({coarseLocation:'granted'}),requestPermissions:async()=>{throw Error('no extra prompt');},getCurrentPosition:async o=>{options=o;return {coords:{latitude:8.69678123,longitude:76.81451234,accuracy:1800}};}};
 const result=await requestApproximateLocation(plugin);assert.equal(result.latitude,8.7);assert.equal(result.longitude,76.81);assert.equal(result.accuracyKm,1.8);
 assert.equal(options.enableHighAccuracy,false);assert.equal(options.timeout,15000);
 setArea(result);assert.equal(getArea(),result);setArea(null);assert.equal(getArea(),null);
 assert.throws(()=>approximateLocation({latitude:100,longitude:0}));
});
test('town search filters to India, encodes text, and reuses completed requests',async()=>{
 const data={results:[{id:1,name:'Test',admin1:'Kerala',country_code:'IN',latitude:8.7,longitude:76.8},{id:2,name:'Foreign',country_code:'US',latitude:40,longitude:-80}]};
 assert.equal(parseTowns(data).length,1);let calls=0;
 const service=new TownSearch(async url=>{calls++;const params=new URL(url).searchParams;assert.equal(params.get('name'),'Test & place');assert.equal(params.get('countryCode'),'IN');assert.equal(params.has('latitude'),false);return data;});
 const [a,b]=await Promise.all([service.search('Test & place'),service.search('Test & place')]);assert.deepEqual(a,b);await service.search('Test & place');assert.equal(calls,1);
});
test('external links use fixed destinations and never include the user position',()=>{
 const cinema={id:'1',name:'Cinema & Co',city:'Attingal',latitude:8.69,longitude:76.81};
 const links=cinemaLinks('Film & One',cinema,{...area,latitude:9.12345,longitude:77.54321});
 assert.equal(new URL(links.search).hostname,'www.google.com');assert.ok(new URL(links.search).searchParams.get('q').includes('Film & One Cinema & Co'));
 assert.equal(new URL(links.directions).searchParams.get('destination'),'8.69,76.81');assert.ok(!JSON.stringify(links).includes('9.12345'));
});
