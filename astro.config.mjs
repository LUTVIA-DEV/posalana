// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },

  // Corre como servidor de Node en el VPS (Coolify), desde el Dockerfile
  adapter: node({ mode: 'standalone' }),
  security: {
    checkOrigin: false
  }
});