
export type AndroidRelease = {
  version: string;
  versionCode: number;
  downloadUrl: string;
  releaseUrl: string;
  publishedAt: string;
};
export type UpdateState = {
  status: 'idle' | 'checking' | 'current' | 'available' | 'error';
  installedVersion: string;
  installedBuild: number;
  latest: AndroidRelease | null;
  checkedAt: string | null;
  dismissedBuild: number | null;
  message: string | null;
};
export type AppUpdater = {
  getSnapshot: () => UpdateState;
  subscribe: (listener: () => void) => () => void;
  check: (force?: boolean) => Promise<UpdateState>;
  dismiss: () => void;
};
