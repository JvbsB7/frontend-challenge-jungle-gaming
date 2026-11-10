# Auditoria Lighthouse

Gerado por `pnpm lighthouse` em 2026-11-10T21:52:08.114Z. Mediana de 3 medições por página e perfil (valores individuais entre parênteses). **Negrito** = abaixo da meta.

| Perfil | Página | Performance (≥90) | Accessibility (≥95) | Best Practices (≥95) | SEO (≥90) | LCP | CLS | TBT | FCP |
|---|---|---|---|---|---|---|---|---|---|
| mobile | `/` | **77** (58, 77, 77) | 100 (100, 100, 100) | 100 (100, 100, 100) | 100 (100, 100, 100) | 3.79 s | 0.029 | 329 ms | 2.80 s |
| mobile | `/nft/nft-001` | **83** (83, 85, 81) | 100 (100, 100, 100) | 100 (100, 100, 100) | 100 (100, 100, 100) | 3.76 s | 0.000 | 238 ms | 0.67 s |
| desktop | `/` | 97 (98, 97, 95) | 100 (100, 100, 100) | 100 (100, 100, 100) | 100 (100, 100, 100) | 1.23 s | 0.005 | 7 ms | 0.23 s |
| desktop | `/nft/nft-001` | 95 (95, 95, 95) | 100 (100, 100, 100) | 100 (100, 100, 100) | 100 (100, 100, 100) | 1.27 s | 0.094 | 0 ms | 0.22 s |

Relatórios (execução mediana): `mobile-inicio`, `mobile-detalhe`, `desktop-inicio` e `desktop-detalhe`, cada um em `.html` e `.json` nesta pasta.

## Ambiente e condições

- Lighthouse 13.6.0 via @lhci/cli; Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/157.0.0.0 Safari/537.36
- Máquina: 13th Gen Intel(R) Core(TM) i5-1334U, 12 CPUs, 16 GB RAM, Linux 7.0.0-43-generic; BenchmarkIndex 2105
- Node v22.22.1
- Build de produção (`pnpm build`) servido por `vite preview` em localhost; mocks (MSW) ativos no cenário padrão (latência fixa de 150 ms por chamada).
- Mobile: perfil padrão do Lighthouse (emulação Moto G Power, 4G lento simulado ~1,6 Mbps / 150 ms RTT, CPU 4×). Desktop: preset `desktop` (sem throttling de CPU, 10 Mbps / 40 ms).
- Cada medição começa com armazenamento limpo (o service worker do MSW é registrado de novo a cada execução).

## Análise: performance mobile abaixo de 90

Desktop, Accessibility, Best Practices e SEO atingem as metas em todas as páginas. A performance no **mobile** fica abaixo de 90 por causa do LCP (~3,8 s; o TBT varia entre ~250 e ~400 ms entre rodadas). As causas, medidas nos relatórios:

1. **O backend simulado faz parte da entrega e está no caminho crítico.** O MSW (core, interceptors, binding Socket.IO e cookie store) soma ~140 KB gzip e precisa estar ativo, com o service worker registrado, antes da primeira requisição. Sem isso, a página não tem dados. O caminho crítico fica com ~360 KB gzip de JS. No 4G lento simulado (~1,6 Mbps) isso custa ~2 s só de download, antes de qualquer execução.
2. **O elemento de LCP depende de dados da API.** No mobile é a imagem do primeiro card do catálogo (Início) ou a arte principal (Detalhe), e a URL dela só é conhecida depois de JS → MSW ativo → resposta da API (latência simulada de 150 ms). Por isso o `resourceLoadDelay` do LCP domina a quebra do tempo.
3. **SPA sem renderização no servidor.** Nada útil é pintado antes do JavaScript executar.

O enunciado proíbe simplificações exclusivas para a auditoria, então ela roda com imagens, fontes, mocks e tempo real reais da entrega. Otimizações aplicadas: `socket.io-client` carregado sob demanda; log do MSW desligado em produção (gastava ~1 s de CPU no mobile); máscara decorativa do hero inline (era o LCP); skeleton do Detalhe com as dimensões do layout real (CLS de 0,305 → 0,094 no desktop); imagens WebP em 500/1000 px com `srcset`, `width`/`height` e `fetchpriority` no primeiro card; meta description e `robots.txt` (SEO 83 → 100); `aria-valuetext` nas alças do slider (Accessibility 96 → 100). Também testamos carregar app e MSW em paralelo e via `modulepreload`: a mediana não mudou (a banda simulada é o gargalo), e mantivemos a ordem sequencial, que é a mais simples.

Num produto com backend real, o MSW sai do bundle (−140 KB gzip e sem registro de service worker), e o LCP do mobile cai para perto do medido no desktop. Pré-renderizar a Início (SSR/SSG) e servir as imagens por CDN tirariam o resto da cadeia.
