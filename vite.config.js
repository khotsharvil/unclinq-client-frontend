import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // Allow Cloudflare quick-tunnel hostnames for mobile testing over HTTPS
    allowedHosts: ['.trycloudflare.com'],
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        // Strip the Origin header so the backend (which only allows localhost/Railway)
        // accepts requests proxied in from the Cloudflare tunnel during mobile testing.
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => proxyReq.removeHeader('origin'))
        }
      }
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    // Relative asset paths so Capacitor's file:// / capacitor:// protocol can load them
    assetsDir: 'assets',
  },
  // Required for Capacitor: all asset URLs must be relative, not absolute
  base: './'
})
