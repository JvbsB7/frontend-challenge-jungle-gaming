# KURIO — Marketplace de NFTs

Solução do **Desafio Frontend — Marketplace de NFTs (Jungle Gaming)**: descoberta, compra e conta do colecionador, em desktop e mobile, com API REST e tempo real (Socket.IO) simulados por MSW.

- **Demo publicada:** https://frontend-challenge-jungle-gaming-eight.vercel.app/
- **Arquitetura, contratos e decisões:** [`ARCHITECTURE.md`](ARCHITECTURE.md)
- **Auditoria Lighthouse:** [`docs/lighthouse/RESULTS.md`](docs/lighthouse/RESULTS.md)

## Stack

React 19 · TypeScript · TanStack Router · TanStack Query · Axios · Socket.IO (client) · Tailwind CSS v4 · shadcn/ui (Radix) · MSW 3 (+ `@mswjs/socket.io-binding`) · Playwright · Lighthouse CI · Vite 8 · pnpm.

## Setup

Requisitos: **Node ≥ 22** e **pnpm** (testado com pnpm 10 e 12).

```bash
pnpm install
pnpm dev            # http://localhost:5173 (mocks ligados)
```

Não precisa de backend nem de `.env`. Com os padrões abaixo, a app já roda com a API simulada.

### Variáveis de ambiente (opcionais)

| Variável | Padrão | Descrição |
|---|---|---|
| `VITE_ENABLE_MOCKS` | ligado (qualquer valor ≠ `false`) | Liga o backend simulado (MSW) em dev **e no build de demonstração**. Use `false` para desligar. |
| `VITE_SOCKET_URL` | `wss://realtime.kurio.mock` | Host do Socket.IO. O padrão é fictício e interceptado pelo MSW. |

Para mudar, crie um `.env` (ele não é versionado), por exemplo `VITE_ENABLE_MOCKS=false`.

## Comandos

| Comando | O que faz |
|---|---|
| `pnpm dev` | Desenvolvimento com mocks |
| `pnpm build` | Build de produção (`vite build` + `tsc -b`) em `dist/` |
| `pnpm preview` | Serve o build em http://localhost:4173 |
| `pnpm typecheck` | Verificação de tipos |
| `pnpm lint` | oxlint |
| `pnpm test` | Toda a suíte Playwright (unit, contratos, E2E desktop/mobile, regressão visual) |
| `pnpm test:unit` | Lógica pura (aritmética de ETH), sem navegador |
| `pnpm test:api` | Contratos REST + Socket.IO contra o MSW, no Chromium |
| `pnpm test:e2e` | Fluxos de UI em Chromium, desktop (1440) e mobile (390) |
| `pnpm test:visual` | Regressão visual (Início, Detalhe, Carrinho, Pagamento) |
| `pnpm test:visual:update` | Regenera as baselines visuais (revise os PNGs antes de commitar) |
| `pnpm lighthouse` | Build + Lighthouse mobile/desktop, 3 medições por página, relatórios em `docs/lighthouse/` |

Primeira execução dos testes: `pnpm exec playwright install chromium`. O relatório HTML fica em `playwright-report/`, e os traces das falhas em `test-results/` (`pnpm exec playwright show-report`).

Os testes sobem o `pnpm dev` automaticamente. Os cenários sensíveis a tempo usam o relógio controlado do Playwright (`page.clock`): expiração de sessão (avança 30 min) e pedido pendente durante queda e refresh (`slow-settlement` + avanço do relógio). Para rodá-los contra outra URL (por exemplo, o deploy), use `BASE_URL=https://... pnpm test:e2e`. Os testes que preparam dados importando módulos de `/src` só funcionam contra o servidor de desenvolvimento.

As baselines visuais foram geradas em **Linux/Chromium**. Em outro sistema a fonte renderiza um pouco diferente: rode a regressão visual em Linux (ou na imagem Docker oficial do Playwright).

O Lighthouse usa o Chrome instalado. Se ele não for encontrado, informe o caminho: `CHROME_PATH=/usr/bin/google-chrome pnpm lighthouse`.

## Credenciais fictícias

Senha das duas contas: **`Kurio@123`**.

| E-mail | Perfil |
|---|---|
| `ana@kurio.test` | Carteira principal cadastrada (MetaMask, Ethereum) e 2 favoritos. **Use esta para testar a compra.** |
| `bruno@kurio.test` | Sem carteiras: bom para testar o cadastro de carteiras antes de pagar. |

Também é possível criar contas pelo Cadastro. As senhas ficam no banco simulado como hash SHA-256 com salt, nunca em texto puro.

Cupons: `KURIO10` (10%), `GENESIS25` (25%) e `VERAO2025` (expirado). Qualquer outro código é inválido.

## Cenários simulados e reset

O backend simulado guarda o estado no `localStorage` (catálogo, contas, sessões, favoritos, carrinhos, carteiras e pedidos), então tudo sobrevive a refresh.

- **Reset completo:** abra qualquer página com `?mockReset=1` (por exemplo `/?mockReset=1`). Restaura as fixtures.
- **Escolher cenário:** `?scenario=nome` ou vários com vírgula (`?scenario=slow,payment-declined`). O cenário fica salvo até `?scenario=default`.
- Os dois parâmetros são removidos da URL depois de aplicados.

| Cenário | Efeito |
|---|---|
| `default` | Latência fixa de 150 ms, tudo funcionando |
| `slow` | Latência de 2,5 s (skeletons) |
| `jitter` | Latência variável 100–1800 ms com semente fixa (respostas fora de ordem) |
| `empty-catalog` | Catálogo vazio |
| `offline` | Falha de conexão em toda a API |
| `catalog-error` | `GET /api/nfts` responde 500 |
| `flaky` | A primeira chamada de cada rota responde 503 e a seguinte funciona |
| `favorite-fail` | Incluir/remover favorito responde 500 (rollback do update otimista) |
| `price-change-on-order` | O preço sobe ao criar o pedido → 409 `QUOTE_OUTDATED` |
| `sold-out-on-order` | A edição esgota ao criar o pedido → 409 `OUT_OF_STOCK` |
| `order-timeout` | O pedido é criado, mas a resposta chega depois do timeout do cliente (10 s) |
| `payment-declined` | O pagamento é recusado na liquidação |
| `wallet-refused` | A carteira recusa a conexão |
| `short-session` | Sessões expiram em 30 s |
| `slow-settlement` | O pagamento liquida em 60 s (usado com relógio controlado nos testes) |

### Controles no console (`window.__kurio`)

Disponíveis em dev e no build de demonstração. São os mesmos usados pelos testes:

```js
__kurio.updateEdition('nft-001', 'e50', { price: '1.42' })   // muda preço no "servidor": REST + evento nft.updated
__kurio.updateEdition('nft-001', 'e50', { available: 0 })    // esgota a edição
__kurio.replayEvent(0)        // reenvia o último evento (duplicata); replayEvent(1) = evento antigo
__kurio.dropConnections()     // derruba o Socket.IO (o cliente reconecta e reconcilia via REST)
__kurio.expireSessions()      // expira todas as sessões (a próxima chamada recebe 401 SESSION_EXPIRED)
__kurio.setScenario('slow,flaky'); __kurio.reset()
```

## Reproduzindo os fluxos de falha

Entre com `ana@kurio.test` / `Kurio@123`, adicione NFTs ao carrinho e siga:

| Fluxo | Como reproduzir |
|---|---|
| Skeletons e carregamento lento | `/?scenario=slow` |
| Erro e nova tentativa | `/?scenario=catalog-error`, depois `__kurio.setScenario('default')` e "Tentar novamente" |
| Respostas fora de ordem | `/?scenario=jitter` e troque de aba/filtro rapidamente: vale sempre o último filtro |
| Falha de favorito com rollback | `?scenario=favorite-fail` e clique em Favoritar |
| Cupom inválido/expirado | No carrinho, aplique `NAOEXISTE` ou `VERAO2025` |
| Preço muda com o carrinho aberto | No `/carrinho`: `__kurio.updateEdition('nft-001','e50',{price:'1.50'})` |
| Preço muda durante a revisão | Em Pagamento, abra a revisão e rode o comando acima: o pagamento exige "Confirmar novos valores" |
| Cotação desatualizada no servidor | `?scenario=price-change-on-order` e confirme o pagamento |
| Edição esgota na compra | `?scenario=sold-out-on-order` e confirme o pagamento |
| Timeout com idempotência | `?scenario=order-timeout`: confirme, espere o aviso e clique "Tentar novamente". É o mesmo pedido, sem duplicata |
| Pagamento recusado | `?scenario=payment-declined`: os itens continuam no carrinho |
| Queda com pedido pendente | Confirme a compra e, na tela "Aguardando confirmação", rode `__kurio.dropConnections()` e recarregue a página |
| Carteira recusa conexão | `?scenario=wallet-refused` e confirme a compra |
| Sessão expirada | Em Perfil/Pagamento: `__kurio.expireSessions()` e faça qualquer ação. Volta ao login e depois retorna à mesma página |

## Deploy

Vercel (`vercel.json`): `pnpm install --frozen-lockfile`, `pnpm build` e saída `dist/`. Toda rota sem extensão cai no `index.html`, então acesso direto e refresh funcionam em qualquer tela. O `index.html` e o `mockServiceWorker.js` não são cacheados; os assets com hash têm cache imutável. Os mocks e o tempo real funcionam no ambiente publicado, sem variáveis de ambiente.
