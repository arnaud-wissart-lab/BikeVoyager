import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

const apiBaseUrl = process.env.VITE_API_BASE_URL ?? 'https://localhost:7144'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    strictPort: false,
    proxy: {
      '/api': {
        target: apiBaseUrl,
        changeOrigin: true,
        secure: false,
      },
    },
  },
  test: {
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    globals: true,
  },
})
