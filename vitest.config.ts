import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'node', // we are testing DB queries directly
    setupFiles: ['./src/tests/setup.ts'],
    testTimeout: 10000,
  },
})
