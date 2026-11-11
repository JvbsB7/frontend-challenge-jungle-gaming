import { defineConfig, devices } from '@playwright/test'

const PORT = 5173
// BASE_URL=https://... roda os testes contra o deploy publicado (sem subir servidor local).
const BASE_URL = process.env.BASE_URL
const desktop = { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 900 } }
const mobile = { ...devices['Pixel 7'], viewport: { width: 390, height: 844 } }

export default defineConfig({
  reporter: [['html', { open: 'never' }], ['list']],
  use: { baseURL: BASE_URL ?? `http://localhost:${PORT}`, trace: 'retain-on-failure' },
  // O dev server do Vite fica lento com vários navegadores em paralelo.
  expect: {
    timeout: 10_000,
    // Regressão visual: tolera só antialiasing de fonte.
    toHaveScreenshot: { maxDiffPixels: 50, animations: 'disabled', caret: 'hide', timeout: 20_000 },
  },
  // Uma nova tentativa no CI para lentidão pontual do dev server (falhas reais repetem).
  retries: process.env.CI ? 1 : 0,
  // Até 4 navegadores em paralelo: com mais, o dev server do Vite (sobretudo a frio) sobrecarrega
  // a máquina e as esperas estouram. Ajustável com --workers.
  workers: process.env.CI ? 2 : 4,
  // Baselines versionadas, separadas por projeto (desktop/mobile) e sem sufixo de SO.
  snapshotPathTemplate: '{testDir}/__screenshots__/{projectName}/{arg}{ext}',
  webServer: BASE_URL
    ? undefined
    : {
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
    // reducedMotion: o carrossel do hero não troca sozinho durante a captura (baseline estável).
    { name: 'visual-desktop', testDir: 'tests/visual', use: { ...desktop, reducedMotion: 'reduce' } },
    { name: 'visual-mobile', testDir: 'tests/visual', use: { ...mobile, reducedMotion: 'reduce' } },
  ],
})
