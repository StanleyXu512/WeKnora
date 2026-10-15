import { mergeConfig, defineConfig } from 'vite'
import base from './vite.config'

// A focused development entry uses the real CHINT page and real backend, without loading unrelated document preview dependencies.
export default mergeConfig(base, defineConfig({
  optimizeDeps: { entries: ['chint-dev.html'] },
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
}))
