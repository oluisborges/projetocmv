# Shogun Precificação — Plano do projeto

## Contexto
O Grupo Shogun atende 30 marmitarias congeladas. O dono não sabe a margem real de cada marmita, precifica no "feeling" e abandona planilhas porque atualizar preço de insumo dá trabalho. Vamos construir uma plataforma web mobile-first (pt-BR, BRL) com insumos, fichas técnicas, precificação, CMV, CMO, custos fixos/ponto de equilíbrio e dashboard.
**Fator de sucesso: atualizar preços de insumos precisa ser quase sem esforço.**

Decisões já tomadas por você:
- Acesso: **só por convite** no MVP (auto-cadastro depois).
- **Organização com várias unidades** (cada unidade tem custos/vendas/CMV próprios).
- **Sem estoque no MVP**: CMV real = compras do período ÷ faturamento (aproximação, avisada na tela). Estoque entra depois.
- Preços: **lista editável em lote** (principal) + atalho de reajuste % por categoria/fornecedor.
- Vendas: **digitação mensal simples** (faturamento + qtd por prato).
- **Catálogo modelo da Shogun** (insumos/embalagens/fichas modelo que o cliente importa e só ajusta preço).
- Visual **alinhado à marca Grupo Shogun** (preciso dos arquivos/cores; uso paleta provisória até lá).
- Contas: só GitHub (repo `oluisborges/projetocmv` já existe, sem commits).

## 1. Ambiente verificado
| Item | Status |
|---|---|
| Node 24.13 / npm 11.12 / git 2.53 / bun 1.3 | OK |
| pnpm | falta — instalo via `corepack enable` (ou `npm i -g pnpm`) |
| Supabase CLI | falta — uso como dependência do projeto (`npx supabase`), não precisa instalar |
| Vercel CLI | falta — idem (`npx vercel`) |
| GitHub CLI (`gh`) | falta — opcional; `git push` funciona com login do Git Credential Manager |
| Docker | falta — **não necessário**: migrations rodam no projeto Supabase remoto (dev) |
| `jq` | falta — irrelevante para o app |
| Plugins | Vercel MCP disponível; **Supabase MCP exige autorização OAuth** (você autoriza em Configurações → Conectores/`/mcp`) |

## 2. Stack final (validada, com ajustes)
Sua stack está **correta**. Ajustes:
- **Next.js (App Router, versão estável atual) + TypeScript estrito + Tailwind v4 + shadcn/ui**. Server Components + Server Actions (menos código, dados sempre no servidor).
- **Supabase** (Auth, Postgres, RLS, Storage) com `@supabase/ssr`. Região São Paulo.
- **Vercel** para deploy; preview a cada branch.
- Extras: `zod` + `react-hook-form` (formulários), `decimal.js` (**dinheiro nunca em float**), `date-fns`, Recharts (via shadcn charts), `vitest`, `@serwist/next` ou manifest simples (PWA instalável na tela inicial do celular).
- **pnpm** como gerenciador.
- Login: **código por e-mail (OTP) / link mágico**, com senha opcional — dono pouco técnico esquece senha.

**Dois alertas de custo/risco (decisão sua antes de ter clientes reais):**
1. Vercel *Hobby* é só uso não comercial → para clientes pagantes, **Vercel Pro** (~US$20/mês).
2. Supabase *Free* pausa projeto inativo e não tem backup diário → **Supabase Pro** (~US$25/mês) antes de colocar dados reais. E o e-mail embutido do Supabase tem limite baixíssimo → configurar **SMTP próprio (Resend)** antes do onboarding.
Plano: dois projetos Supabase (dev e prod), prod só na Fase 8.

## 3. Arquitetura
```
src/
  app/(auth)/ login, aceitar-convite
  app/(app)/[unit]/ insumos | fichas | precificacao | cmv | cmo | custos | dashboard
  app/(admin)/ painel Shogun (orgs, convites, catálogo modelo)
  lib/calc/        ← FUNÇÕES PURAS (sem React/Supabase) + *.test.ts
  lib/supabase/    client.ts (browser) | server.ts (cookies) | admin.ts (service role, server-only)
  lib/validation/  schemas zod
  components/ui/   shadcn
supabase/migrations/  SQL versionado (único jeito de mudar o banco)
supabase/seed/        catálogo modelo
```
- **Cálculo é puro e testado**: UI e banco só guardam dados; custos calculados no TS (e conferidos por testes). Custo de insumo calculado também em coluna gerada para ordenação/alertas.
- **Service role** só em `lib/supabase/admin.ts` (`import "server-only"`), usada apenas para convites/admin. Nunca `NEXT_PUBLIC_`.
- **Preparado para o futuro**: colunas `external_source/external_id` em insumos e fichas; tabela `integrations` por organização; `sales_import` genérica (hoje preenchida à mão, amanhã Cardápio Web); views de agregação para o painel Shogun.

## 4. Modelo de dados (Postgres)
Toda tabela de negócio tem `org_id` desnormalizado (policies simples e rápidas) e as de operação também `unit_id`.

**Tenancy/acesso**
- `profiles` (id → auth.users, nome, `is_platform_admin`)
- `organizations` (nome, slug)
- `memberships` (org_id, user_id, papel: `owner | manager | viewer`)
- `units` (org_id, nome, cidade)
- `invitations` (org_id, e-mail, papel, hash do token, expira, aceito_em)

**Catálogo da organização (compartilhado entre unidades)**
- `suppliers` (org_id, nome, contato)
- `ingredients` (org_id, nome, categoria, `kind` insumo|embalagem, unidade de compra, qtd da embalagem de compra, preço de compra, **fator de correção** ≥1, supplier_id, `template_id`, external_*, arquivado) + `price_updated_at`
- `ingredient_price_history` (ingredient_id, preço, qtd, changed_at, changed_by) — **gravado por trigger** a cada mudança de preço
- `recipes` (org_id, nome, categoria, nº de porções, peso da porção, **perda de cocção %**, ativo)
- `recipe_items` (recipe_id, ingredient_id, qtd líquida, qtd bruta, escopo `batch|portion` — embalagem/etiqueta/lacre são `portion`)

**Operação por unidade**
- `unit_settings` (unit_id, % impostos, % margem desejada, meta de margem mínima, encargos padrão)
- `sales_channels` (unit_id, nome — balcão/WhatsApp/iFood/cartão —, taxa %)
- `recipe_prices` (recipe_id, unit_id, preço praticado)
- `fixed_costs` (unit_id, nome, categoria, valor mensal)
- `staff` (unit_id, nome/função, área cozinha|embalagem|entrega, salário, % encargos)
- `periods` (unit_id, mês, faturamento, compras do período)
- `period_sales` (period_id, recipe_id, qtd vendida)

**Catálogo modelo (global)**
- `template_ingredients`, `template_recipes`, `template_recipe_items` — legíveis por todos os autenticados, editáveis só por admin. Função `import_template(org_id, ids[])` (SECURITY DEFINER) copia para a organização.

**Futuro**: `integrations`, `sales_import`, `nfe_imports`.

### RLS
- Funções em schema privado, `SECURITY DEFINER`, `STABLE`: `is_platform_admin()`, `is_org_member(org_id)`, `org_role(org_id)`; chamadas como `(select auth.uid())` para o Postgres cachear.
- Policy padrão por tabela: SELECT para membros da org ou admin; INSERT/UPDATE/DELETE para `owner|manager` (viewer só lê); admin Shogun lê/escreve tudo (suporte).
- Índice em `org_id` (e `unit_id`) em todas as tabelas. RLS **ligada em 100%** das tabelas do schema `public`; revisão final com `supabase db advisors`/checagem de segurança.
- Testes de isolamento: 2 orgs + 1 admin, tentando ler/escrever cruzado (Vitest contra o projeto dev, só com variáveis de teste).

## 5. Fórmulas (todas em `lib/calc`, com testes de marmitaria real)
- **Custo unitário do insumo** = preço de compra ÷ qtd comprada (em unidade-base g/ml/un).
- **Qtd bruta** = qtd líquida × fator de correção (FC = peso bruto ÷ peso líquido; ex.: frango com aparas, FC 1,15). Custo do item = qtd bruta × custo unitário. (Evita contar o FC duas vezes.)
- **Custo do lote** = Σ itens `batch`. **Rendimento** = Σ qtd líquida × (1 − perda de cocção). **Porções** = informadas, ou rendimento ÷ peso da porção.
- **Custo por porção** = custo do lote ÷ porções + Σ embalagens `portion`.
- **Markup divisor**: `preço = custo / (1 − (imposto + taxa de venda + despesa fixa rateada + lucro))`. Se a soma ≥ 100% → erro amigável (preço impossível).
- **Despesa fixa rateada %** = custos fixos mensais ÷ faturamento mensal (também mostrado como R$/marmita = fixos ÷ unidades vendidas).
- **Margem de contribuição** (R$) = preço − custo − preço × (imposto + taxa). **MC %** = MC ÷ preço. **Margem líquida** abate também a despesa fixa rateada.
- **CMV real %** = compras do período ÷ faturamento (sem estoque no MVP, rotulado "aproximado"; com estoque depois: (EI + compras − EF) ÷ faturamento).
- **CMV teórico %** = Σ(custo por porção × qtd vendida) ÷ faturamento. **Desvio** = real − teórico (indica desperdício/perda/preço desatualizado).
- **CMO %** = Σ(salário × (1 + encargos)) ÷ faturamento, por área (cozinha/embalagem/entrega).
- **Ponto de equilíbrio** (R$) = custos fixos (+ CMO fixo) ÷ MC % média ponderada pelas vendas; em unidades = fixos ÷ MC unitária média.
- **Reajuste em lote**: novo preço de cada insumo × (1 + %), com prévia do impacto ("muda o custo de 7 pratos; margem média cai 2,1 pp").

## 6. Roadmap em fases
| Fase | Entrega | Pronto quando |
|---|---|---|
| **0 — Fundação** | `git` com 1º commit, scaffold Next, push p/ GitHub, projeto Supabase (dev), projeto Vercel conectado, variáveis de ambiente, "hello world" em produção lendo do Supabase | URL pública abre no celular |
| **1 — Acesso e base** | Auth OTP, organizações, unidades, memberships, convites, RLS + testes de isolamento, shell mobile (nav inferior), design system, painel admin mínimo | Admin convida cliente; cliente entra e só vê a própria org |
| **2 — Insumos** | CRUD, fornecedor, FC, histórico, **lista editável em lote**, reajuste %, "desatualizado há 30+ dias", importar do catálogo modelo | Atualizar 20 preços em < 2 min no celular |
| **3 — Fichas técnicas** | Editor de ficha, embalagem por porção, cocção, custo por porção em tempo real, duplicar ficha | Custo bate com planilha de referência |
| **4 — Precificação** | Configurações, canais, preço sugerido, MC, simulador, comparação com preço praticado | Margem real por prato visível |
| **5 — Custos fixos, CMO, PE** | Custos fixos, equipe com encargos, rateio, ponto de equilíbrio | PE por unidade correto |
| **6 — CMV** | Períodos, faturamento, compras, vendas por prato, CMV real × teórico | Desvio calculado e explicado |
| **7 — Dashboard** | KPIs, ranking de pratos, alertas (margem < meta, insumo em alta) | Dono entende a situação em 10 segundos |
| **8 — Produção** | Onboarding guiado, seed do catálogo modelo, SMTP, projeto Supabase prod + backups, LGPD básica, plano Vercel Pro | 1 cliente-piloto real usando |
| *Pós-MVP* | Cardápio Web (o MCP já está disponível), NF-e XML, estoque, painel Shogun agregado | — |

Cada fase: rodar o app, validar com Chrome DevTools (viewport 375px e desktop), commits pequenos, deploy de **preview** na Vercel, só então concluir.

## 7. Convenções do projeto (viram o `CLAUDE.md`)
- Interface em **pt-BR**, moeda BRL (`Intl.NumberFormat`), números com vírgula; código e nomes de tabelas em inglês.
- Cálculo só em `lib/calc` (puro, `decimal.js`, sem I/O); todo cálculo novo nasce com teste Vitest.
- Banco só muda via `supabase/migrations`; nunca editar schema pelo painel. Toda tabela nova: RLS + policies + índice em `org_id` na mesma migration.
- Service role só em arquivos `server-only`; nunca em Client Components nem `NEXT_PUBLIC_`.
- Mobile-first: projetar em 375px; alvos de toque ≥ 44px; `inputMode="decimal"` em campos de preço; bottom nav.
- Todo termo técnico (CMV, CMO, markup, FC, MC) tem tooltip em linguagem simples.
- Commits pequenos, Conventional Commits; nunca commitar `.env*`.
- Componentes: shadcn/ui; páginas como Server Components por padrão.

## 8. Identidade visual e telas (proposta)
**Direção**: sóbria e acolhedora, números grandes e legíveis, nada de "planilha". Provisória até você mandar logo/cores do Grupo Shogun.
- Paleta provisória: vermelho-shogun `#C8102E` (ação principal), grafite `#1F2328`, off-white `#FAF7F2`; semântica: verde (margem boa), âmbar (atenção), vermelho (abaixo da meta).
- Tipografia: Plus Jakarta Sans (títulos) + Inter (números tabulares).
- Tom: frases curtas, "Quanto você ganha em cada marmita".

**Telas principais**
1. **Login** — e-mail → código de 6 dígitos.
2. **Início/Dashboard** — 3 cartões (CMV%, CMO%, margem média), alertas, ranking dos 5 melhores e 5 piores pratos.
3. **Insumos (lista em lote)** — busca no topo, chips de categoria/fornecedor, linha = nome + preço editável; salvando automaticamente; botão "Reajustar %"; selo "desatualizado".
4. **Ficha técnica** — cabeçalho com custo por porção grande e fixo no topo; lista de ingredientes; bloco "Embalagem"; bloco "Rendimento".
5. **Precificação do prato** — preço sugerido × praticado, barra de margem, simulador (slider de preço) e por canal (iFood etc.).
6. **Mês (CMV)** — faturamento, compras, vendas por prato; gráfico real × teórico.
7. **Custos e equipe** — custos fixos, CMO por área, ponto de equilíbrio com meta diária de marmitas.
8. **Admin Shogun** — organizações, convites, catálogo modelo.
Antes de implementar cada tela uso o skill `frontend-design`.

## 9. O que VOCÊ precisa fazer manualmente (Fase 0)
1. **Supabase**: criar conta em supabase.com (entrar com GitHub) → *New project* `shogun-precificacao-dev`, região **South America (São Paulo)**, senha forte do banco guardada no gerenciador de senhas. Depois autorizar o conector Supabase no Claude Code.
2. **Vercel**: criar conta em vercel.com (entrar com GitHub) → importar o repo `projetocmv`.
3. Eu te passo as 3 variáveis: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (esta **só** no servidor); você cola na Vercel (Settings → Environment Variables) e eu crio o `.env.local`.
4. Se pedir login no terminal (Supabase/Vercel CLI), você faz o login no navegador que abrir.
5. Mandar logo/cores do Grupo Shogun quando tiver.
6. Mais para frente (Fase 8): decidir Pro no Supabase e Vercel e criar conta no Resend (SMTP).

## 10. Verificação
- `pnpm test` (Vitest): fórmulas com casos reais (ex.: lote de 10 kg de frango grelhado com FC 1,15 e perda de cocção 25%; markup com 6% imposto + 5% cartão + 12% fixo + 15% lucro = divisor 0,62).
- Isolamento: testes de RLS com 2 organizações + admin.
- UI: rodar `pnpm dev`, validar com Chrome DevTools em 375×812 e 1280×800 (console sem erros, Lighthouse mobile, fluxo de edição em lote).
- Fim de fase: deploy de preview na Vercel, abrir a URL no celular, checklist da fase.

## 11. Primeira execução após aprovação
Gravar `PLAN.md` (este documento) e `CLAUDE.md` (seção 7) na raiz do repositório e começar a **Fase 0** exatamente como no item 6.
