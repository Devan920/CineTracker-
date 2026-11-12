
import {
  REFRESH_MS, SOURCE, CATALOG_URL, parseLive, parseCatalog, discoverDaily,
  parseDetail, robotsRules, type Movie, type Report,
} from '../../lib/boxoffice.ts';

export type PageFetcher = (url: string) => Promise<string>;
export type StorageAdapter = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
type Job = {
  startedAt: string; queue: string[]; movies: Movie[]; errors: string[];
  robots: string; details: Record<string, string>; completed: number; total: number;
  lastRequestAt: number; dataPages: number;
};
type Snapshot = {version: 1; report: Report | null; job: Job | null};
const KEY = 'cinetracker-native-collections-v1';
const emptyReport = (): Report => ({
  movies: [], checkedAt: null, lastAttemptAt: null, nextCheckAt: null,
  errors: [], sourceStatus: 'initial', initial: true,
});
export class Collector {
  private snapshot: Snapshot = {version: 1, report: null, job: null};
  private busy = false;
  private storage: StorageAdapter;
  private fetchPage: PageFetcher;
  private now: () => number;
  constructor(storage: StorageAdapter, fetchPage: PageFetcher, now: () => number = Date.now) {
    this.storage = storage; this.fetchPage = fetchPage; this.now = now;
    try {
      const raw = this.storage.getItem(KEY);
      if (raw) {
        const value = JSON.parse(raw);
        if (value.version === 1 && (value.report === null || (Array.isArray(value.report?.movies) && Array.isArray(value.report?.errors)))) {
          this.snapshot = value;
          const job = this.snapshot.job;
          if (job && (!Array.isArray(job.queue) || !Array.isArray(job.movies) || this.now() - Date.parse(job.startedAt) > REFRESH_MS)) {
            this.snapshot.job = null;
          }
        }
      }
    } catch { /* A fresh installation or corrupt cache starts without invented reports. */ }
  }
  private persist() {
    try { this.storage.setItem(KEY, JSON.stringify(this.snapshot)); } catch { /* Keep the current report in memory if storage is full. */ }
  }
  getReport(): Report & {job?: {completed: number; total: number}} {
    const job = this.snapshot.job;
    return {...(this.snapshot.report ?? emptyReport()), refreshing: Boolean(job),
      ...(job ? {job: {completed: job.completed, total: job.total}} : {})};
  }
  async step(): Promise<{state: string; completed?: number; total?: number; retryAfter?: number}> {
    if (this.busy) return {state: 'busy', retryAfter: 1};
    this.busy = true;
    try {
      const stamp = this.now();
      const prior = this.snapshot.report;
      let job = this.snapshot.job;
      if (job && stamp - Date.parse(job.startedAt) > REFRESH_MS) job = null;
      if (!job) {
        if (prior?.lastAttemptAt && stamp - Date.parse(prior.lastAttemptAt) < REFRESH_MS) return {state: 'current'};
        job = {
          startedAt: new Date(stamp).toISOString(),
          queue: [SOURCE + '/robots.txt', SOURCE + '/live', SOURCE + '/', CATALOG_URL],
          movies: [], errors: [], robots: '', details: {}, completed: 0, total: 4,
          lastRequestAt: 0, dataPages: 0,
        };
        this.snapshot.job = job;
      }
      const url = job.queue[0];
      if (url) {
        const parsed = new URL(url);
        if (parsed.origin !== SOURCE) throw new Error('Unexpected source address.');
        const delay = robotsRules(job.robots, parsed.pathname + parsed.search).delay * 1000;
        if (stamp - job.lastRequestAt < delay) {
          return {state: 'running', completed: job.completed, total: job.total, retryAfter: Math.ceil((delay - stamp + job.lastRequestAt) / 1000)};
        }
        job.lastRequestAt = stamp;
        let robotsFailed = false;
        try {
          if (parsed.pathname !== '/robots.txt' && !robotsRules(job.robots, parsed.pathname + parsed.search).allowed) {
            throw new Error('Automated access is unavailable for this report.');
          }
          const html = await this.fetchPage(url);
          if (html.length > 3000000) throw new Error('Report exceeds the size limit.');
          const checked = new Date(this.now()).toISOString();
          if (parsed.pathname === '/robots.txt') {
            if (!/^User-agent:/im.test(html)) throw new Error('Source access rules could not be read.');
            job.robots = html;
          } else if (url === SOURCE + '/live') {
            job.movies = parseLive(html, checked);
            job.details = Object.fromEntries(discoverDaily(html));
          } else if (url === SOURCE + '/') {
            for (const [id, detail] of discoverDaily(html)) {
              const old = job.details[id];
              if (!old || Number(old.match(/Day_(\d+)/i)?.[1] ?? 0) < Number(detail.match(/Day_(\d+)/i)?.[1] ?? 0)) job.details[id] = detail;
            }
          } else if (url === CATALOG_URL) {
            const catalog = parseCatalog(html, checked);
            if (!catalog.length) throw new Error('Recent-release listing could not be read.');
            for (const movie of catalog) {
              const index = job.movies.findIndex(m => m.id === movie.id);
              if (index < 0) job.movies.push(movie);
              else {
                const live = job.movies[index];
                job.movies[index] = {...movie, languages: live.languages, poster: live.poster ?? movie.poster, releaseDate: live.releaseDate, coverage: 'active-report'};
              }
            }
          } else {
            const id = Object.keys(job.details).find(key => job.details[key] === url);
            const index = job.movies.findIndex(movie => movie.id === id);
            const movie = parseDetail(html, url, index >= 0 ? job.movies[index] : undefined, checked);
            if (index < 0) job.movies.push(movie); else job.movies[index] = movie;
          }
          if (parsed.pathname !== '/robots.txt') job.dataPages++;
        } catch (error) {
          const message = error instanceof Error ? error.message : 'Report unavailable.';
          job.errors.push(parsed.pathname + ': ' + message);
          robotsFailed = parsed.pathname === '/robots.txt';
          const id = Object.keys(job.details).find(key => job.details[key] === url);
          const old = prior?.movies.find(movie => movie.id === id);
          if (old) {
            const index = job.movies.findIndex(movie => movie.id === id);
            const retained = {...old, fetchError: message};
            if (index < 0) job.movies.push(retained); else job.movies[index] = retained;
          } else if (id) {
            const index = job.movies.findIndex(movie => movie.id === id);
            if (index >= 0) job.movies[index] = {...job.movies[index], fetchError: message};
          }
        }
        job.queue.shift();
        job.completed++;
        if (robotsFailed) job.queue = [];
        else if (job.completed === 4) {
          job.queue = [...new Set(Object.values(job.details))].slice(0, 80);
          job.total = job.completed + job.queue.length;
          if (Object.keys(job.details).length > 80) job.errors.push('Coverage limit reached: 80 daily reports.');
        }
      }
      if (job.queue.length) {
        this.persist();
        return {state: 'running', completed: job.completed, total: job.total, retryAfter: 1};
      }
      for (let i = 0; i < job.movies.length; i++) {
        const current = job.movies[i];
        const old = prior?.movies.find(movie => movie.id === current.id);
        if (old && current.indiaNet === null && !current.daily.length && (old.indiaNet !== null || old.daily.length)) {
          job.movies[i] = {...old, lastSeenAt: current.lastSeenAt, warnings: [...new Set([...old.warnings, 'No newer daily report available. Showing the last available figures.'])]};
        }
      }
      if (job.errors.some(message => message.startsWith('/live:') || message.startsWith('/:') || message.startsWith('/entertainmenttopbar/'))) {
        for (const movie of prior?.movies ?? []) if (!job.movies.some(current => current.id === movie.id)) {
          job.movies.push({...movie, fetchError: 'Discovery was incomplete; retaining the last known report.'});
        }
      }
      const good = job.movies.length > 0 && job.dataPages > 0;
      const completedAt = this.now();
      this.snapshot.report = {
        movies: good ? job.movies : prior?.movies ?? [],
        checkedAt: good ? new Date(completedAt).toISOString() : prior?.checkedAt ?? null,
        lastAttemptAt: new Date(completedAt).toISOString(),
        nextCheckAt: new Date(completedAt + REFRESH_MS).toISOString(),
        errors: job.errors,
        sourceStatus: !good ? 'error' : job.errors.length ? 'partial' : 'ok',
      };
      this.snapshot.job = null;
      this.persist();
      return {state: 'complete'};
    } finally { this.busy = false; }
  }
}
