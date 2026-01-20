import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [tailwindcss(), react()],
  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      '/login': 'http://127.0.0.1:8787',
      '/logout': 'http://127.0.0.1:8787',
      '/schedule': 'http://127.0.0.1:8787',
      '/tasks': 'http://127.0.0.1:8787',
    },
  },
});
