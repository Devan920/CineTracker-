'use client';
import {useEffect,useMemo,useState} from 'react';
import {ArrowUpRight,BookOpen,Film,History,RefreshCw,Search,Users} from 'lucide-react';
import {apiFetch} from '../lib/platform';
import type {Movie} from '../lib/boxoffice';
import type {ArchiveReport,FilmDetails,MovieMatch} from '../lib/movie-library';

const format=new Intl.NumberFormat('en-IN',{maximumFractionDigits:2});
const cash=(n:number|null)=>n===null?'Not reported':'₹'+format.format(n)+' Cr';
const yearOf=(m:Movie)=>m.year??(Number(m.releaseDate?.slice(0,4))||null);
function ResultCard({movie,onSelect}:{movie:Movie;onSelect:(m:Movie)=>void}){
 return <button className="library-film" onClick={()=>onSelect(movie)} aria-label={'Open '+movie.title}>
  <span className="library-poster">{movie.poster?<img src={movie.poster} alt="" loading="lazy" onError={e=>{e.currentTarget.style.display='none';}}/>:<Film size={25}/>}</span>
  <span className="library-film-copy"><small>{yearOf(movie)??'Movie'}{movie.languages.length?' · '+movie.languages.join(', '):''}</small><strong>{movie.title}</strong><span>{movie.archive?'Lifetime worldwide':movie.wikiPageId?'Cast & story':'Worldwide gross'}</span><b>{movie.wikiPageId?'Explore movie':cash(movie.worldwide)}</b></span>
  <ArrowUpRight size={18}/>
 </button>;
}
function fromMatch(m:MovieMatch):Movie{return {id:'wiki:'+m.pageId,title:m.title,year:m.year??undefined,wikiPageId:m.pageId,languages:[],poster:null,
 day:null,reportDate:null,releaseDate:null,indiaNet:null,indiaGross:null,worldwide:null,overseas:null,daily:[],sourceUrl:'https://en.wikipedia.org/?curid='+m.pageId,
 sourceUpdatedAt:null,checkedAt:new Date().toISOString(),lastSeenAt:new Date().toISOString(),status:'unavailable',coverage:'recent-release',warnings:[]};}

export function LibrarySection({view,query,movies,onSelect}:{view:'search'|'archive';query:string;movies:Movie[];onSelect:(m:Movie)=>void}){
 const [archive,setArchive]=useState<ArchiveReport|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState(''),[results,setResults]=useState<MovieMatch[]>([]),[searching,setSearching]=useState(false),[searchError,setSearchError]=useState(''),[year,setYear]=useState('all'),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;const abort=new AbortController();setLoading(true);setError('');
  apiFetch('/api/archive'+(retry?'?refresh=1':''),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('The archive could not load. Please retry.');return r.json();}).then((data:ArchiveReport)=>{if(active){setArchive(data);setError(data.error??'');}}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;abort.abort();};
 },[retry]);
 useEffect(()=>{let active=true;const abort=new AbortController();setResults([]);setSearchError('');
  if(view!=='search'||query.trim().length<2){setSearching(false);return;}
  setSearching(true);const timer=setTimeout(()=>{
   apiFetch('/api/movies/search?q='+encodeURIComponent(query.trim()),{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Online search is unavailable. Your collection matches are still shown.');return r.json();}).then((data:{movies:MovieMatch[]})=>{if(active)setResults(data.movies??[]);}).catch(e=>{if(active)setSearchError(e.message);}).finally(()=>{if(active)setSearching(false);});
  },400);return()=>{active=false;clearTimeout(timer);abort.abort();};
 },[query,view]);
 const older=useMemo(()=>{const activeIds=new Set(movies.map(m=>m.id));return (archive?.movies??[]).filter(m=>!activeIds.has(m.id));},[archive,movies]);
 const years=useMemo(()=>[...new Set(older.map(m=>yearOf(m)).filter(Boolean))].sort((a,b)=>Number(b)-Number(a)),[older]);
 const normalized=query.trim().toLocaleLowerCase();
 const local=(view==='archive'?older:[...movies,...older]).filter(m=>(!normalized||m.title.toLocaleLowerCase().includes(normalized))&&(view!=='archive'||year==='all'||String(yearOf(m))===year));
 const uniqueLocal=[...new Map(local.map(m=>[m.id,m])).values()];
 const online=results.filter(r=>!uniqueLocal.some(m=>m.title.toLocaleLowerCase()===r.title.toLocaleLowerCase()&&(!r.year||yearOf(m)===r.year)));
 return <section className="library-section" aria-label={view==='archive'?'Final collections':'Movie search results'}>
  <div className="library-section-top"><div><span className="eyebrow">{view==='archive'?'THE ARCHIVE':'FIND YOUR NEXT FILM'}</span><h2>{view==='archive'?'Final collections':'Explore movies'}</h2><p>{view==='archive'?'Reported lifetime totals for older releases. Re-releases may change these estimates.':'Search current reports and the movie catalogue. Tap a film for its cast and story.'}</p></div>{view==='archive'&&<History size={32}/>}</div>
  {view==='archive'&&<div className="archive-controls"><label>Release year<select value={year} onChange={e=>setYear(e.target.value)} aria-label="Archive release year"><option value="all">All years</option>{years.map(y=><option key={y}>{y}</option>)}</select></label><button className="button" disabled={loading} onClick={()=>setRetry(r=>r+1)}><RefreshCw size={15}/>Refresh archive</button></div>}
  {error&&<p className="library-error" role="status">{error} <button onClick={()=>setRetry(r=>r+1)}>Retry</button></p>}
  {view==='archive'&&archive?.checkedAt&&<p className="library-caption">{archive.stale?'Saved report':'Last checked'} · {new Date(archive.checkedAt).toLocaleDateString()} · INR crore</p>}
  {view==='search'&&!normalized?<div className="library-empty"><Search size={36}/><h3>Every film has a story.</h3><p>Type a movie title above. Add the release year to find a specific remake.</p></div>:<>
   {uniqueLocal.length>0&&<><div className="library-group-title"><h3>{view==='archive'?'Lifetime reports':'Collection matches'}</h3><span>{uniqueLocal.length} films</span></div><div className="library-grid">{uniqueLocal.map(m=><ResultCard key={m.id} movie={m} onSelect={onSelect}/>)}</div></>}
   {loading&&!archive&&<p className="library-loading" role="status">Loading historical collections…</p>}
   {view==='archive'&&!loading&&!uniqueLocal.length&&<div className="library-empty"><History size={34}/><h3>No matching lifetime reports</h3><p>Try another title or year. This archive covers the available published records.</p></div>}
  </>}
  {view==='search'&&normalized.length>=2&&<div className="online-results"><div className="library-group-title"><h3>Movie catalogue</h3><span>Cast & story</span></div>{searching&&<p role="status" className="library-loading">Searching movies…</p>}{searchError&&<p className="library-error" role="status">{searchError}</p>}<div className="library-grid">{online.map(r=><ResultCard key={r.pageId} movie={fromMatch(r)} onSelect={onSelect}/>)}</div>{!searching&&!searchError&&!online.length&&<p className="library-caption">{uniqueLocal.length?'No additional catalogue matches.':'No matching films found. Try the title in English or add its year.'}</p>}</div>}
  {view==='archive'&&<p className="archive-footnote">Current-year releases and films in the active feed are excluded. Missing totals stay blank; this is not a complete list of every theatrical release.</p>}
 </section>;
}

export function MovieStory({movie}:{movie:Movie}){
 const [data,setData]=useState<FilmDetails|null>(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[pageId,setPageId]=useState(movie.wikiPageId),[retry,setRetry]=useState(0);
 useEffect(()=>{let active=true;const abort=new AbortController();setLoading(true);setError('');setData(null);
  const params=new URLSearchParams({title:movie.title});const year=yearOf(movie);if(year)params.set('year',String(year));if(pageId)params.set('pageid',String(pageId));if(retry)params.set('refresh','1');
  apiFetch('/api/movies/details?'+params,{signal:abort.signal}).then(async r=>{if(!r.ok)throw Error('Cast and story could not load. Check your connection and retry.');return r.json();}).then(d=>{if(active)setData(d);}).catch(e=>{if(active)setError(e.message);}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;abort.abort();};
 },[movie.id,movie.title,pageId,retry]);
 return <section className="movie-story" aria-label="Cast and story">
  {loading?<p className="library-loading" role="status">Loading cast & story…</p>:error?<p className="library-error" role="status">{error} <button onClick={()=>setRetry(r=>r+1)}>Retry</button></p>:<>
   {data?.message&&<p className="library-caption">{data.message}</p>}
   {!!data?.choices?.length&&<div className="movie-matches">{data.choices.map(m=><button className="button" key={m.pageId} onClick={()=>setPageId(m.pageId)}>{m.title} {m.year?'('+m.year+')':''}<ArrowUpRight size={14}/></button>)}</div>}
   <div className="story-section"><div className="library-group-title"><h3><BookOpen size={18}/>Story</h3><span>May contain spoilers</span></div><p>{data?.story??'A story synopsis is not available for this film yet.'}</p></div>
   <div className="cast-section"><h3><Users size={18}/>Cast</h3>{data?.cast.length?<div className="cast-list">{data.cast.map((name,i)=><div className="cast-person" key={name}><span>{name.split(' ').filter(Boolean).slice(0,2).map(n=>n[0]).join('')}</span><strong>{name}</strong></div>)}</div>:<p className="library-caption">Cast information is not available yet.</p>}{data?.director&&<p className="director-line"><span>Directed by</span><strong>{data.director}</strong></p>}</div>
   {data?.sourceUrl&&<p className="metadata-credit">Text excerpt & cast: <a href={data.sourceUrl} target="_blank" rel="noopener noreferrer">Wikipedia contributors</a> · <a href="https://creativecommons.org/licenses/by-sa/4.0/" target="_blank" rel="noopener noreferrer">CC BY-SA 4.0</a></p>}
  </>}
 </section>;
}
