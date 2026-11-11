# Arquitetura

Este documento descreve como a solução está organizada, os contratos REST e de eventos, as políticas de sessão, carrinho, cache e tempo real, e as limitações e desvios em relação ao Figma. Setup, comandos e cenários estão no [`README.md`](README.md).

## Visão geral

```
UI (React + shadcn/ui + Tailwind)
  │  rotas, search params, guards ── TanStack Router
  │  consultas, mutations, cache ─── TanStack Query
  ▼
src/api/  (contrato tipado único)
  ├─ contracts.ts   tipos REST + eventos (usados pela app E pelos mocks)
  ├─ client.ts      Axios: Bearer, X-Guest-Id, erro → ApiError
  ├─ endpoints.ts   uma função por operação (aceita AbortSignal)
  ├─ queries.ts     chaves de cache, queryOptions, política de retry/stale
  ├─ realtime.ts    socket.io-client → cache (dedupe/versão/reconciliação)
  └─ session-store  sessão persistida + eventos de login/logout/expiração
  ▼  HTTP / WebSocket (rede de verdade do navegador)
src/mocks/  (backend simulado, só na camada de rede)
  ├─ http.ts        handlers MSW REST (+ cenários de rede/falha)
  ├─ realtime.ts    servidor Socket.IO via @mswjs/socket.io-binding
  ├─ domain.ts      regras: sessão, catálogo, carrinho, cotação, pedidos
  ├─ db.ts          estado no localStorage (reset = fixtures)
  └─ scenario.ts    flags determinísticas (?scenario=)
```

Princípios:

- **Um contrato só.** `src/api/contracts.ts` é importado pela app e pelos mocks, então transporte, estado e UI compartilham os mesmos tipos.
- **Mocks só na rede.** Componentes, hooks e o cliente Axios não têm respostas fictícias nem caminhos alternativos: falam HTTP e WebSocket como falariam com um backend real. Desligar os mocks (`VITE_ENABLE_MOCKS=false`) não muda nenhum código da app.
- **ETH como string decimal.** Valores trafegam como `"1.19"` e as contas usam `src/lib/eth.ts` (BigInt em wei, 18 casas), sem `number`. Quantidades são inteiras. A cotação da API é a referência dos totais.

### Estrutura de pastas

| Pasta | Conteúdo |
|---|---|
| `src/routes/` | Rotas por arquivo (TanStack Router): `/`, `/nft/$id`, `/carrinho`, `/pagamento`, `/pedido/$id`, `/entrar`, `/cadastro`, `/perfil`, `/carteiras`, além do 404 |
| `src/components/` | UI por área (`catalog/`, `home/`, `cart/`, `checkout/`, `auth/`, `account/`) e `ui/` (shadcn adaptado ao Figma) |
| `src/lib/` | Hooks e utilitários: favoritos (otimista), carrinho, cupom, checkout (idempotência/rascunho), sessão, validação de formulários |
| `src/api/` | Camada de dados (acima) |
| `src/mocks/` | Backend simulado (acima) |
| `tests/` | `api/` (contratos), `e2e/` (fluxos), `visual/` (regressão), além de `src/**/*.test.ts` (unit) |

### Inicialização

`main.tsx` ativa os mocks (`enableMocks`: inicializa o banco, aplica `?mockReset`/`?scenario` e registra handlers REST + WebSocket) **antes** de chamar `startApp()`. Assim, nenhuma requisição escapa do MSW. O `socket.io-client` é importado sob demanda dentro de `connectRealtime`: o `engine.io-client` guarda o `WebSocket` global quando é carregado e precisa enxergar o `WebSocket` já interceptado pelo MSW.

## Rotas e estado na URL

- **Catálogo:** busca, categorias, redes, faixa de preço, aba, ordenação, página e favoritos ficam na URL (`validateSearch` → `parseCatalogSearch`). Valores inválidos são descartados. Mudar um filtro zera a página. A busca digitada usa `replace` (não empilha histórico a cada tecla). Refresh e voltar/avançar restauram o estado.
- **Detalhe:** a edição fica na URL (`?edicao=e10`), então o acesso direto abre na edição certa.
- **Rotas privadas** (`/pagamento`, `/perfil`, `/carteiras`, `/pedido/$id`, favoritos) usam `beforeLoad: requireAuth`, que redireciona para `/entrar?redirect=<origem>`. O `redirect` só aceita caminhos internos (evita open redirect). Fechar o login vindo de uma rota privada volta à página anterior, sem cair em ciclo.
- **Loaders** só fazem prefetch não bloqueante (`prefetchQuery`): a navegação é imediata e a tela mostra skeletons.
- Rotas inexistentes caem no 404 (`notFoundComponent`), e NFT ou pedido inexistentes têm tela própria.

## Contratos REST

Base `/api`. Autenticação por `Authorization: Bearer <token>`. O visitante é identificado por `X-Guest-Id` (UUID em `localStorage`), enviado sempre para permitir a fusão do carrinho no login.

### Erros

Todas as falhas usam o mesmo corpo:

```ts
interface ApiErrorBody { code: ApiErrorCode; message: string; fields?: Record<string, string>; details?: unknown }
```

| Status | `code` | Quando |
|---|---|---|
| 400 / 422 | `VALIDATION` | Parâmetros/corpo inválidos; `fields` traz o erro de cada campo |
| 401 | `INVALID_CREDENTIALS` | Login com e-mail/senha errados |
| 401 | `UNAUTHORIZED` | Sem sessão ou token desconhecido |
| 401 | `SESSION_EXPIRED` | Token vencido |
| 403 | `FORBIDDEN` | Ação negada (ex.: carteira recusou a conexão) |
| 404 | `NOT_FOUND` | Recurso inexistente; pedido de outro usuário também responde 404 (não revela existência) |
| 409 | `CONFLICT` | E-mail/usuário já cadastrado; secundária sem principal |
| 409 | `OUT_OF_STOCK` | Quantidade acima do disponível (`details.available` ou `details.quote`) |
| 409 | `QUOTE_OUTDATED` | Cotação mudou desde a revisão (`details.quote` traz a nova) |
| 409 | `IDEMPOTENCY_CONFLICT` | Mesma `Idempotency-Key` com conteúdo diferente |
| 422 | `COUPON_INVALID` / `COUPON_EXPIRED` | Cupom inexistente ou vencido |
| 500 / 503 | `TRANSIENT` | Falha temporária (cenários `catalog-error`, `flaky`, `favorite-fail`) |
| (rede) | — | Cenário `offline`: falha de conexão (`HttpResponse.error()`) |

No cliente, `ApiError` também representa `NETWORK`, `TIMEOUT` (10 s) e `CANCELED`. `error.transient` marca o que vale nova tentativa (rede, timeout e 5xx).

### Recursos

| Recurso | Método e rota | Corpo / parâmetros | Resposta |
|---|---|---|---|
| Sessão e conta | `POST /auth/register` | `{ username, email, password }` | 201 `Session` (funde o carrinho do visitante) |
| | `POST /auth/login` | `{ email, password }` | 200 `Session` (funde o carrinho do visitante) |
| | `GET /auth/session` | — | 200 `Session` |
| | `POST /auth/logout` | — | 204 |
| NFTs | `GET /nfts` | `q, category, network, minPrice, maxPrice, tab, sort, page, pageSize, favorites` (listas separadas por vírgula) | 200 `NftListResponse` (página + `facets` com contagens e faixa de preço) |
| | `GET /nfts/featured` | — | 200 `{ hero, spotlight }` |
| | `GET /nfts/:id` | — | 200 `Nft` (edições, estoque, `version`) |
| Favoritos | `GET /me/favorites` | — | 200 `{ nftIds }` |
| | `PUT` / `DELETE /me/favorites/:nftId` | — | 200 `{ nftIds }` |
| Carrinho | `GET /cart` | — | 200 `Cart` (itens com preço e estoque atuais, `subtotal`, `version`) |
| | `POST /cart/items` | `{ nftId, editionId, quantity }` | 200 `Cart` |
| | `PATCH /cart/items/:nftId/:editionId` | `{ quantity }` | 200 `Cart` |
| | `DELETE /cart/items/:nftId/:editionId` | — | 200 `Cart` |
| Cotação | `POST /quote` | `{ network, couponCode? }` | 200 `Quote` (`quoteId`, subtotal, desconto, taxa de rede, total, cupom, `issues` de estoque) |
| Pedidos | `POST /orders` | header `Idempotency-Key`; `{ quoteId, couponCode?, network, walletSlot, buyer }` | 201 `Order` criado, ou 200 o mesmo pedido (reenvio) |
| | `GET /orders?status=` | — | 200 `Order[]` do usuário |
| | `GET /orders/:id` | — | 200 `Order` (snapshot imutável) |
| Perfil | `GET` / `PATCH /me/profile` | `{ displayName, username, email, ensName, walletNickname }` | 200 `User` |
| | `PUT /me/avatar` | `{ dataUrl \| null }` (PNG/JPEG/WebP ≤ 500 KB) | 200 `User` |
| | `POST /me/password` | `{ currentPassword, newPassword }` | 204 |
| Carteiras | `GET /me/wallets` | — | 200 `Wallet[]` |
| | `PUT /me/wallets/:slot` | `slot = primary\|secondary`; `WalletInput` | 200 `Wallet` |
| | `POST /me/wallets/:slot/connect` | — | 200 `{ connected, address, provider }` (simulação; `wallet-refused` → 403) |

### Cotação e idempotência do pedido

- O `quoteId` é um hash de itens, quantidades, preços unitários, cupom, rede e total. `POST /orders` recalcula a cotação e **só aceita o `quoteId` atual**. Se algo mudou (preço, estoque, cupom ou taxa), responde 409 `QUOTE_OUTDATED` e devolve a cotação nova, e a UI exige nova confirmação.
- **Um pedido por vez:** enquanto houver um pedido `pending`, um novo pedido com outra chave (por exemplo, de outra aba) responde 409 `CONFLICT` com `details.orderId`, e a revisão mostra "Acompanhar pedido". Isso evita reservar e cobrar o mesmo carrinho duas vezes.
- A chave de idempotência é por usuário. Mesma chave com o mesmo corpo devolve o mesmo pedido (200). Mesma chave com outro corpo responde 409 `IDEMPOTENCY_CONFLICT`. A comparação usa o conteúdo normalizado (independe da ordem das chaves e da caixa do cupom). O cliente deriva a chave do conteúdo (`lib/checkout.ts`): o reenvio após timeout reaproveita a chave, e qualquer mudança de conteúdo gera uma nova.
- Ao criar, o pedido reserva o estoque e fica `pending`. A liquidação (`confirmed` ou `declined`) acontece por timestamp (`settleAt`). Por isso ela sobrevive a refresh e queda de conexão: cada requisição e um `setInterval` liquidam o que venceu. A confirmação remove do carrinho **só os itens e quantidades comprados**. A recusa devolve o estoque e não toca no carrinho. Os estados `confirmed` e `declined` são terminais.
- O pedido guarda um **snapshot** (itens, preços, totais, carteira e rede): mudanças no catálogo não alteram o recibo. Hash de transação e link do explorer são simulados.

## Eventos Socket.IO

Envelope comum:

```ts
{ eventId: string; type; resource: { type: 'nft' | 'order'; id: string }; version: number; occurredAt: string; data }
```

| Evento | Quando | `data` | Destino |
|---|---|---|---|
| `nft.updated` | Mudança de preço ou estoque (inclusive reserva/devolução de estoque de pedidos) | `{ price, available, editions }` | Todos os sockets |
| `order.updated` | Criação e liquidação de pedido | `Order` | Só os sockets da sessão do dono (`userId` no envelope) |

**Cliente (`api/realtime.ts`):**

- **Duplicatas:** `eventId` já visto é ignorado (conjunto dos últimos 500).
- **Eventos antigos:** um evento com `version` ≤ à maior conhecida é ignorado. A comparação considera a memória e as versões que detalhe, listas e destaques já receberam da REST, e cada item só é atualizado se a versão dele for menor. Assim, um estado mais recente nunca regride, nem depois de um reload ou de uma reconexão, e efeitos não se repetem.
- `nft.updated` atualiza o cache do detalhe, das listas e dos destaques, **invalida** carrinho e cotação (os valores vêm da API) e avisa a UI (toast com `aria-live` e indicação "de → para" na linha do carrinho).
- `order.updated` só é aplicado se `userId` for o da sessão atual (defesa extra além do filtro do servidor).
- **Reconexão:** ao reconectar, `invalidateQueries({ refetchType: 'active' })` reconcilia pela REST tudo o que estiver na tela. Eventos perdidos na queda não se perdem de fato.
- **Ciclo de vida:** um socket por sessão, com o token no handshake. Login, logout e expiração fecham o socket anterior (removendo listeners), descartam os dados privados do cache e abrem um novo, então eventos de uma sessão anterior não alcançam outro usuário.

### Transporte nos mocks e limitações

O servidor é simulado com `ws.link('<VITE_SOCKET_URL>/*')` do MSW + `@mswjs/socket.io-binding`, e o cliente é o `socket.io-client` real, com o protocolo Engine.IO/Socket.IO de verdade.

- O binding **finge o handshake** (`sid: "test"`) e não implementa rooms, namespaces nem broadcast. O isolamento por usuário é feito no handler, resolvendo o token do handshake (`?token=`) para a sessão.
- Só pacotes `EVENT` são decodificados. Não há ack nem binário.
- Só o transporte **WebSocket** (`transports: ['websocket']`); long-polling não é simulado.
- O link precisa de curinga (`/*`), por causa da query `?EIO=4&transport=websocket`.
- O binding declara peer `msw@^2`; foi validado com o MSW 3 **no navegador**. No Node (`msw/node`) não funciona, porque lá o `engine.io-client` usa o pacote `ws`. Por isso todos os testes de tempo real rodam no Chromium.
- Uma queda é simulada com `connection.client.close()` (`__kurio.dropConnections()`); o cliente reconecta sozinho em 0,5–3 s.

## Sessão

- `POST /auth/login|register` devolve `{ token, expiresAt, user }`. O cliente guarda só `token`, `expiresAt` e `userId` em `localStorage` (`session-store.ts`), e o perfil vem da API. A sessão sobrevive a refresh. Uma sessão vencida com a aba fechada é descartada no boot.
- **Expiração:** o cliente agenda a expiração local para `expiresAt`, e um 401 encerra a sessão (`reason: 'expired'`) **só se o token recusado for o da sessão atual**. Respostas atrasadas de uma sessão anterior não derrubam a nova. O layout raiz mostra o aviso e, em página privada, leva ao login com `redirect` para a mesma página. O rascunho do pagamento fica em `sessionStorage` e é restaurado na volta.
- **Logout e troca de usuário:** removem todo o cache privado (`['user', …]`), fecham o socket e limpam o cupom aplicado. Em página privada, o logout leva à Início.
- As senhas existem só no banco simulado, como SHA-256 com salt. A troca de senha gera um salt novo e revoga as outras sessões do usuário.

## Carrinho

- O carrinho fica **no servidor simulado**, identificado por `user:<id>` ou `guest:<X-Guest-Id>`, por isso sobrevive a refresh e funciona sem login.
- **Login:** os itens do visitante são **fundidos** ao carrinho do usuário (respeitando estoque e o limite de 10 por linha), e o carrinho do visitante é apagado.
- Cada linha é uma combinação de NFT e edição. O limite é `min(estoque, 10)` (`OUT_OF_STOCK` acima disso). As mutations devolvem o carrinho inteiro, que é gravado direto no cache, e invalidam a cotação.
- **Resumo:** subtotal, desconto, taxa de rede e total vêm sempre de `POST /quote`, nunca de conta feita no cliente. No carrinho a taxa é estimada para Ethereum, e a rede final é escolhida no pagamento.
- **Cupom:** o cupom aplicado fica em `localStorage` (`coupon-store.ts`) e segue para o pagamento; um cupom que vence é removido com aviso.
- **Mudanças em tempo real:** com o carrinho aberto, `nft.updated` marca a linha (preço "de → para", "só N disponíveis", "esgotada") e o resumo é recalculado. Se algum item ficar sem estoque suficiente, "Conectar e finalizar" fica bloqueado até ajustar.

## Pagamento

1. O formulário é preenchido a partir da carteira escolhida (principal ou secundária) e do perfil, e validado com as mesmas regras do servidor (`lib/buyer-validation.ts`).
2. A **conexão da carteira** é simulada (`/connect`): conecta, recusa (`wallet-refused`) ou desconecta.
3. A **revisão** (diálogo) refaz a cotação ao vivo. Se ela mudar (evento, cupom, estoque), aparece "Os valores mudaram" e é preciso **confirmar os novos valores** antes de pagar.
4. O **envio** desabilita o botão (evita clique duplo) e manda a chave de idempotência:
   - em `QUOTE_OUTDATED` ou `OUT_OF_STOCK`, a revisão é atualizada com a cotação nova;
   - em timeout ou falha de rede, "Tentar novamente" reenvia **exatamente o mesmo pedido** (mesmo `quoteId`, mesma chave) e recupera o pedido existente.
5. **Acompanhamento** (`/pedido/$id`): o pedido pendente é salvo em `localStorage` e retomado após refresh. A tela atualiza por `order.updated` e, enquanto pendente, também consulta a API a cada 2 s (resiste à queda do socket). O recibo só aparece para pedido `confirmed`; `declined` informa que nada foi cobrado.

## Cache, retries e sincronização (TanStack Query)

| Política | Valor |
|---|---|
| `staleTime` padrão | 30 s; carrinho e cotação 0 (sempre revalidam) |
| Retry de query | Até 2 tentativas, **só** para `ApiError.transient` (rede, timeout, 5xx); 4xx não repete |
| Retry de mutation | Nenhum automático. Pedidos são reenviados explicitamente com a mesma chave de idempotência |
| Respostas obsoletas | Cada consulta recebe o `AbortSignal` do Query (Axios cancela). Como a chave inclui os parâmetros, uma resposta atrasada de um filtro antigo nunca aparece no filtro atual |
| Troca de filtros/página | `placeholderData: keepPreviousData`: a lista anterior continua visível, esmaecida e com `aria-busy`, até a nova chegar; skeleton só no primeiro carregamento |
| Isolamento por usuário | Dados privados ficam sob `['user', <userId \| guest:id>, …]` e são removidos no login, logout e expiração. A lista de favoritos usa chave privada |
| Invalidação | Mutations de carrinho gravam o carrinho e invalidam a cotação. `nft.updated` invalida carrinho e cotação. `order.updated` invalida pedidos e, se confirmado, o carrinho. A reconexão invalida as consultas ativas |
| Atualização otimista | Favoritos (`lib/favorites.ts`): `onMutate` aplica, `onError` faz rollback e avisa, `onSuccess` grava a resposta, `onSettled` revalida. As mutations rodam em série (`scope`), então cliques rápidos não se cruzam |
| Background | `refetchOnWindowFocus` ligado; pedido pendente com `refetchInterval` de 2 s |

## Mocks (MSW)

- **Estado consistente:** um único banco (`db.ts`), relido do `localStorage` antes de cada requisição quando outra aba o alterou, para catálogo, contas, sessões, favoritos, carrinhos, carteiras e pedidos, persistido em `localStorage`. Mudar preço ou estoque (`updateEdition`) altera a resposta REST **e** emite `nft.updated`; os pedidos emitem `order.updated`.
- **Fixtures determinísticas:** 48 NFTs (os 9 do Figma mais 39 gerados) em 9 categorias e 3 redes, com 4 edições cada (1/1, 1/10, 1/50, aberta); estoques e esgotados variados; 2 usuários; 3 cupons. `?mockReset=1` restaura tudo.
- **Cenários reproduzíveis:** latência fixa por padrão (150 ms). `jitter` usa um PRNG com semente fixa (mulberry32), então a ordem das respostas se repete a cada execução. Os cenários "uma vez" (preço sobe ou esgota na compra) disparam só na primeira tentativa.
- **Mesmos handlers em dev, demo e testes.** Os testes usam `window.__kurio` para disparar eventos pelo servidor simulado. O Socket.IO nunca é contornado chamando setters ou o cache diretamente.
- **Produção (demo):** o plugin `msw/vite` emite o `mockServiceWorker.js` no build. Em produção o MSW roda com `quiet` (sem log por requisição) e deixa assets sem handler passarem direto.

## Testes

| Projeto | Escopo |
|---|---|
| `unit` | Aritmética de ETH (precisão, arredondamento, entradas inválidas) |
| `api` | Contratos no navegador: compra com cupom, idempotência, liquidação via socket, dedupe/versão de eventos, reconexão, isolamento entre usuários e sessão expirada |
| `desktop` / `mobile` | Os 12 cenários do enunciado em Chromium (1440 e 390), mais ações de hover, paginação e ausência de overflow/perda de conteúdo em 320/390/640/768/1024/1440 (640 = zoom de 200% e 320 = 400% numa tela de 1280px, reflow WCAG 1.4.10) |
| `visual-*` | Regressão visual de Início, Detalhe, Carrinho e Pagamento (tolerância de 50 px; validada contra troca de cor) |

Cada teste parte de `?mockReset=1` (estado isolado). A latência é fixa por cenário e os eventos são disparados pelo teste. **Relógio:** `page.clock` controla o tempo da página (app e backend simulado rodam nela) na expiração de sessão (avanço de 30 min, verificada também no servidor) e no pedido pendente (`slow-settlement`: continua pendente após queda e refresh até o teste avançar o relógio). Exceção: o timeout de 10 s do pedido é o timeout nativo da requisição do navegador, que o relógio falso não controla, então esse teste roda em tempo real. Há relatório HTML e trace nas falhas, e uma nova tentativa em CI.

## Acessibilidade

- Navegação por teclado com foco visível em todos os controles e link "Pular para o conteúdo". O link de cada card cobre o card inteiro (área de toque grande), e o coração e as ações de hover são botões próprios.
- Diálogos e drawers do Radix prendem o foco. O modal de login foca o primeiro campo, e o Esc fecha.
- Formulários têm rótulos (visuais ou só para leitores de tela, conforme o Figma), erros ligados por `aria-describedby`/`aria-invalid` e foco no primeiro campo inválido.
- Feedback de mutations e de tempo real em `aria-live` (toasts sonner e regiões de status); a contagem de resultados do catálogo também é anunciada.
- Estados não dependem só de cor: esgotado é texto mais riscado mais desabilitado, item ativo usa `aria-current`/`aria-pressed`, e botões de alternância mantêm o nome acessível fixo.
- Padrões de teclado: o seletor de edição (radiogroup) e as abas do Detalhe têm um único ponto de Tab e navegação por setas. As abas do catálogo são filtros, então são botões com `aria-pressed`.
- Foco preservado depois de ações que removem o elemento focado: remover item do carrinho, fechar a busca, salvar carteira e erros de campo vindos da revisão do pagamento.
- Skeletons respeitam `prefers-reduced-motion`, assim como a rolagem ao trocar de página.
- Lighthouse Accessibility = 100 nas quatro combinações auditadas.

## Performance

Detalhes e relatórios em [`docs/lighthouse/RESULTS.md`](docs/lighthouse/RESULTS.md). Desktop atinge todas as metas (Performance 95–96; demais categorias 100). No mobile, Accessibility, Best Practices e SEO ficam em 100 e a **Performance em ~76–80**, porque o MSW (~140 KB gzip) e a cadeia JS → MSW → API ficam no caminho crítico do LCP sob o 4G lento simulado. A análise completa, as otimizações aplicadas e o que mudaria com backend real estão no relatório.

## Decisões de UX e desvios do Figma

O Figma foi seguido como fonte visual (desktop 1440 e mobile 414). Desvios e complementos:

**Fluxos e estados que o Figma não desenha (seguem o mesmo padrão visual)**
- Diálogo **"Revise seu pedido"** antes de pagar (o enunciado exige revisão), com banner de valores alterados.
- Telas de pedido **pendente** e **recusado** no mesmo cartão da Confirmação.
- Skeletons, estados vazios e de erro com "Tentar novamente", página 404 e NFT ou pedido inexistentes.
- **Tablet (768 px):** não há frame. Filtros num drawer até 1024 px; Pagamento empilhado; Perfil e Carteiras com abas no lugar da sidebar; Perfil e Sair só com ícone no cabeçalho.
- **Perfil, Carteiras e Confirmação no mobile:** não há frame. Sidebar vira abas roláveis; a tabela do recibo mostra a quantidade sob o nome.

**Itens fora do escopo** (Criadores, Aprenda, artigos do blog, newsletter, Atividade, Ofertas, Arquivos, Suporte, login social, recuperação de senha, avaliações detalhadas): avisam "não faz parte desta demonstração" em vez de simular sucesso; links de rodapé fora do escopo são texto. "Lista de interesse" e o coração da barra mobile levam aos **favoritos** (no escopo).

**Ajustes de comportamento**
- Ações de hover nos cards (desktop): o carrinho adiciona 1 unidade da edição 1/50, a do preço exibido.
- Ao trocar de página, a tela volta ao topo da lista. A paginação é compacta (com "…") e centralizada no mobile.
- Toasts abaixo do cabeçalho, para não cobrir voltar e favoritar no mobile.
- Login e Cadastro no desktop: modal sobre a Início, como no Figma; fechar sem entrar volta à página anterior.
- O botão central da barra mobile leva ao catálogo, e o botão de filtros da busca mobile também.

**Assets**
- Artes de NFT exportadas do Figma e convertidas para WebP em 1000 e 500 px (de ~2 MB para ~60 KB), com `srcset`.
- Ícones Iconly → **Lucide** (LogOut→`LogIn` no "Entrar", Delete→`Trash2`, Hide→`EyeOff`, Star, ChevronDown, Wallet, SlidersHorizontal, House). Ícones sociais e de compartilhar vêm do Figma (SVG).
- Redesenhados em SVG, porque não puderam ser exportados (limite do Figma MCP): ícone **"Thank you"** da Confirmação e logos **Google/Facebook** do login.
- O fundo do hero desktop veio vazio no export e não foi usado. A máscara do hero mobile virou SVG inline (antes era o LCP).
- Notas das fixtures são inteiras (ex.: 3,0); o Figma mostra 4,8.

**Acessibilidade em relação ao layout**
- Login e Cadastro (conferidos com os exports desktop e mobile do Figma): rótulos só para leitores de tela (o Figma usa só placeholder). O ícone de olho em "Confirmar senha" aparece só no mobile, como no Figma.
- Pagamento, Perfil e Carteiras usam os rótulos visíveis do Figma.
- O alvo de toque dos pontos do carrossel é 24 px, com o ponto de 8 px desenhado.

## Limitações conhecidas

- Não há backend real. Blockchain, carteiras e gateways são simulados, e hash e explorer são fictícios.
- O estado simulado vive no `localStorage` de cada navegador. Abas simultâneas compartilham os dados (cada requisição relê o banco), mas os eventos em tempo real só chegam aos sockets da aba em que a mudança aconteceu. Limpar o armazenamento equivale a um reset.
- O MSW vai no bundle de demonstração (exigência do desafio), o que custa ~140 KB gzip e explica a performance mobile.
- As baselines visuais dependem de Linux/Chromium. Os testes que preparam dados importando `/src` exigem o servidor de desenvolvimento.
- A busca procura no nome e na coleção (ex.: "golden" traz a coleção "Golden Sessions"). O tamanho de página é fixo (9).
- As imagens de fixture seguem a convenção `<nome>.webp`/`<nome>-500.webp` para o `srcset`. Com um CDN real, o `srcset` viria da API.
