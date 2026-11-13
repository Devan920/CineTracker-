import {normalizeTitle} from './movie-library';
import {YOUTUBE_CONSENT_KEY} from '../../lib/youtube-policy';

const CACHE_KEY='cinetracker-youtube-trailers-v1';
const POSITIVE_TTL=24*60*60*1000;
const NEGATIVE_TTL=8*60*60*1000;
const MAX_STORAGE_AGE=30*24*60*60*1000;
const MAX_CACHE=120;

type TrailerMatch={trailerUrl:string|null;sourceUrl:string|null;videoId?:string;title?:string;channelTitle?:string};
type CachedMatch={checkedAt:number;result:TrailerMatch};
type SearchItem={id?:{kind?:string;videoId?:string};snippet?:{title?:string;channelTitle?:string}};
type SearchResponse={items?:SearchItem[]};
type Store=Pick<Storage,'getItem'|'setItem'>;
type FetchSearch=(url:string,key:string)=>Promise<unknown>;

function videoTitleMatches(videoTitle:string,movieTitle:string):boolean{
 const target=normalizeTitle(movieTitle),candidate=normalizeTitle(videoTitle);
 if(!target||!candidate)return false;
 if(target.length>=5)return candidate.includes(target);
 const escaped=movieTitle.trim().replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}([^\\p{L}\\p{N}]|$)`,'iu').test(videoTitle);
}

function bestMatch(items:SearchItem[],title:string,year:number|null):TrailerMatch{
 const excluded=/\b(reaction|review|explained|analysis|breakdown|fan[ -]?made|full movie|songs?|shorts?)\b/i;
 const ranked=items.flatMap((item,index)=>{
  const videoId=item.id?.videoId??'',videoTitle=item.snippet?.title?.trim()??'',channelTitle=item.snippet?.channelTitle?.trim()??'';
  if(item.id?.kind!=='youtube#video'||!/^[\w-]{11}$/.test(videoId)||!videoTitleMatches(videoTitle,title)||excluded.test(videoTitle))return [];
  const isTrailer=/\btrailer\b/i.test(videoTitle),isTeaser=/\bteaser\b/i.test(videoTitle);
  if(!isTrailer&&!isTeaser)return [];
  const official=/\bofficial\b/i.test(videoTitle+' '+channelTitle);
  const yearMatch=Boolean(year&&new RegExp(`\\b${year}\\b`).test(videoTitle));
  const score=(isTrailer?8:4)+(official?4:0)+(yearMatch?2:0)-index/100;
  return [{videoId,videoTitle,channelTitle,score}];
 }).sort((a,b)=>b.score-a.score);
 const match=ranked[0];
 if(!match)return {trailerUrl:null,sourceUrl:null};
 return {
  trailerUrl:'https://www.youtube-nocookie.com/embed/'+match.videoId,
  sourceUrl:'https://www.youtube.com/watch?v='+match.videoId,
  videoId:match.videoId,title:match.videoTitle,channelTitle:match.channelTitle,
 };
}

export class YouTubeTrailerSearch{
 private storage:Store;
 private key:string;
 private fetchSearch:FetchSearch;
 private now:()=>number;
 constructor(storage:Store,key:string,fetchSearch:FetchSearch,now:()=>number=Date.now){this.storage=storage;this.key=key.trim();this.fetchSearch=fetchSearch;this.now=now;this.save(this.cache());}

 private cache():Record<string,CachedMatch>{
  try{
   const parsed=JSON.parse(this.storage.getItem(CACHE_KEY)??'{}');
   if(!parsed||typeof parsed!=='object'||Array.isArray(parsed))return {};
   const now=this.now(),valid:Record<string,CachedMatch>={};
   for(const [key,value] of Object.entries(parsed as Record<string,unknown>)){
    if(!value||typeof value!=='object')continue;
    const entry=value as Partial<CachedMatch>,result=entry.result;
    if(typeof entry.checkedAt!=='number'||!Number.isFinite(entry.checkedAt)||entry.checkedAt>now||now-entry.checkedAt>=MAX_STORAGE_AGE||!result||typeof result!=='object')continue;
    const match=result as Partial<TrailerMatch>;
    if(!(match.trailerUrl===null||typeof match.trailerUrl==='string')||!(match.sourceUrl===null||typeof match.sourceUrl==='string'))continue;
    if(match.trailerUrl!==null&&!/^https:\/\/www\.youtube-nocookie\.com\/embed\/[\w-]{11}$/.test(match.trailerUrl))continue;
    if(match.sourceUrl!==null&&!/^https:\/\/www\.youtube\.com\/watch\?v=[\w-]{11}$/.test(match.sourceUrl))continue;
    valid[key]={checkedAt:entry.checkedAt,result:{trailerUrl:match.trailerUrl,sourceUrl:match.sourceUrl,
     ...(typeof match.videoId==='string'&&/^[\w-]{11}$/.test(match.videoId)?{videoId:match.videoId}:{}),
     ...(typeof match.title==='string'?{title:match.title.slice(0,240)}:{}),
     ...(typeof match.channelTitle==='string'?{channelTitle:match.channelTitle.slice(0,160)}:{})}};
   }
   return valid;
  }catch{return {};}
 }
 private save(cache:Record<string,CachedMatch>):void{
  try{const entries=Object.entries(cache).sort((a,b)=>b[1].checkedAt-a[1].checkedAt).slice(0,MAX_CACHE);this.storage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(entries)));}catch{/* A full or unavailable local store should not prevent trailer playback. */}
 }
 pruneExpired():void{this.save(this.cache());}

 async find(title:string,year:number|null,force=false):Promise<TrailerMatch&{configured:boolean;cached?:boolean}>{
  if(!this.key)return {configured:false,trailerUrl:null,sourceUrl:null};
  try{if(this.storage.getItem(YOUTUBE_CONSENT_KEY)!=='accepted')return {configured:true,trailerUrl:null,sourceUrl:null};}catch{return {configured:true,trailerUrl:null,sourceUrl:null};}
  const normalized=normalizeTitle(title),cacheKey=normalized+':'+(year??'');
  const cache=this.cache(),saved=cache[cacheKey],ttl=saved?.result.trailerUrl?POSITIVE_TTL:NEGATIVE_TTL;
  if(!force&&saved&&this.now()-saved.checkedAt<ttl)return {...saved.result,configured:true,cached:true};

  const url=new URL('https://www.googleapis.com/youtube/v3/search');
  url.searchParams.set('part','snippet');url.searchParams.set('type','video');
  url.searchParams.set('q',[title,year,'official trailer'].filter(Boolean).join(' '));
  url.searchParams.set('maxResults','10');url.searchParams.set('videoEmbeddable','true');
  url.searchParams.set('videoSyndicated','true');url.searchParams.set('regionCode','IN');
  url.searchParams.set('relevanceLanguage','en');
  const raw=await this.fetchSearch(url.href,this.key);
  const data=(typeof raw==='string'?JSON.parse(raw):raw) as SearchResponse;
  const result=bestMatch(Array.isArray(data?.items)?data.items.slice(0,10):[],title,year);
  cache[cacheKey]={checkedAt:this.now(),result};this.save(cache);
  return {...result,configured:true};
 }
}
