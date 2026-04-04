import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    port: 5173,
    proxy: {
      '/proxy/nowcoast': {
        target: 'https://nowcoast.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/nowcoast/, ''),
      },
    },
  },
})
