import tailwindcss from '@tailwindcss/vite'
import { tanstackRouter } from '@tanstack/router-plugin/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import { msw } from 'msw/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [tanstackRouter({ target: 'react', autoCodeSplitting: true }), react(), tailwindcss(), msw()],
  // msw/browser é importado pelo módulo virtual do plugin do MSW, que a varredura do Vite não
  // enxerga: sem isso, o primeiro `pnpm dev` (clone novo) reotimiza e recarrega a página no meio.
  optimizeDeps: { include: ['msw/browser'] },
  // Relatórios do Playwright/Lighthouse são gravados no projeto: não devem recarregar a app.
  server: { watch: { ignored: ['**/playwright-report/**', '**/test-results/**', '**/.lighthouseci/**', '**/docs/lighthouse/**'] } },
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
})
