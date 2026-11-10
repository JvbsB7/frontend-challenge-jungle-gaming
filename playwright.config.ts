import { defineConfig, devices } from '@playwright/test'

const PORT = 5173

export default defineConfig({
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
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
  ],
})
