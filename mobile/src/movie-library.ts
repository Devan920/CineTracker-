import {SOURCE, amount, textOf, safeSource, movieId, validate, robotsRules, type Movie} from '../../lib/boxoffice.ts';
import type {ArchiveReport, FilmDetails, MovieMatch} from '../../lib/movie-library.ts';

export const WIKI_API='https://en.wikipedia.org/w/api.php';
export const ARCHIVE_URL=SOURCE+'/box-office-records';
export const ARCHIVE_PAGES=[ARCHIVE_URL,...['mollywood','kollywood','tollywood','sandalwood','bollywood'].map(region=>ARCHIVE_URL+'/'+region)];
type Reader=(url:string)=>Promise<string>;
type StorageLike=Pick<Storage,'getItem'|'setItem'>;
const DAY=86400000, ARCHIVE_KEY='cinetracker-archive-v1', DETAILS_KEY='cinetracker-details-v1';
const langs:Record<string,string>={Bollywood:'Hindi',Tollywood:'Telugu',Kollywood:'Tamil',Mollywood:'Malayalam',Sandalwood:'Kannada',Hollywood:'English',Pollywood:'Punjabi'};
export const normalizeTitle=(s:string)=>s.normalize('NFKD').replace(/\([^)]*film[^)]*\)/gi,'').toLowerCase().replace(/[^\p{L}\p{N}]/gu,'');
const plain=(html:string)=>textOf(html.replace(/<sup\b[^>]*>[\s\S]*?<\/sup>/gi,'').replace(/<span[^>]*class="[^"]*mw-editsection[^"]*"[^>]*>[\s\S]*?<\/span>/gi,''));
const safePoster=(s:string|undefined)=>{try{const u=new URL(s??'');return u.origin==='https://cdn.sacnilk.com'?u.href:null;}catch{return null;}};

/** Exact mobile-card values only: rounded desktop totals are never substituted. */
export function parseArchive(html:string,checkedAt:string):Movie[]{
 const result=new Map<string,Movie>(), currentYear=new Date(checkedAt).getUTCFullYear();
 for(const card of html.split(/<div class="movie-card\b/).slice(1)){
  const title=card.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i)?.[1],path=card.match(/href="(\/movie\/[^"?]+)"/i)?.[1];
  if(!title||!path)continue;const url=safeSource(path);if(!url)continue;
  // URL slugs can retain a postponed release year (for example RRR_2020).
  // Only the explicit release year displayed beside the film is authoritative.
  const year=Number(card.match(/<div class="text-sm text-gray-600">\s*((?:19|20)\d{2})\s*<\/div>/i)?.[1]);
  if(!Number.isInteger(year)||year<1900||year>=currentYear)continue;
  const name=plain(title),industry=name.match(/\(([^)]+)\)\s*$/)?.[1]??null;
  const mobile=plain(card.split('<!-- Desktop')[0]);
  const read=(label:string)=>amount(mobile.match(new RegExp(label+':\\s*([₹\\d,.\\s]+(?:Cr(?:ore)?s?|Lakh))','i'))?.[1]);
  const m:Movie={id:movieId(url),title:name.replace(/\s*\([^)]+\)\s*$/,''),languages:industry&&langs[industry]?[langs[industry]]:[],industry,
   poster:safePoster(card.match(/<img[^>]*src="([^"]+)"/i)?.[1]),year,archive:true,
   day:null,reportDate:null,releaseDate:null,indiaNet:read('Net'),indiaGross:read('Gross'),worldwide:read('WW'),overseas:read('Overseas'),
   daily:[],sourceUrl:url,sourceUpdatedAt:null,checkedAt,lastSeenAt:checkedAt,status:'reported',coverage:'recent-release',
   warnings:['Reported lifetime total for an older release. Re-releases and corrections can change it.']};
  validate(m);if(m.worldwide===null&&m.indiaNet===null)continue;
  result.set(m.id,m);
 }
 return [...result.values()].sort((a,b)=>(b.worldwide??-1)-(a.worldwide??-1));
}
export function parseSearch(payload:any):MovieMatch[]{
 if(payload?.error)throw new Error('Movie search is temporarily unavailable.');
 if(!payload?.query?.pages)return [];
 return payload.query.pages.filter((p:any)=>Number.isInteger(p.pageid)&&typeof p.title==='string'&&
  !Object.hasOwn(p.pageprops??{},'disambiguation')&&!/\b(actor|actress|director|producer|soundtrack|album|list of|franchise|film series)\b/i.test(p.description??'')&&
  (/\b(?:19|20)\d{2}\b.*\bfilm\b/i.test(p.description??'')||/\((?:(?:19|20)\d{2} )?film\)/i.test(p.title)))
  .sort((a:any,b:any)=>(a.index??99)-(b.index??99)).map((p:any)=>({pageId:p.pageid,
   title:p.title.replace(/\s*\([^)]*film[^)]*\)\s*$/i,''),year:Number(p.title.match(/\((\d{4})[^)]*film/i)?.[1]??p.description?.match(/\b((?:19|20)\d{2})\b/)?.[1])||null,
   description:String(p.description??'').slice(0,200)}));
}
export function chooseMatch(matches:MovieMatch[],title:string,year:number|null):MovieMatch|null{
 const exact=matches.filter(m=>normalizeTitle(m.title)===normalizeTitle(title)&&(!year||m.year===year));
 return exact.length===1?exact[0]:null;
}
export function parseFilm(payload:any,checkedAt:string):FilmDetails{
 const p=payload?.parse;if(!p||typeof p.text!=='string'||typeof p.title!=='string')throw new Error('Movie details could not be read.');
 const html=p.text;
 const row=(label:string)=>html.match(new RegExp('<th\\b[^>]*>\\s*'+label+'\\s*</th>\\s*<td\\b[^>]*>([\\s\\S]*?)</td>','i'))?.[1]??'';
 const names=(value:string)=>[...new Set(value.replace(/<br\s*\/?\s*>|<\/li>/gi,'\n').split('\n').map(plain).map(x=>x.trim()).filter(Boolean))].slice(0,16);
 const cast=names(row('Starring')),director=plain(row('Directed by'))||null;
 if(!director&&!cast.length)throw new Error('This result does not contain identifiable film details.');
 const section=html.match(/<h2\b[^>]*id="(?:Plot|Synopsis|Premise)"[^>]*>[\s\S]*?<\/h2>([\s\S]*?)(?=<h2\b|$)/i)?.[1]??'';
 const paragraphs=[...section.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>plain(m[1])).filter(t=>t.length>30);
 const words=paragraphs.slice(0,2).join(' ').split(/\s+/).filter(Boolean);
 const story=words.length?words.slice(0,140).join(' ')+(words.length>140?'…':''):null;
 return {title:p.title.replace(/\s*\([^)]*film[^)]*\)\s*$/i,''),year:Number(p.title.match(/\((\d{4})[^)]*film/i)?.[1])||null,cast,director,story,
  sourceUrl:'https://en.wikipedia.org/wiki/'+encodeURIComponent(p.title.replaceAll(' ','_')),checkedAt};
}
export class MovieLibrary{
 private read:Reader;private storage:StorageLike;private now:()=>number;
 private archive:ArchiveReport={movies:[],checkedAt:null,stale:false};private details:Record<string,FilmDetails>={};
 private pending=new Map<string,Promise<any>>();private robots:string|null=null;private lastSource=0;
 constructor(read:Reader,storage:StorageLike,now=Date.now){
  this.read=read;this.storage=storage;this.now=now;
  try{const a=JSON.parse(storage.getItem(ARCHIVE_KEY)??'null');if(a&&Array.isArray(a.movies)&&typeof a.checkedAt==='string')this.archive=a;}catch{}
  try{const d=JSON.parse(storage.getItem(DETAILS_KEY)??'{}');if(d&&typeof d==='object'&&!Array.isArray(d))this.details=d;}catch{}
 }
 private save(key:string,value:unknown){try{this.storage.setItem(key,JSON.stringify(value));}catch{}}
 private once<T>(key:string,fn:()=>Promise<T>):Promise<T>{
  if(this.pending.has(key))return this.pending.get(key)!;
  const p=fn().finally(()=>this.pending.delete(key));this.pending.set(key,p);return p;
 }
 private async source(url:string){
  const u=new URL(url);if(u.origin!==SOURCE)throw new Error('Unsupported archive address.');
  if(this.robots===null){const raw=await this.read(SOURCE+'/robots.txt');if(!/^User-agent:/im.test(raw))throw new Error('Archive access rules are unavailable.');this.robots=raw;this.lastSource=Date.now();}
  const rule=robotsRules(this.robots,u.pathname+u.search);if(!rule.allowed)throw new Error('Archive access is unavailable.');
  const wait=rule.delay*1000-(Date.now()-this.lastSource);if(wait>0)await new Promise(r=>setTimeout(r,wait));
  this.lastSource=Date.now();return this.read(url);
 }
 async getArchive(force=false):Promise<ArchiveReport>{return this.once('archive',async()=>{
  if(!force&&this.archive.checkedAt&&this.now()-Date.parse(this.archive.checkedAt)<DAY)return {...this.archive,stale:false};
  try{
   const checkedAt=new Date(this.now()).toISOString(),records=new Map<string,Movie>();let failed=0;
   for(const url of ARCHIVE_PAGES){
    try{
     const parsed=parseArchive(await this.source(url),checkedAt);if(!parsed.length){failed++;continue;}
     const industry=Object.keys(langs).find(name=>url.endsWith('/'+name.toLowerCase()));
     for(const movie of parsed){
      const previous=records.get(movie.id);
      records.set(movie.id,{...movie,industry:industry??previous?.industry??movie.industry,languages:industry?[langs[industry]]:previous?.languages??movie.languages});
     }
    }catch{failed++;}
   }
   if(!records.size)throw new Error('Historical collections are temporarily unavailable. Please try again.');
   this.archive={movies:[...records.values()].sort((a,b)=>(b.worldwide??-1)-(a.worldwide??-1)),checkedAt,stale:false,...(failed?{error:'Some regional records could not load. Available lifetime reports are shown.'}:{})};this.save(ARCHIVE_KEY,this.archive);return this.archive;
  }catch(e){return {...this.archive,stale:true,error:e instanceof Error?e.message:'Archive could not load.'};}
 });}
 async search(query:string):Promise<MovieMatch[]>{
  const q=query.trim().slice(0,80);if(q.length<2)return [];
  return this.once('search:'+q,async()=>{
   const params=new URLSearchParams({action:'query',generator:'search',gsrsearch:q+' film',gsrlimit:'12',prop:'description|pageprops',format:'json',formatversion:'2',origin:'*'});
   return parseSearch(JSON.parse(await this.read(WIKI_API+'?'+params)));
  });
 }
 async getDetails(title:string,year:number|null,pageId?:number,force=false):Promise<FilmDetails>{
  const key=pageId?'page:'+pageId:normalizeTitle(title)+':'+(year??'');
  return this.once(key,async()=>{
   const cached=this.details[key];if(!force&&cached&&Array.isArray(cached.cast)&&this.now()-Date.parse(cached.checkedAt)<7*DAY)return cached;
   try{
    let match:MovieMatch|null=null;
    if(!pageId){const results=await this.search(title+(year?' '+year:''));match=chooseMatch(results,title,year);if(!match)return {title,year,cast:[],director:null,story:null,sourceUrl:null,checkedAt:new Date(this.now()).toISOString(),choices:results,message:results.length?'Choose the matching film below.':'Cast and story are not available for this film yet.'};}
    const params=new URLSearchParams({action:'parse',pageid:String(pageId??match!.pageId),prop:'text',format:'json',formatversion:'2',origin:'*',disableeditsection:'1'});
    const detail={...parseFilm(JSON.parse(await this.read(WIKI_API+'?'+params)),new Date(this.now()).toISOString()),year:year??match?.year??null};
    this.details[key]=detail;const entries=Object.entries(this.details).sort((a,b)=>Date.parse(b[1].checkedAt)-Date.parse(a[1].checkedAt)).slice(0,40);this.details=Object.fromEntries(entries);this.save(DETAILS_KEY,this.details);return detail;
   }catch(e){if(cached&&Array.isArray(cached.cast))return {...cached,stale:true,message:'Offline copy of movie details.'};throw e;}
  });
 }
}
