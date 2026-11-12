import {readFileSync,writeFileSync} from 'node:fs';
import {parseCinemaDirectory} from '../../lib/theatres.ts';
// Run manually for a release. This is not an app runtime endpoint or a poller.
const input=process.argv.indexOf('--input');let data;
if(input>=0)data=JSON.parse(readFileSync(process.argv[input+1],'utf8'));
else{
 const query='[out:json][timeout:45][maxsize:67108864];area["ISO3166-1"="IN"]["admin_level"="2"]->.india;nwr["amenity"="cinema"](area.india);out center tags;';
 const response=await fetch('https://overpass-api.de/api/interpreter?'+new URLSearchParams({data:query}),{headers:{'User-Agent':'CineTracker/1.3 (https://github.com/Devan920/CineTracker-)'},redirect:'error',signal:AbortSignal.timeout(60000)});
 if(!response.ok)throw Error('Cinema directory returned HTTP '+response.status);data=await response.json();
}
const directory=parseCinemaDirectory(data,new Date().toISOString());
if(directory.cinemas.length<100)throw Error('Unexpectedly small directory; keep the previous version and investigate.');
writeFileSync(new URL('../../lib/cinemas-india.json',import.meta.url),JSON.stringify(directory)+'\n');
console.log('Updated India directory: '+directory.cinemas.length+' mapped cinemas. No showtimes or vacant-seat data.');
