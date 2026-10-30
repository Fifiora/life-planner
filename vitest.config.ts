import { defineConfig } from 'vitest/config'

// Kept separate from vite.config.ts: Vitest 2 bundles its own Vite types, which clash with Vite 6 plugins.
export default defineConfig({
  test: {
    environment: 'jsdom',
    setupFiles: ['./tests/setup.ts'],
    globals: false,
  },
})
