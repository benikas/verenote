import { fileURLToPath } from 'node:url'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import { VitePWA } from 'vite-plugin-pwa'
import { defineConfig } from 'vitest/config'

const root = fileURLToPath(new URL('.', import.meta.url))

// base './' = relative Pfade, funktioniert auf GitHub Pages (Unterpfad) und Netlify
export default defineConfig({
  base: './',
  plugins: [
    svelte(),
    // PWA: installierbar, läuft offline. Die Samples (ca. 3,7 MB) werden mitgecacht.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
      manifest: {
        name: 'Gehörtraining',
        short_name: 'Gehörtraining',
        description: 'Das Gehör trainieren: Töne, Intervalle, Akkorde und mehr.',
        lang: 'de',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#fff8ee',
        theme_color: '#fff8ee',
        start_url: './',
        scope: './',
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,webmanifest}'],
        navigateFallback: 'index.html',
      },
    }),
  ],
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
