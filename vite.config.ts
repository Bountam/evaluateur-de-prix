import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';

export default defineConfig(() => {
  return {
    plugins: [react(), tailwindcss()],
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      hmr: process.env.DISABLE_HMR !== 'true',
      proxy: {
        '/api': {
          target: 'http://127.0.0.1:3000',
          changeOrigin: true,
        },
      },
      watch: process.env.DISABLE_HMR === 'true' ? null : {
        ignored: [
          '**/*.tmp*',
          '**/*.tmp',
          '**/db.json*',
          '**/db.json',
          '**/scraper-cache/**',
          '**/scraper-cache/*',
          '**/scraper-cache',
          '**/scraper-cache*',
          '**/scraper-cache.json',
          '**/dist/**',
          '**/data/**',
          '**/scratch/**',
          '**/*.log',
          '**/*.xlsx',
        ],
      },
    },

  };
});
