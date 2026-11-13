export type ThemeMode = 'light' | 'dark';
export const THEME_KEY = 'cinepulse-appearance-v2';
export const THEME_COLORS = { light: '#f8f9f6', dark: '#080d11' };
export function validTheme(value: unknown): ThemeMode {
  return value === 'light' ? 'light' : 'dark';
}
export function resolveTheme(mode: ThemeMode, _systemDark?: boolean): ThemeMode {
  return mode;
}
// Runs before the first paint. User data is never interpolated into this script.
export const themeBootstrap = `(()=>{let theme='dark';try{const saved=localStorage.getItem('${THEME_KEY}');if(saved==='light')theme='light'}catch{}document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelectorAll('meta[name="theme-color"]').forEach(el=>el.setAttribute('content',theme==='dark'?'${THEME_COLORS.dark}':'${THEME_COLORS.light}'));})();`;
