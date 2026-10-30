
import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import {fileURLToPath} from 'node:url';
const dependency = (name: string) => fileURLToPath(new URL('./node_modules/' + name, import.meta.url));
export default defineConfig({
  plugins: [react()],
  publicDir: '../public',
  // Shared website components resolve to this small Android package's dependencies.
  resolve: {alias: {
    'react-dom': dependency('react-dom'),
    'react': dependency('react'),
    'lucide-react': dependency('lucide-react'),
  }},
  css: {postcss: {plugins: []}},
  build: {target: 'es2022', outDir: 'dist', emptyOutDir: true, sourcemap: false},
});
