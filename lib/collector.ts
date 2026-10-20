import { REFRESH_MS,SOURCE,CATALOG_URL,parseLive,parseCatalog,discoverDaily,parseDetail,robotsRules, type Movie,type Report } from './boxoffice';
import seed from './seed.json';
export type Job={startedAt:string;queue:string[];movies:Movie[];errors:string[];robots:string;details:Record<string,string>;completed:number;total:number;lastRequestAt:number;dataPages:number;};
const reportKey='report', jobKey='refresh-job';
async function read<T>(db:D1Database,key:string):Promise<T|null>{const row=await db.prepare('SELECT value FROM app_state WHERE key = ?').bind(key).first<{value:string}>();return row?JSON.parse(row.value):null;}
async function save(db:D1Database,key:string,value:unknown){await db.prepare('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(key,JSON.stringify(value),new Date().toISOString()).run();}
export async function getReport(db:D1Database):Promise<Report&{job?:{completed:number;total:number}}>{const report=await read<Report>(db,reportKey)??{...seed,initial:true} as Report;const job=await read<Job>(db,jobKey);const movies=report.movies.map(movie=>movie.industry===undefined?{...movie,industry:(seed.movies as Movie[]).find(s=>s.id===movie.id)?.industry??null}:movie);return {...report,movies,refreshing:!!job,...(job?{job:{completed:job.completed,total:job.total}}:{})};}
async function fetchPage(url:string,robots:string){const parsed=new URL(url);if(parsed.origin!==SOURCE)throw new Error('Unapproved source host.');if(parsed.pathname!=='/robots.txt'&&!robotsRules(robots,parsed.pathname+parsed.search).allowed)throw new Error('Publisher disallows automated access to this page.');const res=await fetch(url,{headers:{'User-Agent':'CinePulse/1.0 (source-attributed box-office dashboard)','Accept':'text/html,text/plain'},redirect:'manual',signal:AbortSignal.timeout(18000)});if(res.status>=300&&res.status<400)throw new Error('Publisher redirected this page; adapter needs review.');if(!res.ok)throw new Error(`Source returned HTTP ${res.status}.`);const declared=Number(res.headers.get('Content-Length')??0);if(declared>3000000)throw new Error('Source response exceeds size limit.');const reader=res.body?.getReader();if(!reader)throw new Error('Empty source response.');const chunks:Uint8Array[]=[];let size=0;try{for(;;){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>3000000){await reader.cancel();throw new Error('Source response exceeds size limit.');}chunks.push(value);}}finally{reader.releaseLock();}const bytes=new Uint8Array(size);let n=0;for(const c of chunks){bytes.set(c,n);n+=c.length;}return new TextDecoder().decode(bytes);}
export async function refreshStep(db:D1Database):Promise<{state:string;completed?:number;total?:number;retryAfter?:number;report?:Report}> {
 const token=crypto.randomUUID(),now=Date.now();
 const lock=await db.prepare('INSERT INTO leases(key,token,expires_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET token=excluded.token,expires_at=excluded.expires_at WHERE leases.expires_at < ? RETURNING token').bind('collector',token,now+45000,now).first<{token:string}>();
 if(!lock)return{state:'busy',retryAfter:2};
 try{
  let job=await read<Job>(db,jobKey);const previous=await read<Report>(db,reportKey);
  if(!job){
   if(previous?.lastAttemptAt&&now-Date.parse(previous.lastAttemptAt)<REFRESH_MS)return{state:'current'};
   job={startedAt:new Date(now).toISOString(),queue:[SOURCE+'/robots.txt',SOURCE+'/live',SOURCE+'/',CATALOG_URL],movies:[],errors:[],robots:'',details:{},completed:0,total:4,lastRequestAt:0,dataPages:0};
  }
  const path=job.queue[0];
  if(path){
   const delay=job.robots?robotsRules(job.robots,new URL(path).pathname).delay*1000:1000;
   if(now-job.lastRequestAt<delay){await save(db,jobKey,job);return {state:'running',completed:job.completed,total:job.total,retryAfter:Math.ceil((delay-(now-job.lastRequestAt))/1000)};}
   job.queue.shift();job.lastRequestAt=now;
   try{
    const html=await fetchPage(path,job.robots);const time=new Date().toISOString();
    if(path.endsWith('/robots.txt')){if(!/^User-agent:/im.test(html))throw new Error('Invalid robots response.');job.robots=html;}
    else if(path===SOURCE+'/live'){job.movies=parseLive(html,time);job.details=Object.fromEntries(discoverDaily(html));}
    else if(path===SOURCE+'/'){for(const [id,url]of discoverDaily(html)){const old=job.details[id];if(!old||+(old.match(/Day_(\d+)/)?.[1]??0)<+(url.match(/Day_(\d+)/)?.[1]??0))job.details[id]=url;}}
    else if(path===CATALOG_URL){const all=parseCatalog(html,time);if(!all.length)throw new Error('Catalog layout changed.');for(const m of all){const index=job.movies.findIndex(x=>x.id===m.id);if(index<0)job.movies.push(m);else{const original=job.movies[index];job.movies[index]={...m,languages:original.languages,poster:original.poster??m.poster,releaseDate:original.releaseDate,coverage:'active-report'};}}}
    else{const id=Object.keys(job.details).find(id=>job.details[id]===path);const index=job.movies.findIndex(m=>m.id===id);const m=parseDetail(html,path,index>=0?job.movies[index]:undefined,time);if(index<0)job.movies.push(m);else job.movies[index]=m;}
    if(!path.endsWith('/robots.txt'))job.dataPages=(job.dataPages??0)+1;
   }catch(e){
    const msg=e instanceof Error?e.message:'Source unavailable';job.errors.push(`${new URL(path).pathname}: ${msg}`);
    if(path.endsWith('/robots.txt'))job.queue=[];
    const id=Object.keys(job.details).find(id=>job.details[id]===path);if(id){const prior=previous?.movies.find(m=>m.id===id)??(seed.movies as Movie[]).find(m=>m.id===id);const index=job.movies.findIndex(m=>m.id===id);if(prior){const retained={...prior,fetchError:msg};if(index<0)job.movies.push(retained);else job.movies[index]=retained;}}
   }
   job.completed++;
   // All discovery pages finish before any per-film pages. Never request an internal API.
   if(job.completed===4){job.queue=Object.values(job.details).slice(0,80);job.total=job.completed+job.queue.length;if(Object.values(job.details).length>80)job.errors.push('Coverage limit reached: 80 daily reports processed.');}
  }
  if(job.queue.length){await save(db,jobKey,job);return{state:'running',completed:job.completed,total:job.total,retryAfter:1};}
  const oldMovies=previous?.movies??seed.movies as Movie[];
  for(let i=0;i<job.movies.length;i++){
   const current=job.movies[i],old=oldMovies.find(m=>m.id===current.id);
   if(old&&current.indiaNet===null&&!current.daily.length&&(old.indiaNet!==null||old.daily.length))job.movies[i]={...old,lastSeenAt:current.lastSeenAt,warnings:[...new Set([...old.warnings,'No newer daily report discovered. Showing the last available figures.'])]};
  }
  if(job.errors.some(e=>e.startsWith('/live:')||e.startsWith('/:')||e.startsWith('/entertainmenttopbar/'))){for(const old of oldMovies)if(!job.movies.some(m=>m.id===old.id))job.movies.push({...old,fetchError:'Discovery was incomplete; retaining the last known report.'});}
  const good=job.movies.length>0&&(job.dataPages??0)>0;
  const report:Report={movies:good?job.movies:(previous?.movies??seed.movies as Movie[]),checkedAt:good?new Date().toISOString():(previous?.checkedAt??seed.checkedAt),lastAttemptAt:new Date().toISOString(),nextCheckAt:new Date(Date.now()+REFRESH_MS).toISOString(),errors:job.errors,sourceStatus:!good?'error':job.errors.length?'partial':'ok'};
  await db.batch([db.prepare('INSERT INTO app_state(key,value,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=excluded.updated_at').bind(reportKey,JSON.stringify(report),new Date().toISOString()),db.prepare('DELETE FROM app_state WHERE key=?').bind(jobKey)]);
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
   // This shared updater relies on the confirmed owner-private Sites access policy.
   const origin=req.headers.get('Origin');if((origin&&origin!==new URL(req.url).origin)||req.headers.get('Sec-Fetch-Site')==='cross-site')return json({error:'Cross-origin update rejected.'},403);
   return json(await refreshStep(env.DB));
  }
  return json({error:'Method not allowed.'},405);
 }catch(e){console.error('Box office storage error',e instanceof Error?e.message:'Unknown');return json({error:'Unable to load the collection service. Please try again.'},503);}
}
