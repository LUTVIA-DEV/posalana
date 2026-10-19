// @ts-check
import { defineConfig } from 'astro/config';

import tailwindcss from '@tailwindcss/vite';
import vercel from '@astrojs/vercel';
import node from '@astrojs/node';

// https://astro.build/config
export default defineConfig({
  output: 'server',
  vite: {
    plugins: [tailwindcss()]
  },

  // En el VPS (Coolify) corre como servidor de Node; en Vercel, con su adaptador,
  // hasta que se apague (Vercel define VERCEL=1 al construir).
  adapter: process.env.VERCEL ? vercel() : node({ mode: 'standalone' }),
  security: {
    checkOrigin: false
  }
});