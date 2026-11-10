import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

export default defineConfig({
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // O dev server do Vite fica lento com vários navegadores em paralelo.
  expect: { timeout: 10_000 },
  webServer: {
    command: `pnpm dev --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
  },
  projects: [
    // Lógica pura (sem navegador).
    { name: 'unit', testMatch: 'src/**/*.test.ts' },
    // Contratos REST + Socket.IO contra o MSW, no navegador.
    { name: 'api', testDir: 'tests/api', use: { ...devices['Desktop Chrome'] } },
    // Fluxos de UI em Chromium, desktop (1440) e mobile (390).
    { name: 'desktop', testDir: 'tests/e2e', use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } } },
    { name: 'mobile', testDir: 'tests/e2e', use: { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } } },
  ],
})
