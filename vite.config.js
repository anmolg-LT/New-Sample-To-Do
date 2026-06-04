import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { copyFileSync } from 'node:fs'

// GitHub Pages serves 404.html for any path it can't find on disk (e.g.
// /New-Sample-To-Do/Forms). Shipping a copy of the built index.html as
// 404.html lets the SPA boot for deep links and hard refreshes — the
// History-API router in App.jsx then resolves the path client-side.
const spaFallback = () => ({
  name: 'spa-404-fallback',
  closeBundle() {
    copyFileSync('dist/index.html', 'dist/404.html')
  },
})

export default defineConfig({
  plugins: [react(), spaFallback()],
  base: '/New-Sample-To-Do/',
})
