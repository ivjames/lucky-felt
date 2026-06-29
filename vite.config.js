import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Dev-only: proxy API calls to the local backend so the browser hits a single
  // origin (matches the nginx `/api/ -> :3001` proxy in production).
  server: {
    proxy: {
      "/api": "http://localhost:3001",
    },
  },
})
