import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return undefined
          }

          if (id.includes('node_modules/maplibre-gl')) {
            return 'maplibre-gl'
          }

          if (id.includes('node_modules/@maptiler/sdk')) {
            return 'maptiler-sdk'
          }

          if (id.includes('node_modules/react-router') || id.includes('node_modules/react-dom')) {
            return 'react-vendor'
          }

          if (id.includes('node_modules/react')) {
            return 'react-core'
          }

          return undefined
        },
      },
    },
  },
})
