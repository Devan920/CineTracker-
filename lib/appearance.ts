export type ThemeMode = 'light' | 'dark' | 'system';
export const THEME_KEY = 'cinepulse-appearance';
export const THEME_COLORS = { light: '#f8f9f6', dark: '#0f1713' };
export function validTheme(value: unknown): ThemeMode {
  return value === 'light' || value === 'dark' ? value : 'system';
}
export function resolveTheme(mode: ThemeMode, systemDark: boolean): 'light' | 'dark' {
  return mode === 'system' ? systemDark ? 'dark' : 'light' : mode;
}
// Runs before the first paint. User data is never interpolated into this script.
export const themeBootstrap = `(()=>{let mode='system';try{const saved=localStorage.getItem('${THEME_KEY}');if(saved==='light'||saved==='dark')mode=saved}catch{}const dark=mode==='dark'||(mode==='system'&&matchMedia('(prefers-color-scheme: dark)').matches);const theme=dark?'dark':'light';document.documentElement.dataset.theme=theme;document.documentElement.style.colorScheme=theme;document.querySelectorAll('meta[name="theme-color"]').forEach(el=>el.setAttribute('content',dark?'${THEME_COLORS.dark}':'${THEME_COLORS.light}'));})();`;
