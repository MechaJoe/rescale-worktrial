import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// The app always calls the API at the relative path `/api`, so it is same-origin
// in every environment: the dev server proxies it here, and nginx proxies it in
// the container image. That keeps CORS out of the picture entirely and avoids
// baking an absolute backend URL into the build, which Vite would otherwise fix
// at build time rather than at deploy time.
const apiTarget = process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:8000'

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // listen on 0.0.0.0 so the dev server is reachable from a container
    port: 5173,
    proxy: {
      '/api': { target: apiTarget, changeOrigin: true },
    },
  },
})
