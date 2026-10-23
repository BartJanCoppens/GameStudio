/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Unit tests live next to the code; e2e/ is Playwright's.
  test: { include: ['src/**/*.test.ts'] },
})
