import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

const repoBase = '/alquileres-lite/'
const isProd = process.env.NODE_ENV === 'production'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'prompt',
      manifest: false,
      includeAssets: [
        'favicon.ico',
        'favicon.svg',
        'vite.svg',
        'icons/pwa-icon-180.png',
        'icons/pwa-icon-192.png',
        'icons/pwa-icon-512.png',
      ],
      devOptions: {
        enabled: process.env.SW_DEV === 'true',
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    }),
  ],
  base: isProd ? repoBase : '/',
})
