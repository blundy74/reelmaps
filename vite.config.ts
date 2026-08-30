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
      '/proxy/erddap': {
        target: 'https://coastwatch.pfeg.noaa.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/erddap/, '/erddap'),
      },
      '/proxy/realearth': {
        target: 'https://realearth.ssec.wisc.edu',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/proxy\/realearth/, ''),
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('referer')
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('cookie')
          })
        },
      },
    },
  },
})
