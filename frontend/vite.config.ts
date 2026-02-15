import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import * as path from "node:path";
import * as fs from 'node:fs'

const certFile = process.env.VITE_HTTPS_CERT || path.resolve(__dirname, '.cert/localhost.pem')
const keyFile = process.env.VITE_HTTPS_KEY || path.resolve(__dirname, '.cert/localhost-key.pem')
const useHttps = fs.existsSync(certFile) && fs.existsSync(keyFile)
const backendTarget = process.env.VITE_BACKEND_URL || 'http://localhost:8080'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve:{
    alias: {
      '@': path.resolve(__dirname, 'src'),
    }
  },
  server: {
    https: useHttps
      ? {
          cert: fs.readFileSync(certFile),
          key: fs.readFileSync(keyFile),
        }
      : undefined,
    host: '0.0.0.0',
    proxy: {
      '/api':{
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      },
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
        secure: false,
      }
    }
  }
});
