import {parseTowns,type AreaChoice} from '../../lib/theatres.ts';
export class TownSearch{
 private read:(url:string)=>Promise<unknown>;private cache=new Map<string,{at:number;towns:AreaChoice[]}>();private pending=new Map<string,Promise<AreaChoice[]>>();private lastRequest=0;private queue:Promise<unknown>=Promise.resolve();
 constructor(read:(url:string)=>Promise<unknown>){this.read=read;}
 search(query:string):Promise<AreaChoice[]>{
  const name=query.trim().slice(0,80),key=name.toLocaleLowerCase();if(name.length<2)return Promise.resolve([]);
  const cached=this.cache.get(key);if(cached&&Date.now()-cached.at<86400000)return Promise.resolve(cached.towns);
  if(this.pending.has(key))return this.pending.get(key)!;
  const run=async()=>{
   const wait=1100-(Date.now()-this.lastRequest);if(wait>0)await new Promise(r=>setTimeout(r,wait));this.lastRequest=Date.now();
   const url='https://geocoding-api.open-meteo.com/v1/search?'+new URLSearchParams({name,count:'6',language:'en',format:'json',countryCode:'IN'});
   const towns=parseTowns(await this.read(url));this.cache.set(key,{at:Date.now(),towns});if(this.cache.size>30)this.cache.delete(this.cache.keys().next().value!);return towns;
  };
  const result=this.queue.then(run,run).finally(()=>this.pending.delete(key));this.queue=result.catch(()=>{});this.pending.set(key,result);return result;
 }
}
