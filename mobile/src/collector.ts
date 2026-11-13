import {REFRESH_MS,INDIAN_BOX_OFFICE_ORIGIN,INDIAN_BOX_OFFICE_RSS_URL,parseIndianBoxOfficeRss,type Movie,type Report} from '../../lib/boxoffice.ts';

export type PageFetcher=(url:string)=>Promise<string>;
export type StorageAdapter=Pick<Storage,'getItem'|'setItem'|'removeItem'>;
type Snapshot={version:2;report:Report|null};
const KEY='cinetracker-native-collections-v2',LEGACY_KEY='cinetracker-native-collections-v1';
const emptyReport=():Report=>({movies:[],checkedAt:null,lastAttemptAt:null,nextCheckAt:null,errors:[],sourceStatus:'initial',initial:true});
function isSyndicatedReport(report:unknown):report is Report{
 if(!report||typeof report!=='object'||!Array.isArray((report as Report).movies))return false;
 return (report as Report).movies.every(movie=>{try{return new URL(movie.sourceUrl).origin===INDIAN_BOX_OFFICE_ORIGIN;}catch{return false;}});
}
export class Collector{
 private snapshot:Snapshot={version:2,report:null};private busy=false;private storage:StorageAdapter;private fetchPage:PageFetcher;private now:()=>number;
 constructor(storage:StorageAdapter,fetchPage:PageFetcher,now:()=>number=Date.now){
  this.storage=storage;this.fetchPage=fetchPage;this.now=now;
  try{this.storage.removeItem(LEGACY_KEY);}catch{}
  try{const raw=this.storage.getItem(KEY);if(raw){const value=JSON.parse(raw);if(value.version===2&&(value.report===null||isSyndicatedReport(value.report)))this.snapshot=value;}}catch{}
 }
 private persist(){try{this.storage.setItem(KEY,JSON.stringify(this.snapshot));}catch{/* Keep the current report in memory if local storage is full. */}}
 getReport():Report{return this.snapshot.report??emptyReport();}
 async step():Promise<{state:string}>{
  if(this.busy)return{state:'busy'};this.busy=true;
  try{
   const stamp=this.now(),prior=this.snapshot.report;
   if(prior?.lastAttemptAt&&stamp-Date.parse(prior.lastAttemptAt)<REFRESH_MS)return{state:'current'};
   const attemptedAt=new Date(stamp).toISOString();let movies:Movie[]=[],checkedAt:string|null=null,errors:string[]=[],sourceStatus:Report['sourceStatus']='error';
   try{
    const xml=await this.fetchPage(INDIAN_BOX_OFFICE_RSS_URL);if(new TextEncoder().encode(xml).byteLength>1000000)throw new Error('The box-office feed exceeded the size limit.');
    const fetchedAt=new Date(this.now()).toISOString();movies=parseIndianBoxOfficeRss(xml,fetchedAt);
    if(!movies.length)throw new Error('The feed contained no complete India net and worldwide totals.');
    checkedAt=fetchedAt;sourceStatus='partial';
   }catch(error){errors.push(error instanceof Error?error.message:'The box-office feed is unavailable.');movies=prior?.movies??[];checkedAt=prior?.checkedAt??null;sourceStatus='error';}
   this.snapshot.report={movies,checkedAt,lastAttemptAt:attemptedAt,nextCheckAt:new Date(stamp+REFRESH_MS).toISOString(),errors,sourceStatus};this.persist();return{state:'complete'};
  }finally{this.busy=false;}
 }
}
