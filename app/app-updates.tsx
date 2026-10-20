
'use client';
import {useSyncExternalStore} from 'react';
import {ArrowUpCircle, Download, RefreshCw, X} from 'lucide-react';
import {nativeBridge} from '../lib/platform';
import type {UpdateState} from '../lib/app-updates';

const EMPTY: UpdateState = {status: 'idle', installedVersion: '', installedBuild: 0,
  latest: null, checkedAt: null, dismissedBuild: null, message: null};
const emptySnapshot = () => EMPTY;
const noopSubscribe = () => () => {};
function useUpdates() {
  const updater = nativeBridge()?.updates;
  const state = useSyncExternalStore(updater?.subscribe ?? noopSubscribe,
    updater?.getSnapshot ?? emptySnapshot, emptySnapshot);
  return {updater, state};
}
export function AppUpdateBanner() {
  const {updater, state} = useUpdates();
  if (!updater || !state.latest || state.dismissedBuild === state.latest.versionCode) return null;
  return <aside className="app-update-banner" aria-label="App update available">
    <ArrowUpCircle size={23} aria-hidden="true"/>
    <div><strong>Update available</strong><p>CineTracker {state.latest.version} is ready.</p></div>
    <button className="button" onClick={() => window.dispatchEvent(new Event('cinepulse:preferences'))}>View update</button>
    <button className="icon-button" aria-label="Dismiss update notification" onClick={updater.dismiss}><X size={18}/></button>
  </aside>;
}
export function AppUpdateSettings() {
  const {updater, state} = useUpdates();
  if (!updater) return null;
  const checking = state.status === 'checking';
  const text = checking ? 'Checking for a new version…' :
    state.status === 'error' ? state.message :
    state.latest ? 'A new version is ready to download.' :
    state.status === 'current' ? 'No newer version is available.' :
    'Checks automatically when you open the app, up to once every 6 hours.';
  return <section className="app-update-section" aria-labelledby="app-update-title">
    <div className="app-update-heading"><ArrowUpCircle size={20}/><div>
      <h3 id="app-update-title">App updates</h3>
      <p>Installed version {state.installedVersion}</p>
    </div></div>
    <p className="app-update-status" role="status" aria-live="polite">{text}</p>
    {state.latest && <div className="app-update-release"><strong>Version {state.latest.version}</strong>
      <p>Download the APK, then open it to install. Test builds may require reinstalling.</p>
      <a className="button primary" href={state.latest.downloadUrl} target="_blank" rel="noopener noreferrer"><Download size={16}/>Download update</a>
      <a className="app-update-notes" href={state.latest.releaseUrl} target="_blank" rel="noopener noreferrer">What’s new</a>
    </div>}
    <button className="button app-update-check" disabled={checking} onClick={() => {void updater.check(true);}}>
      <RefreshCw size={16} className={checking ? 'app-update-spin' : ''}/>{checking ? 'Checking…' : 'Check for updates'}
    </button>
    {state.checkedAt && <small className="app-update-checked">Last checked: {new Date(state.checkedAt).toLocaleString(undefined, {dateStyle: 'medium', timeStyle: 'short'})}</small>}
  </section>;
}
