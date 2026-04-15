import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

import { vitePluginBooks } from './vite-plugin-books'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), vitePluginBooks(path.resolve(__dirname, 'books'))],
  optimizeDeps: {
    include: ['howler'],
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
})
