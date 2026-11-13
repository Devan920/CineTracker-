import {REFRESH_MS,INDIAN_BOX_OFFICE_ORIGIN,INDIAN_BOX_OFFICE_RSS_URL,parseIndianBoxOfficeRss,type Report} from './boxoffice';

const reportKey='report';
const emptyReport=():Report=>({movies:[],checkedAt:null,lastAttemptAt:null,nextCheckAt:null,errors:[],sourceStatus:'initial',initial:true});
async function read<T>(db:D1Database,key:string):Promise<T|null>{const row=await db.prepare('SELECT value FROM app_state WHERE key = ?').bind(key).first<{value:string}>();return row?JSON.parse(row.value):null;}
async function save(db:D1Database,key:string,value:unknown){await db.prepare('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),new Date().toISOString()).run();}
function isSyndicatedReport(report:Report|null):report is Report{return Boolean(report&&Array.isArray(report.movies)&&report.movies.every(movie=>{try{return new URL(movie.sourceUrl).origin===INDIAN_BOX_OFFICE_ORIGIN;}catch{return false;}}));}
async function fetchFeed():Promise<string>{
 const response=await fetch(INDIAN_BOX_OFFICE_RSS_URL,{headers:{'Accept':'application/rss+xml, application/xml, text/xml;q=0.9','User-Agent':'CineTracker/1.6 (+https://github.com/Devan920/CineTracker-)'},redirect:'manual',signal:AbortSignal.timeout(18000)});
 if(response.status>=300&&response.status<400)throw new Error('The box-office feed redirected unexpectedly.');
 if(!response.ok)throw new Error(`The box-office feed returned HTTP ${response.status}.`);
 const contentType=response.headers.get('Content-Type')??'';if(!/xml/i.test(contentType))throw new Error('The box-office feed returned an unexpected format.');
 const declared=Number(response.headers.get('Content-Length')??0);if(declared>1000000)throw new Error('The box-office feed exceeded the size limit.');
 const reader=response.body?.getReader();if(!reader)throw new Error('The box-office feed was empty.');
 const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>1000000){await reader.cancel();throw new Error('The box-office feed exceeded the size limit.');}chunks.push(value);}}finally{reader.releaseLock();}
 const bytes=new Uint8Array(size);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}return new TextDecoder().decode(bytes);
}
async function trustedPrevious(db:D1Database):Promise<Report|null>{const value=await read<Report>(db,reportKey);return isSyndicatedReport(value)?value:null;}
export async function getReport(db:D1Database):Promise<Report>{return (await trustedPrevious(db))??emptyReport();}

export async function refreshStep(db:D1Database):Promise<{state:string;retryAfter?:number;report?:Report}>{
 const token=crypto.randomUUID(),now=Date.now();
 const lock=await db.prepare('INSERT INTO leases(key,token,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE leases.expires_at < ? RETURNING token').bind('collector',token,now+45000,now).first<{token:string}>();
 if(!lock)return{state:'busy',retryAfter:2};
 try{
  const previous=await trustedPrevious(db);
  if(previous?.lastAttemptAt&&now-Date.parse(previous.lastAttemptAt)<REFRESH_MS)return{state:'current'};
  const attemptedAt=new Date(now).toISOString();let movies:Report['movies']=[],errors:string[]=[],checkedAt:string|null=null,sourceStatus:Report['sourceStatus']='error';
  try{
   const xml=await fetchFeed(),finishedAt=new Date().toISOString();movies=parseIndianBoxOfficeRss(xml,finishedAt);
   if(!movies.length)throw new Error('The feed contained no complete India net and worldwide totals.');
   checkedAt=finishedAt;sourceStatus='partial';
  }catch(error){errors.push(error instanceof Error?error.message:'The box-office feed is unavailable.');movies=previous?.movies??[];checkedAt=previous?.checkedAt??null;sourceStatus='error';}
  const report:Report={movies,checkedAt,lastAttemptAt:attemptedAt,nextCheckAt:new Date(now+REFRESH_MS).toISOString(),errors,sourceStatus};
  await save(db,reportKey,report);
  // Drop any in-progress job left by the retired page scraper.
  await db.prepare('DELETE FROM app_state WHERE key=?').bind('refresh-job').run();
  return{state:'complete',report};
 }finally{await db.prepare('DELETE FROM leases WHERE key=? AND token=?').bind('collector',token).run();}
}
export async function dataRoute(req:Request,env:Cloudflare.Env):Promise<Response|null>{
 const path=new URL(req.url).pathname;if(path!=='/api/report'&&path!=='/api/refresh')return null;
 const json=(data:unknown,status=200)=>Response.json(data,{status,headers:{'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'}});
 if(!env.DB)return json({error:'Collection storage is unavailable.'},503);
 try{
  if(path==='/api/report'&&req.method==='GET')return json(await getReport(env.DB));
  if(path==='/api/refresh'&&req.method==='POST'){
   const origin=req.headers.get('Origin');if((origin&&origin!==new URL(req.url).origin)||req.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Cross-origin update rejected.'},403);
   return json(await refreshStep(env.DB));
  }
  return json({error:'Method not allowed.'},405);
 }catch(e){console.error('Box office storage error',e instanceof Error?e.message:'Unknown');return json({error:'Unable to load the collection service. Please try again.'},503);}
}
