import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

// base './' = relative Pfade, funktioniert auf GitHub Pages (Unterpfad) und Netlify
export default defineConfig({
  base: './',
  plugins: [svelte()],
  // tonal/@tonaljs: "main" zeigt auf eine fehlende Datei (dist/index.js), die ESM-Datei
  // dist/index.mjs ist vorhanden. Deshalb für Build und Tests direkt dorthin auflösen.
  resolve: {
    alias: [
      {
        find: /^(tonal|@tonaljs\/[\w-]+)$/,
        replacement: `${root}node_modules/$1/dist/index.mjs`,
      },
    ],
  },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
    server: { deps: { inline: [/tonal/] } },
  },
})
