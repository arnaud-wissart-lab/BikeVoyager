import { configDefaults, defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import cesium from 'vite-plugin-cesium'
import { VitePWA } from 'vite-plugin-pwa'

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'http://localhost:5024'
const frontendPort = Number(process.env.VITE_DEV_PORT ?? 5173)
const strictPort = (process.env.VITE_STRICT_PORT ?? 'true') === 'true'

export default defineConfig({
  plugins: [
    react(),
    cesium(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: false,
      includeAssets: ['pwa-192.png', 'pwa-512.png'],
      manifest: {
        name: 'BikeVoyager',
        short_name: 'BikeVoyager',
        description: 'Planification de parcours marche, velo et VAE.',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        background_color: '#f8f9fa',
        theme_color: '#2b8a3e',
        icons: [
          {
            src: '/pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: '/pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        cleanupOutdatedCaches: true,
        navigateFallback: '/index.html',
        globIgnores: ['**/cesium/Cesium.js'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/tile\.openstreetmap\.org\/.*$/i,
            handler: 'NetworkOnly',
          },
        ],
      },
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    port: frontendPort,
    strictPort,
    proxy: {
      '/api': {
        target: apiBaseUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('node_modules/cesium')) {
            return 'vendor-cesium'
          }

          if (id.includes('node_modules/@mantine') || id.includes('node_modules/@tabler')) {
            return 'vendor-ui'
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/scheduler')) {
            return 'vendor-react'
          }

          return undefined
        },
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
    exclude: [...configDefaults.exclude, 'e2e/**'],
  },
})
