'use client';
import {useEffect,useMemo,useRef,useState,useSyncExternalStore} from 'react';
import {ArrowUpRight,LocateFixed,MapPin,Navigation,Search,Ticket,X} from 'lucide-react';
import {apiFetch,nativeBridge} from '../lib/platform';
import {approximateLocation,cinemaLinks,getArea,nearbyCinemas,setArea,subscribeArea,type AreaChoice} from '../lib/theatres';
import directory from '../lib/cinemas-india.json';
import type {Movie} from '../lib/boxoffice';
import {MovieStory} from './movie-library';
const serverArea=()=>null;
const useArea=()=>useSyncExternalStore(subscribeArea,getArea,serverArea);

export function MovieExplore({movie}:{movie:Movie}){
 const [view,setView]=useState<'story'|'cinemas'>('story');
 return <><div className="movie-detail-tabs" role="tablist" aria-label="Movie information"><button id="story-tab" role="tab" aria-selected={view==='story'} aria-controls="movie-information-panel" onClick={()=>setView('story')}>Cast & story</button><button id="cinemas-tab" role="tab" aria-selected={view==='cinemas'} aria-controls="movie-information-panel" onClick={()=>setView('cinemas')}>Nearby cinemas</button></div><div id="movie-information-panel" role="tabpanel" aria-labelledby={view==='story'?'story-tab':'cinemas-tab'}>{view==='story'?<MovieStory movie={movie}/>:<MovieTheatres movie={movie}/>}</div></>;
}

export function MovieTheatres({movie}:{movie:Movie}){
 const area=useArea(),[locating,setLocating]=useState(false),[error,setError]=useState(''),[townOpen,setTownOpen]=useState(false),[query,setQuery]=useState(''),[towns,setTowns]=useState<AreaChoice[]>([]),[searching,setSearching]=useState(false),[searched,setSearched]=useState(false),[radius,setRadius]=useState(25);
 const generation=useRef(0),controller=useRef<AbortController|null>(null),[expanded,setExpanded]=useState(false);
 useEffect(()=>()=>{generation.current++;controller.current?.abort();},[]);
 const cinemas=useMemo(()=>area?nearbyCinemas(directory,area,radius):[],[area,radius]);
 const selectArea=(value:AreaChoice|null)=>{generation.current++;controller.current?.abort();setLocating(false);setSearching(false);setArea(value);setExpanded(false);setError('');setTownOpen(false);setTowns([]);setSearched(false);};
 async function locate(){
  const token=++generation.current;controller.current?.abort();setSearching(false);setLocating(true);setError('');
  try{
   const bridge=nativeBridge();
   const choice=bridge?.location?await bridge.location.current():await new Promise<AreaChoice>((resolve,reject)=>{
    if(!navigator.geolocation){reject(Error('Location is unavailable. Choose a town instead.'));return;}
    navigator.geolocation.getCurrentPosition(p=>resolve(approximateLocation(p.coords)),()=>reject(Error('Location could not be accessed. Choose a town or allow location in device settings.')),{enableHighAccuracy:false,timeout:15000,maximumAge:60000});
   });
   if(generation.current===token){setArea(choice);setExpanded(false);setTownOpen(false);setTowns([]);}
  }catch(e){if(generation.current===token)setError(e instanceof Error?e.message:'Location is unavailable. Choose a town.');}
  finally{if(generation.current===token)setLocating(false);}
 }
 async function findTown(e:React.FormEvent){
  e.preventDefault();if(query.trim().length<2)return;
  const token=++generation.current;controller.current?.abort();const abort=new AbortController();controller.current=abort;setLocating(false);setSearching(true);setError('');setTowns([]);setSearched(false);
  try{const response=await apiFetch('/api/locations/search?q='+encodeURIComponent(query.trim()),{signal:abort.signal});if(!response.ok)throw Error('Town search is unavailable. Try again or use your location.');const data=await response.json();if(generation.current===token){setTowns(data.towns??[]);setSearched(true);}}
  catch(e){if(generation.current===token)setError(e instanceof Error?e.message:'Town search is unavailable.');}
  finally{if(generation.current===token)setSearching(false);}
 }
 return <section className="theatres-section" aria-label="Nearby cinemas">
  <div className="theatres-heading"><span className="theatres-icon"><MapPin size={22}/></span><div><h3>Find a cinema nearby</h3><p>Plan a visit for {movie.title}.</p></div></div>
  <div className="availability-note"><Ticket size={17}/><p><strong>Showtimes & free seats</strong><span>Live availability is not connected. Check the booking page for this film’s shows and available seats.</span></p></div>
  {area?<div className="chosen-area"><MapPin size={15}/><div><strong>{area.label}</strong><small>{area.kind==='device'?'Approximate location · on this device':'Distances from the town centre'}</small></div><button className="icon-button" aria-label="Forget selected area" onClick={()=>selectArea(null)}><X size={17}/></button></div>:<p className="location-explanation">Use your approximate location to find cinemas. Your coordinates stay on this device.</p>}
  <div className="location-actions"><button className="button primary" onClick={locate} disabled={locating}><LocateFixed size={17}/>{locating?'Finding location…':area?'Update my location':'Use my location'}</button><button className="button" onClick={()=>{setTownOpen(v=>!v);setError('');}} aria-expanded={townOpen}><Search size={16}/>Choose a town</button></div>
  {townOpen&&<form className="town-form" onSubmit={findTown}><label htmlFor="cinema-town">Town or city in India</label><div><input id="cinema-town" value={query} onChange={e=>{generation.current++;controller.current?.abort();setSearching(false);setQuery(e.target.value);setTowns([]);setSearched(false);}} placeholder="e.g. Attingal, Kochi…" minLength={2} maxLength={80} autoComplete="off"/><button className="button" disabled={searching||query.trim().length<2}>{searching?'Searching…':'Find town'}</button></div><small>The town name is sent to Open-Meteo to find its location.</small>{towns.length>0&&<div className="town-options">{towns.map(t=><button key={t.id} type="button" onClick={()=>selectArea(t)}>{t.label}<ArrowUpRight size={15}/></button>)}</div>}{searched&&!towns.length&&<p role="status">No town found. Try a nearby city or its English spelling.</p>}</form>}
  {error&&<p className="library-error" role="status">{error}</p>}
  {area&&<><div className="nearby-controls"><span>{cinemas.length} nearby cinemas</span><label>Within <select aria-label="Cinema search radius" value={radius} onChange={e=>{setRadius(Number(e.target.value));setExpanded(false);}}><option value={10}>10 km</option><option value={25}>25 km</option><option value={50}>50 km</option></select></label></div><p className="cinema-caption">These are mapped cinema locations. Screenings of {movie.title} are not confirmed.</p>
   {cinemas.length?<div className="cinema-list">{(expanded?cinemas:cinemas.slice(0,4)).map(c=>{const links=cinemaLinks(movie.title,c,area);return <article className="cinema-card" key={c.id}><div className="cinema-card-title"><div><h4>{c.name}</h4>{c.city&&<p>{c.city}</p>}</div><span>~{c.distanceKm.toFixed(1)} km</span></div><div className="cinema-card-actions"><a href={links.search} target="_blank" rel="noopener noreferrer">Search shows on Google<ArrowUpRight size={15}/></a><a href={links.directions} target="_blank" rel="noopener noreferrer" aria-label={'Directions to '+c.name}><Navigation size={14}/>Directions</a></div></article>;})}</div>:<p className="cinema-empty" role="status">No mapped cinemas found within {radius} km. Try a wider radius or another town.</p>}
   <p className="cinema-caption">{cinemas.length>4&&<button className="text-button" onClick={()=>setExpanded(v=>!v)}>{expanded?'Show fewer cinemas':'Show '+(cinemas.length-4)+' more cinemas'}</button>}<br/>Approximate straight-line distances. Venue details may have changed.</p></>}
  <div className="booking-apps"><a className="button" href="https://in.bookmyshow.com/" target="_blank" rel="noopener noreferrer">Open BookMyShow<ArrowUpRight size={15}/></a><a className="button" href="https://www.district.in/" target="_blank" rel="noopener noreferrer">Open District<ArrowUpRight size={15}/></a></div>
  <p className="metadata-credit">India cinema directory · {new Date(directory.updatedAt).toLocaleDateString()} · <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors · ODbL</a>. Town lookup: <a href="https://open-meteo.com/en/docs/geocoding-api" target="_blank" rel="noopener noreferrer">Open-Meteo / GeoNames</a>.</p>
 </section>;
}

export function LocationSettings(){
 const area=useArea();
 return <section className="location-settings"><h3><MapPin size={18}/>Location</h3><p>Used only when you tap “Use my location” in a movie. Your approximate position is processed on this device to find nearby cinemas.</p><p>{area?'Selected area: '+area.label:'No area selected. You can also choose a town without location permission.'}</p>{area&&<button className="button" onClick={()=>setArea(null)}>Forget selected area</button>}<small>Change the Android permission in your phone’s Settings → Apps → CineTracker → Permissions. Town searches use Open-Meteo.</small></section>;
}
