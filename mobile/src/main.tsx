
import {createRoot} from 'react-dom/client';
import {Capacitor, CapacitorHttp} from '@capacitor/core';
import {App} from '@capacitor/app';
import {Browser} from '@capacitor/browser';
import {Directory, Encoding, Filesystem} from '@capacitor/filesystem';
import {Share} from '@capacitor/share';
import Home from '../../app/page';
import {SOURCE} from '../../lib/boxoffice';
import {resolveTheme, validTheme, THEME_KEY} from '../../lib/appearance';
import {Collector} from './collector';
import '../../app/globals.css';
import '../../app/mobile.css';
import '../../app/redesign.css';
import './native.css';

let preference: string = 'system';
try { preference = localStorage.getItem(THEME_KEY) ?? 'system'; } catch {}
document.documentElement.dataset.theme = resolveTheme(validTheme(preference), matchMedia('(prefers-color-scheme: dark)').matches);

if (Capacitor.isNativePlatform()) {
  document.documentElement.dataset.native = 'true';
  const collector = new Collector(localStorage, async url => {
    if (new URL(url).origin !== SOURCE) throw new Error('Unapproved report address.');
    const result = await CapacitorHttp.get({
      url,
      headers: {'Accept': 'text/html,text/plain', 'User-Agent': 'CinePulse/1.0 (CineTracker Android; public collection reports)'},
      responseType: 'text', disableRedirects: true, connectTimeout: 10000, readTimeout: 18000,
    });
    if (result.status >= 300 && result.status < 400) throw new Error('The report address changed. Please try again later.');
    if (result.status < 200 || result.status >= 300) throw new Error('Report returned HTTP ' + result.status + '.');
    if (result.url && new URL(result.url).origin !== SOURCE) throw new Error('Unexpected report destination.');
    if (typeof result.data !== 'string') throw new Error('Unexpected report format.');
    if (new TextEncoder().encode(result.data).byteLength > 3000000) throw new Error('Report exceeds the size limit.');
    return result.data;
  });
  window.cinetrackerNative = {
    async request(path, init) {
      if (init?.signal?.aborted) throw new DOMException('Request cancelled.', 'AbortError');
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
    if (isActive) document.dispatchEvent(new Event('visibilitychange'));
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
