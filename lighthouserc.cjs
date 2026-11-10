// Auditoria Lighthouse (LHCI). Perfil via LH_PRESET=mobile|desktop (padrão: mobile).
// Rodar tudo: pnpm lighthouse  (build + mobile + desktop + resumo em docs/lighthouse/RESULTS.md)
const desktop = process.env.LH_PRESET === 'desktop'
const metas = { performance: 0.9, accessibility: 0.95, 'best-practices': 0.95, seo: 0.9 }

module.exports = {
  ci: {
    collect: {
      // Build otimizado servido localmente, com o cenário padrão dos mocks (MSW ativo).
      startServerCommand: 'pnpm preview --port 4173 --strictPort',
      startServerReadyPattern: 'Local',
      url: ['http://localhost:4173/', 'http://localhost:4173/nft/nft-001'],
      numberOfRuns: 3,
      settings: {
        ...(desktop ? { preset: 'desktop' } : {}),
        chromeFlags: '--headless=new --no-sandbox',
      },
    },
    assert: {
      // Avisa (sem quebrar) quando a mediana fica abaixo da meta do desafio.
      assertions: Object.fromEntries(
        Object.entries(metas).map(([cat, min]) => [`categories:${cat}`, ['warn', { minScore: min, aggregationMethod: 'median' }]]),
      ),
    },
    upload: {
      target: 'filesystem',
      outputDir: `.lighthouseci/report-${desktop ? 'desktop' : 'mobile'}`,
      reportFilenamePattern: '%%PATHNAME%%-%%DATETIME%%-report.%%EXTENSION%%',
    },
  },
}
