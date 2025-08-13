import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: './src/setupTests.ts',
    globals: true,
    css: true,
    reporters: ['default'],
    coverage: {
      reporter: ['text', 'html'],
      reportsDirectory: './coverage',
      exclude: ['vite.config.*', 'src/main.tsx', 'src/**/*.d.ts']
    }
  }
})
