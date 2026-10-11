import { svelte } from '@sveltejs/vite-plugin-svelte'
import { defineConfig } from 'vitest/config'

// base './' = relative Pfade, funktioniert auf GitHub Pages (Unterpfad) und Netlify
export default defineConfig({
  base: './',
  plugins: [svelte()],
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
