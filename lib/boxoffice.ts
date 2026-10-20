export const REFRESH_MS = 20 * 60 * 1000;
export const SOURCE = 'https://www.sacnilk.com';
export const CATALOG_URL = SOURCE + '/entertainmenttopbar/Box_Office_Collection?hl=en';
export type Daily = { day: number; date: string | null; net: number | null };
export type Movie = {
  id: string; title: string; languages: string[]; poster: string | null; industry?: string | null;
  day: number | null; reportDate: string | null; releaseDate: string | null;
  indiaNet: number | null; indiaGross: number | null; worldwide: number | null; overseas: number | null;
  daily: Daily[]; sourceUrl: string; sourceUpdatedAt: string | null; checkedAt: string;
  lastSeenAt: string; status: 'estimate' | 'reported' | 'unavailable' | 'review';
  coverage: 'active-report' | 'recent-release'; warnings: string[]; fetchError?: string;
};
export type Report = { movies: Movie[]; checkedAt: string | null; lastAttemptAt: string | null; nextCheckAt: string | null; errors: string[]; sourceStatus: 'ok' | 'partial' | 'error' | 'initial'; refreshing?: boolean; initial?: boolean; };
export const istDate = (date: string | number | Date = Date.now()) => new Date(new Date(date).getTime() + 330 * 60000).toISOString().slice(0,10);
export function textOf(s: string): string {
  return s.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,' ').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi,' ').replace(/<[^>]+>/g,' ').replace(/&#x([0-9a-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16))).replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(+n)).replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&apos;|&#039;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/\s+/g,' ').trim();
}
export function amount(s: string | undefined | null): number | null {
  if (!s || /not available|N\/A|--|[-−]\s*\d/i.test(s)) return null;
  const m = textOf(s).match(/(?:₹|Rs\.?\s*)?\s*([\d,]+(?:\.\d+)?)\s*(Cr(?:ore)?s?|L(?:akh)?s?|Crore)\b/i);
  if (!m) return null;
  const n=Number(m[1].replace(/,/g,'')) * (/^L/i.test(m[2]) ? 0.01 : 1);
  return Number.isFinite(n) && n >= 0 && n < 1000000 ? Math.round(n*10000)/10000 : null;
}
export function safeSource(path: string): string | null {
  try { const u=new URL(path.replace(/&amp;/g,'&'),SOURCE); return u.origin===SOURCE && (/^\/(quicknews|movie)\/[A-Za-z0-9_():.,!&%+\-]+$/.test(u.pathname)) ? u.href : null; } catch { return null; }
}
const cleanPoster=(s?:string)=>{try{const u=new URL(s??'');return u.protocol==='https:'&&u.hostname==='cdn.sacnilk.com'?u.href:null;}catch{return null;}};
function blank(id: string,title:string,now:string):Movie {return {id,title,languages:[],poster:null,day:null,reportDate:null,releaseDate:null,indiaNet:null,indiaGross:null,worldwide:null,overseas:null,daily:[],sourceUrl:SOURCE+'/live',sourceUpdatedAt:null,checkedAt:now,lastSeenAt:now,status:'unavailable',coverage:'active-report',warnings:[]};}
export const movieId=(path:string)=>decodeURIComponent(new URL(path,SOURCE).pathname.split('/').pop()??'').replace(/_Box_Office_Collection_Day_\d+.*$/i,'').toLowerCase();
export function discoverDaily(html:string):Map<string,string> {
 const map=new Map<string,string>();
 for(const m of html.matchAll(/href=["']([^"']*\/quicknews\/[^"']*Box_Office_Collection_Day_(\d+)[^"']*)["']/gi)) {
  const url=safeSource(m[1]);if(!url)continue;const id=movieId(url);const old=map.get(id);if(!old||+(old.match(/Day_(\d+)/i)?.[1]??0)<+m[2])map.set(id,url);
 }
 return map;
}
export function parseLive(html:string,now:string):Movie[] {
 const movies:Movie[]=[];
 for(const section of html.matchAll(/<section\b[^>]*data-lvp-film[^>]*>([\s\S]*?)<\/section>/gi)) {
  const s=section[1],h=s.match(/<h2[^>]*>\s*<a[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/i);
  if(!h)continue;const url=safeSource(h[1]);if(!url)continue;
  const m=blank(movieId(url),textOf(h[2]),now);m.sourceUrl=url;
  m.poster=cleanPoster(s.match(/<img[^>]*src="([^"]+)"/i)?.[1]);
  const meta=textOf(s.match(/<\/h2>\s*<div>([\s\S]*?)<\/div>/i)?.[1]??'');
  m.languages=meta.split('·')[0].split(',').map(x=>x.trim()).filter(Boolean);
  m.day=Number(meta.match(/Day (\d+) today/)?.[1])||null;
  const rel=meta.match(/Released \w+ (\d+) (\w+)/); if(rel){const y=istDate(now).slice(0,4);const ms=Date.parse(`${rel[1]} ${rel[2]} ${y} 00:00:00 GMT+0530`);if(Number.isFinite(ms))m.releaseDate=istDate(ms);}
  const daily=discoverDaily(s).get(m.id);if(daily)m.sourceUrl=daily;
  movies.push(m);
 }
 if(!movies.length)throw new Error('Live listing layout changed or returned no film records.');
 return movies;
}
const languageMap:Record<string,string>={'Bollywood':'Hindi','Tollywood':'Telugu','Kollywood':'Tamil','Mollywood':'Malayalam','Sandalwood':'Kannada','Hollywood':'English','Bengali Tollywood':'Bengali','Pollywood':'Punjabi','Marathi Film':'Marathi','Odia Cinema':'Odia','Jollywood':'Assamese','Gollywood':'Gujarati'};
// Use explicit film-industry metadata, never the order of dubbed languages.
export function parseIndustry(html:string):string|null {
 const head=html.match(/<head\b[^>]*>([\s\S]*?)<\/head>/i)?.[1]??html;
 const tag=Array.from(head.matchAll(/<meta\b[^>]*>/gi),m=>m[0]).find(tag=>/\bname\s*=\s*["']keywords["']/i.test(tag));
 const content=tag?.match(/\bcontent\s*=\s*(["'])([\s\S]*?)\1/i)?.[2]??'';
 const keywords=textOf(content).split(',').map(s=>s.trim().toLowerCase());
 const matches=Object.keys(languageMap).filter(industry=>keywords.includes(industry.toLowerCase()+' movies'));
 return matches.length===1?matches[0]:null;
}
export function parseCatalog(html:string,now:string):Movie[] {
 const output:Movie[]=[];
 for(const s of html.split(/<div class="movie-card\b/).slice(1)) {
  const h=s.match(/<h3[^>]*>([\s\S]*?)<\/h3>/i),path=s.match(/href="(\/movie\/[^"?]+)"/i)?.[1];
  if(!h||!path)continue;const url=safeSource(path);if(!url)continue;
  const name=textOf(h[1]),industry=name.match(/\(([^)]+)\)\s*$/)?.[1];
  const m=blank(movieId(url),name.replace(/\s*\([^)]+\)\s*$/,''),now);m.sourceUrl=CATALOG_URL;m.coverage='recent-release';
  m.languages=industry&&languageMap[industry]?[languageMap[industry]]:[];m.industry=industry&&languageMap[industry]?industry:null;
  m.poster=cleanPoster(s.match(/<img[^>]*src="([^"]+)"/)?.[1]);const body=textOf(s.split('<!-- Desktop')[0]);
  m.indiaNet=amount(body.match(/Net:\s*([^]*?)Gross:/)?.[1]);m.indiaGross=amount(body.match(/Gross:\s*([^]*?)WW:/)?.[1]);m.worldwide=amount(body.match(/WW:\s*([^]*?)Days:/)?.[1]);
  m.day=Number(body.match(/Days:\s*(\d+)/)?.[1])||null;m.status=m.indiaNet===null?'unavailable':'reported';
  m.warnings=['Source listing does not state the reporting cutoff. Theatre availability is not confirmed.'];
  validate(m);output.push(m);
 }
 return output;
}
export function parseDetail(html:string,url:string,base:Movie|undefined,now:string):Movie {
 const h=textOf(html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i)?.[1]??'');
 if(!/Box Office Collection Day \d+/i.test(h))throw new Error('Expected a daily collection report; no matching headline.');
 const id=movieId(url);if(base&&base.id!==id)throw new Error('Movie identity mismatch.');
 const m:Movie=base?{...base,daily:[],warnings:[],fetchError:undefined}:blank(id,h.replace(/\s*Box Office Collection Day.*$/i,''),now);
 m.checkedAt=now;m.sourceUrl=url;m.coverage='active-report';m.day=Number(h.match(/Collection Day (\d+)/i)?.[1]);
 if(/<meta\b[^>]*\bname\s*=\s*["']keywords["']/i.test(html))m.industry=parseIndustry(html);
 const schemas:any[]=[];
 for(const j of html.matchAll(/<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/gi)) {try{const v=JSON.parse(j[1]);schemas.push(...(Array.isArray(v)?v:v['@graph']??[v]));}catch{}}
 const schema=schemas.find(s=>s['@type']==='NewsArticle')??schemas.find(s=>s['@type']==='WebPage');
 const updated=schema?.dateModified??html.match(/<time[^>]*class="sn-updated"[^>]*datetime="([^"]+)"/)?.[1];
 m.sourceUpdatedAt=updated&&Number.isFinite(Date.parse(updated))?new Date(updated).toISOString():null;
 const published=schema?.datePublished;
 // Publication date identifies the daily report; source modifications may happen the following morning.
 m.reportDate=published&&Number.isFinite(Date.parse(published))?istDate(published):null;
 const paragraph=textOf(html.match(/<p[^>]*class="[^"]*article-summary[^"]*"[^>]*>([\s\S]*?)<\/p>/i)?.[1]??'');
 const narrative=paragraph||schema?.description||'';
 const currency='([₹\\d,.\\s]+(?:Cr(?:ore)?s?|Lakh))';
 const read=(label:string)=>amount(narrative.match(new RegExp(label+'\\s*'+currency,'i'))?.[1]);
 m.indiaNet=read('total India net(?: collections)? to')??read('India net total')??amount(html.match(/Overall Total India Net Collection<\/span>\s*<span[^>]*>\s*([^<]+)/i)?.[1]);
 m.indiaGross=read('total India gross collections to')??read('total India gross stands at');m.worldwide=read('worldwide gross collection to');m.overseas=read('total overseas gross to')??read('Overseas, the film has grossed a total of');
 const labels=html.match(/const\s+labels\s*=\s*(\[[^;]+\]);/),values=html.match(/const\s+netData\s*=\s*(\[[^;]+\]);/);
 if(labels&&values){try{const ls=JSON.parse(labels[1]),vs=JSON.parse(values[1]);if(Array.isArray(ls)&&Array.isArray(vs)&&ls.length===vs.length){m.daily=ls.map((s:string,i:number)=>({day:Number(String(s).match(/^Day (\d+)$/)?.[1]),net:typeof vs[i]==='number'&&Number.isFinite(vs[i])&&vs[i]>=0?vs[i]:null,date:null})).filter((d:Daily)=>d.day>0&&d.day<=2000);}}catch{}}
 if(m.reportDate&&m.day){m.releaseDate=new Date(Date.parse(m.reportDate+'T00:00:00Z')-(m.day-1)*86400000).toISOString().slice(0,10);m.daily=m.daily.map(d=>({...d,date:new Date(Date.parse(m.releaseDate!+'T00:00:00Z')+(d.day-1)*86400000).toISOString().slice(0,10)}));}
 if(!m.languages.length){const keywords=String(schema?.keywords??'');m.languages=Object.values(languageMap).filter(l=>keywords.includes(l+' movies'));}
 // If the exact report lacks a metric, retain null; never borrow an older total.
 if(m.indiaNet===null&&m.daily.length===0)throw new Error('No validated collection fields found; retaining prior report.');
 m.status=m.reportDate===istDate(now)?'estimate':'reported';
 if(!m.sourceUpdatedAt)m.warnings.push('Publisher update time is unavailable.');
 if(!m.reportDate)m.warnings.push('Daily reporting date is unavailable.');
 validate(m);return m;
}
export function validate(m:Movie):void {
 const warn=(s:string)=>{m.warnings.push(s);m.status='review';};
 if(m.indiaGross!==null&&m.indiaNet!==null&&m.indiaGross+0.03<m.indiaNet){warn('Source gross is lower than net; inconsistent totals are withheld.');m.indiaGross=null;m.worldwide=null;}
 if(m.worldwide!==null&&m.indiaGross!==null&&m.worldwide+0.05<m.indiaGross){warn('Worldwide total is lower than India gross; worldwide total is withheld.');m.worldwide=null;}
 if(m.worldwide!==null&&m.indiaGross!==null&&m.overseas!==null&&Math.abs(m.worldwide-m.indiaGross-m.overseas)>Math.max(.1,m.worldwide*.002)){warn('Source worldwide breakdown does not reconcile; worldwide total is withheld.');m.worldwide=null;}
 const ns=m.daily.map(x=>x.net);const contiguous=m.daily.every((d,i)=>d.day===i+1);
 if(m.indiaNet!==null&&ns.length&&ns.every(x=>x!==null)&&contiguous&&m.daily.at(-1)?.day===m.day){const sum=ns.reduce<number>((s,n)=>s+(n??0),0);if(Math.abs(sum-m.indiaNet)>Math.max(.15,m.indiaNet*.002)){warn('Source daily figures do not reconcile with the reported total; total is withheld.');m.indiaNet=null;}}
}
export function robotsRules(raw:string,path:string):{allowed:boolean;delay:number} {
 const groups:{agents:string[];rules:{allow:boolean;pattern:string}[];delay:number}[]=[];let group:typeof groups[number]|null=null,hasRules=false;
 for(const line of raw.split('\n')){const clean=line.split('#')[0].trim();const i=clean.indexOf(':');if(i<0)continue;const key=clean.slice(0,i).toLowerCase(),value=clean.slice(i+1).trim();if(key==='user-agent'){if(!group||hasRules){group={agents:[],rules:[],delay:1};groups.push(group);hasRules=false;}group.agents.push(value.toLowerCase());}else if(group){hasRules=true;if((key==='allow'||key==='disallow')&&value)group.rules.push({allow:key==='allow',pattern:value});if(key==='crawl-delay'&&Number.isFinite(+value))group.delay=Math.max(1,+value);}}
 const specific=groups.filter(g=>g.agents.some(a=>a!=='*'&&'cinepulse'.startsWith(a)));const selected=specific.length?specific:groups.filter(g=>g.agents.includes('*'));
 let best=-1,allow=true;for(const g of selected)for(const r of g.rules){const esc=r.pattern.replace(/[.+?^{}()|[\]\\]/g,'\\$&').replace(/\*/g,'.*');if(new RegExp('^'+esc).test(path)){const n=r.pattern.replace(/[*$]/g,'').length;if(n>best||(n===best&&r.allow)){best=n;allow=r.allow;}}}
 return {allowed:allow,delay:Math.max(1,...selected.map(g=>g.delay))};
}
