
/** Optional Android bridge; ordinary website requests keep their existing behavior. */
export type NativeBridge = {
  request: (path: string, init?: RequestInit) => Promise<Response>;
  shareCsv: (contents: string, filename: string) => Promise<void>;
};
declare global { interface Window { cinetrackerNative?: NativeBridge; } }
export function nativeBridge(): NativeBridge | undefined {
  return typeof window === 'undefined' ? undefined : window.cinetrackerNative;
}
export function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return nativeBridge()?.request(path, init) ?? fetch(path, init);
}
export async function saveCsv(contents: string, filename: string): Promise<string> {
  const native = nativeBridge();
  if (native) {
    await native.shareCsv(contents, filename);
    return 'Report ready to share';
  }
  const blob = new Blob([contents], {type: 'text/csv;charset=utf-8'});
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  return 'Collection report downloaded';
}
