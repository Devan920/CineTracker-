
import {createRoot} from 'react-dom/client';
import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Directory, Encoding, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import {Geolocation} from '@capacitor/geolocation';
import Home from '../../app/page';
import {SOURCE} from '../../lib/boxoffice';
import {resolveTheme, validTheme, THEME_KEY} from '../../lib/appearance';
import {Collector} from './collector';
import {MovieLibrary} from './movie-library';
import {responseText} from './http-text';
import {requestApproximateLocation} from './location';
import {TownSearch} from './towns';
import {UpdateChecker, RELEASES_URL, UPDATE_INTERVAL} from './updates';
import buildInfo from './build-info.json';
import '../../app/globals.css';
import '../../app/mobile.css';
import '../../app/redesign.css';
import './native.css';
import '../../app/cinema.css';

let preference: string = 'system';
try { preference = localStorage.getItem(THEME_KEY) ?? 'system'; } catch {}
document.documentElement.dataset.theme = resolveTheme(validTheme(preference), matchMedia('(prefers-color-scheme: dark)').matches);

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.native = 'true';
  let sourceQueue:Promise<unknown>=Promise.resolve(),lastSourceAt=0;
  const readPage=async(url:string):Promise<string>=>{
    const parsed=new URL(url);
    if(![SOURCE,'https://en.wikipedia.org'].includes(parsed.origin))throw new Error('Unsupported movie information address.');
    if(parsed.origin==='https://en.wikipedia.org'&&parsed.pathname!=='/w/api.php')throw new Error('Unsupported movie information address.');
    const request=async()=>{
      if(parsed.origin===SOURCE){const wait=1000-(Date.now()-lastSourceAt);if(wait>0)await new Promise(r=>setTimeout(r,wait));lastSourceAt=Date.now();}
      const result=await CapacitorHttp.request({url,method:'GET',
        headers:{Accept:parsed.origin===SOURCE?'text/html,text/plain':'application/json',
          'User-Agent':'CinePulse/1.0 (CineTracker/1.3; https://github.com/Devan920/CineTracker-)'},
        responseType:'text',shouldEncodeUrlParams:false,disableRedirects:true,connectTimeout:10000,readTimeout:18000});
      return responseText(result,parsed.origin);
    };
    if(parsed.origin!==SOURCE)return request();
    const pending=sourceQueue.then(request,request);sourceQueue=pending.catch(()=>{});return pending;
  };
  const collector=new Collector(localStorage,readPage);
  const library=new MovieLibrary(readPage,localStorage);
  const towns=new TownSearch(async url=>{
    const response=await CapacitorHttp.get({url,headers:{Accept:'application/json','User-Agent':'CineTracker/1.3 (https://github.com/Devan920/CineTracker-)'},responseType:'json',shouldEncodeUrlParams:false,disableRedirects:true,connectTimeout:10000,readTimeout:15000});
    if(response.status!==200||response.url&&new URL(response.url).origin!=='https://geocoding-api.open-meteo.com')throw Error('Town search is unavailable.');
    const data=typeof response.data==='string'?JSON.parse(response.data):response.data;if(JSON.stringify(data).length>400000)throw Error('Town search response is too large.');return data;
  });
  const appInfo = await App.getInfo().catch(() => ({version: buildInfo.version, build: String(buildInfo.versionCode)}));
  const updater = new UpdateChecker({
    version: appInfo.version, build: Number(appInfo.build), storage: localStorage,
    online: () => navigator.onLine,
    async fetchReleases() {
      const response = await CapacitorHttp.get({
        url: RELEASES_URL, headers: {Accept: 'application/vnd.github+json'},
        responseType: 'json', disableRedirects: true, connectTimeout: 10000, readTimeout: 15000,
      });
      if (response.status === 403 || response.status === 429) throw new Error('The update service is busy. Please try again later.');
      if (response.status !== 200) throw new Error('Could not reach the update service. Please try again.');
      if (response.url && new URL(response.url).origin !== 'https://api.github.com') throw new Error('Unexpected update service response.');
      const data = typeof response.data === 'string' ? JSON.parse(response.data) : response.data;
      if (JSON.stringify(data).length > 2000000) throw new Error('The update response is too large.');
      return data;
    },
  });
  setTimeout(() => {void updater.check();}, 2500);
  setInterval(() => {if (document.visibilityState === 'visible') void updater.check();}, UPDATE_INTERVAL);
  window.addEventListener('online', () => {void updater.check();});
  window.cinetrackerNative = {
    version: appInfo.version,
    updates: updater,
    location: {current:()=>requestApproximateLocation(Geolocation)},
    async request(path, init) {
      if (init?.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
      const address=new URL(path,'https://localhost');
      try{
        let data:unknown;
        if(address.pathname==='/api/locations/search')data={towns:await towns.search(address.searchParams.get('q')??'')};
        else if(address.pathname==='/api/archive')data=await library.getArchive(address.searchParams.get('refresh')==='1');
        else if(address.pathname==='/api/movies/search')data={movies:await library.search(address.searchParams.get('q')??'')};
        else if(address.pathname==='/api/movies/details'){
          const title=(address.searchParams.get('title')??'').slice(0,180);
          const year=Number(address.searchParams.get('year'))||null,id=Number(address.searchParams.get('pageid'))||undefined;
          if(!title||year&&(year<1880||year>2100)||id&&(!Number.isInteger(id)||id<1))return Response.json({error:'Invalid movie request.'},{status:400});
          data=await library.getDetails(title,year,id,address.searchParams.get('refresh')==='1');
        }
        if(data!==undefined){if(init?.signal?.aborted)throw new DOMException('Request cancelled.','AbortError');return Response.json(data);}
      }catch(error){return Response.json({error:error instanceof Error?error.message:'Movie information is unavailable.'},{status:503});}
      if (path === '/api/report' && (!init?.method || init.method === 'GET')) return Response.json(collector.getReport());
      if (path === '/api/refresh' && init?.method === 'POST') return Response.json(await collector.step());
      return Response.json({error: 'Unknown app request.'}, {status: 404});
    },
    async shareCsv(contents, filename) {
      const safeName = filename.replace(/[^a-zA-Z0-9._-]/g, '_');
      const file = await Filesystem.writeFile({
        path: 'exports/' + safeName, data: contents, directory: Directory.Cache,
        encoding: Encoding.UTF8, recursive: true,
      });
      await Share.share({title: 'CineTracker collection report', files: [file.uri], dialogTitle: 'Save or share report'});
    },
  };
  App.addListener('appStateChange', ({isActive}) => {
    if (isActive) {
      document.dispatchEvent(new Event('visibilitychange'));
      void updater.check();
    }
  });
  App.addListener('backButton', async () => {
    const dialog = document.querySelector<HTMLDialogElement>('dialog[open]');
    if (dialog) {
      dialog.dispatchEvent(new Event('cancel', {cancelable: true}));
      return;
    }
    const overview = document.querySelector<HTMLButtonElement>('.mobile-bottom-nav button');
    if (overview && overview.getAttribute('aria-current') !== 'page') {
      overview.click();
      return;
    }
    await App.minimizeApp();
  });
  document.addEventListener('click', event => {
    const anchor = (event.target as Element | null)?.closest<HTMLAnchorElement>('a[target="_blank"]');
    if (!anchor) return;
    const url = new URL(anchor.href);
    if (url.protocol !== 'https:') return;
    event.preventDefault();
    Browser.open({url: url.href}).catch(() => {
      window.alert('The link could not be opened. Please check your connection.');
    });
  });
}
createRoot(document.getElementById('root')!).render(<Home/>);

