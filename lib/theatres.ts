export type AreaChoice={id:string;label:string;latitude:number;longitude:number;kind:'device'|'town';accuracyKm?:number};
export type Cinema={id:string;name:string;latitude:number;longitude:number;city:string};
export type NearbyCinema=Cinema&{distanceKm:number};
export type CinemaDirectory={updatedAt:string;sourceTimestamp:string;cinemas:Cinema[]};
export function parseCinemaDirectory(data:any,updatedAt:string):CinemaDirectory{
 if(!Array.isArray(data?.elements)||data.remark||!Number.isFinite(Date.parse(data?.osm3s?.timestamp_osm_base)))throw Error('Cinema directory response is incomplete.');
 const cinemas:Cinema[]=[];
 for(const row of data.elements){
  const tags=row?.tags??{},point=row?.center??row,name=tags['name:en']??tags.name;
  if(tags.amenity!=='cinema'||typeof name!=='string'||!name.trim()||!validPoint(point?.lat,point?.lon)||!Number.isSafeInteger(row.id)||!['node','way','relation'].includes(row.type))continue;
  if(['disused','abandoned','demolished','closed'].some(key=>tags[key]==='yes')||tags['disused:amenity']==='cinema'||tags['abandoned:amenity']==='cinema')continue;
  cinemas.push({id:row.type+':'+row.id,name:name.trim().slice(0,180),latitude:point.lat,longitude:point.lon,city:typeof tags['addr:city']==='string'?tags['addr:city'].slice(0,120):''});
 }
 return {updatedAt,sourceTimestamp:data.osm3s.timestamp_osm_base,cinemas};
}
export function validPoint(lat:unknown,lon:unknown):boolean{return typeof lat==='number'&&Number.isFinite(lat)&&lat>=-90&&lat<=90&&typeof lon==='number'&&Number.isFinite(lon)&&lon>=-180&&lon<=180;}
export function approximateLocation(coords:{latitude:number;longitude:number;accuracy?:number}):AreaChoice{
 if(!validPoint(coords.latitude,coords.longitude))throw Error('Your location could not be read. Choose a town instead.');
 return {id:'device',label:'Your approximate location',kind:'device',latitude:Math.round(coords.latitude*100)/100,longitude:Math.round(coords.longitude*100)/100,accuracyKm:Math.max(1,Number.isFinite(coords.accuracy)?coords.accuracy!/1000:1)};
}
export function distanceKm(a:{latitude:number;longitude:number},b:{latitude:number;longitude:number}){
 const rad=Math.PI/180,dlat=(b.latitude-a.latitude)*rad,dlon=(b.longitude-a.longitude)*rad;
 const h=Math.sin(dlat/2)**2+Math.cos(a.latitude*rad)*Math.cos(b.latitude*rad)*Math.sin(dlon/2)**2;
 return 6371*2*Math.asin(Math.sqrt(Math.min(1,Math.max(0,h))));
}
export function nearbyCinemas(directory:CinemaDirectory,area:AreaChoice,radius=25):NearbyCinema[]{
 if(!validPoint(area.latitude,area.longitude)||![10,25,50].includes(radius))return [];
 const found=directory.cinemas.filter(c=>validPoint(c.latitude,c.longitude)&&c.name).map(c=>({...c,distanceKm:distanceKm(area,c)})).filter(c=>c.distanceKm<=radius).sort((a,b)=>a.distanceKm-b.distanceKm);
 const unique:NearbyCinema[]=[];
 for(const c of found){if(!unique.some(x=>x.id===c.id||(x.name.toLowerCase()===c.name.toLowerCase()&&distanceKm(x,c)<.15)))unique.push(c);}
 return unique.slice(0,30);
}
export function parseTowns(data:any):AreaChoice[]{
 if(data?.error)throw Error('Town search is unavailable. Please try again.');
 return (Array.isArray(data?.results)?data.results:[]).filter((r:any)=>r.country_code==='IN'&&typeof r.name==='string'&&Number.isInteger(r.id)&&validPoint(r.latitude,r.longitude)).slice(0,6).map((r:any)=>({id:'town:'+r.id,label:[r.name,r.admin1].filter(Boolean).join(', '),latitude:r.latitude,longitude:r.longitude,kind:'town'}));
}
export function cinemaLinks(movieTitle:string,cinema:Cinema,area:AreaChoice){
 const place=cinema.city||(area.kind==='town'?area.label:'');
 return {directions:'https://www.google.com/maps/dir/?api=1&destination='+encodeURIComponent(cinema.latitude+','+cinema.longitude),
  search:'https://www.google.com/search?'+new URLSearchParams({q:[movieTitle,cinema.name,place,'movie tickets showtimes'].filter(Boolean).join(' ')})};
}

// Session memory only. Coordinates never go into localStorage or a report API.
let selectedArea:AreaChoice|null=null;const listeners=new Set<()=>void>();
export const getArea=()=>selectedArea;
export const subscribeArea=(fn:()=>void)=>{listeners.add(fn);return()=>{listeners.delete(fn);};};
export function setArea(area:AreaChoice|null){selectedArea=area;for(const fn of listeners)fn();}
