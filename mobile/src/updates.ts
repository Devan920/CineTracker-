
import type {AndroidRelease, AppUpdater, UpdateState} from '../../lib/app-updates.ts';

export const REPOSITORY = 'Devan920/CineTracker-';
export const RELEASES_URL = 'https://api.github.com/repos/' + REPOSITORY + '/releases?per_page=30';
export const UPDATE_INTERVAL = 6 * 60 * 60 * 1000;
const RETRY_INTERVAL = 15 * 60 * 1000;
const CACHE_KEY = 'cinetracker-app-updates-v1';
const RELEASE_ROOT = 'https://github.com/' + REPOSITORY + '/releases/';
type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem'>;
type Options = {
  version: string; build: number; storage: Storage;
  fetchReleases: () => Promise<unknown>;
  now?: () => number; online?: () => boolean;
};
const record = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function fromRelease(value: unknown): AndroidRelease | null {
  if (!record(value) || value.draft !== false || value.prerelease !== true) return null;
  if (typeof value.tag_name !== 'string') return null;
  const match = /^android-test-v(\d+\.\d+\.\d+)-(\d+)$/.exec(value.tag_name);
  if (!match) return null;
  const version = match[1], versionCode = Number(match[2]);
  if (!Number.isSafeInteger(versionCode) || versionCode < 1 || versionCode > 2100000000) return null;
  const releaseUrl = RELEASE_ROOT + 'tag/' + value.tag_name;
  const filename = 'CineTracker-' + version + '-debug.apk';
  const downloadUrl = RELEASE_ROOT + 'download/' + value.tag_name + '/' + filename;
  if (value.html_url !== releaseUrl || typeof value.published_at !== 'string' ||
      !Number.isFinite(Date.parse(value.published_at)) || !Array.isArray(value.assets)) return null;
  // A tag or draft alone must never advertise a downloadable update.
  const asset = value.assets.find(a => record(a) && a.name === filename &&
    a.state === 'uploaded' && a.browser_download_url === downloadUrl &&
    typeof a.size === 'number' && a.size > 0);
  if (!asset) return null;
  return {version, versionCode, releaseUrl, downloadUrl, publishedAt: value.published_at};
}
export function selectUpdate(payload: unknown, installedBuild: number): AndroidRelease | null {
  if (!Array.isArray(payload)) throw new Error('The update service returned an unexpected response.');
  const releases = payload.map(fromRelease).filter((r): r is AndroidRelease =>
    r !== null && r.versionCode > installedBuild);
  releases.sort((a, b) => b.versionCode - a.versionCode);
  return releases[0] ?? null;
}
function validCachedRelease(value: unknown): value is AndroidRelease {
  if (!record(value)) return false;
  const tag = 'android-test-v' + value.version + '-' + value.versionCode;
  const parsed = fromRelease({
    tag_name: tag, html_url: value.releaseUrl, draft: false, prerelease: true,
    published_at: value.publishedAt,
    assets: [{name: 'CineTracker-' + value.version + '-debug.apk', state: 'uploaded',
      size: 1, browser_download_url: value.downloadUrl}],
  });
  return !!parsed && parsed.versionCode === value.versionCode && parsed.version === value.version;
}
export class UpdateChecker implements AppUpdater {
  private options: Options;
  private state: UpdateState;
  private listeners = new Set<() => void>();
  private inFlight: Promise<UpdateState> | null = null;
  private lastAttempt: number | null = null;
  constructor(options: Options) {
    this.options = options;
    this.state = {status: 'idle', installedVersion: options.version, installedBuild: options.build,
      latest: null, checkedAt: null, dismissedBuild: null, message: null};
    try {
      const saved: unknown = JSON.parse(options.storage.getItem(CACHE_KEY) ?? 'null');
      if (record(saved) && saved.build === options.build && typeof saved.checkedAt === 'string' &&
          Number.isFinite(Date.parse(saved.checkedAt)) && Date.parse(saved.checkedAt) <= this.now()) {
        const latest = validCachedRelease(saved.latest) && saved.latest.versionCode > options.build ? saved.latest : null;
        this.state = {...this.state, checkedAt: saved.checkedAt, latest,
          status: latest ? 'available' : 'current',
          dismissedBuild: Number.isSafeInteger(saved.dismissedBuild) ? Number(saved.dismissedBuild) : null};
      }
    } catch { /* App updates must not prevent the box-office app from opening. */ }
  }
  private now = () => this.options.now?.() ?? Date.now();
  getSnapshot = () => this.state;
  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => {this.listeners.delete(listener);};
  };
  private publish(patch: Partial<UpdateState>) {
    this.state = {...this.state, ...patch};
    for (const listener of this.listeners) listener();
  }
  private save() {
    try {this.options.storage.setItem(CACHE_KEY, JSON.stringify({
      build: this.state.installedBuild, checkedAt: this.state.checkedAt,
      latest: this.state.latest, dismissedBuild: this.state.dismissedBuild,
    }));} catch {}
  }
  dismiss = () => {
    if (!this.state.latest) return;
    this.publish({dismissedBuild: this.state.latest.versionCode});
    this.save();
  };
  check = (force = false): Promise<UpdateState> => {
    if (this.inFlight) return this.inFlight;
    const now = this.now();
    const elapsed = this.state.checkedAt ? now - Date.parse(this.state.checkedAt) : Infinity;
    if (!force && ((elapsed >= 0 && elapsed < UPDATE_INTERVAL) ||
        (this.lastAttempt !== null && now - this.lastAttempt >= 0 && now - this.lastAttempt < RETRY_INTERVAL))) {
      return Promise.resolve(this.state);
    }
    this.lastAttempt = now;
    this.publish({status: 'checking', message: null});
    this.inFlight = Promise.resolve().then(async () => {
      try {
        if (this.options.online && !this.options.online()) throw new Error('You’re offline. Connect to the internet and try again.');
        const latest = selectUpdate(await this.options.fetchReleases(), this.state.installedBuild);
        this.publish({status: latest ? 'available' : 'current', latest, checkedAt: new Date(this.now()).toISOString(), message: null});
        this.save();
      } catch (error) {
        this.publish({status: 'error', message: error instanceof Error ? error.message : 'Could not check for updates. Please try again.'});
      } finally {this.inFlight = null;}
      return this.state;
    });
    return this.inFlight;
  };
}
