import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const mobile = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }

export default defineConfig({
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // O dev server do Vite fica lento com vários navegadores em paralelo.
  expect: {
    timeout: 10_000,
    // Regressão visual: tolera só antialiasing de fonte.
    toHaveScreenshot: { maxDiffPixels: 50, animations: 'disabled', caret: 'hide' },
  },
  // Uma nova tentativa no CI para lentidão pontual do dev server (falhas reais repetem).
  retries: process.env.CI ? 1 : 0,
  // Baselines versionadas, separadas por projeto (desktop/mobile) e sem sufixo de SO.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
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
    { name: 'desktop', testDir: 'tests/e2e', use: desktop },
    { name: 'mobile', testDir: 'tests/e2e', use: mobile },
    // Regressão visual das telas principais.
    { name: 'visual-desktop', testDir: 'tests/visual', use: desktop },
    { name: 'visual-mobile', testDir: 'tests/visual', use: mobile },
  ],
})
