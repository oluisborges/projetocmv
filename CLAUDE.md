# Precificaí (por Grupo Shogun)

Plataforma web mobile-first para donos de marmitarias congeladas (clientes do Grupo Shogun) controlarem custo e preço: insumos, fichas técnicas, precificação, CMV, CMO, custos fixos/ponto de equilíbrio e dashboard. O plano completo está em `PLAN.md` — leia antes de mexer em modelo de dados ou fórmulas.

@AGENTS.md

## Stack
Next.js (App Router) + TypeScript estrito + Tailwind v4 + shadcn/ui · Supabase (Auth, Postgres, RLS, Storage) via `@supabase/ssr` · Vercel · Vitest · pnpm.

## Comandos
- `pnpm dev` / `pnpm build` / `pnpm lint` / `pnpm test`

## Fluxo de publicação (há clientes reais em produção)
- Trabalho novo vai na branch `staging` (a Vercel gera um endereço de teste fixo para ela). **Nada vai direto para `main`**: só depois de o dono do projeto aprovar no endereço de teste, fazer merge de `staging` em `main`.
- Só existe **um banco** (Supabase `shogun-precificacao-dev` = produção; o plano grátis não permite um segundo). No endereço de teste use SOMENTE a conta "Teste Shogun" (Painel Shogun → Ver como). Nunca opere uma marmitaria real por ele.
- Migration: só aditiva e compatível com o código que está no ar (coluna nova com default, tabela nova; nunca apagar/renomear de uma vez). Antes de qualquer migration ou ajuste de dados reais, avisar o dono e exportar cópia das tabelas afetadas (o plano grátis não tem backup restaurável). Aplicar a migration no banco ANTES de subir o código que depende dela.
- No endereço de teste o cron não roda e integrações só por botão manual; não conectar chaves reais de cliente em teste.
- Antes do merge em `main`: `pnpm lint`, `pnpm test`, `tsc --noEmit` e `pnpm build` passando.

## Convenções
- Interface em **pt-BR**, moeda BRL (`Intl.NumberFormat`), números com vírgula. Código, tabelas e colunas em inglês.
- Cálculo **só** em `src/lib/calc` (funções puras, `decimal.js`, sem I/O). Todo cálculo novo nasce com teste Vitest usando casos reais de marmitaria.
- Dinheiro nunca em `number` float em cálculo: use `decimal.js`.
- Banco muda **somente** via `supabase/migrations`. Toda tabela nova: RLS + policies + índice em `org_id` na mesma migration.
- Multi-tenant: toda tabela de negócio tem `org_id` (e as de operação `unit_id`). Admin Shogun = `profiles.is_platform_admin`.
- `SUPABASE_SERVICE_ROLE_KEY` só em `src/lib/supabase/admin.ts` (`import "server-only"`); nunca em Client Components nem em `NEXT_PUBLIC_*`. Toda Server Action que a usa chama `requireAdmin()` antes.
- Login é e-mail + senha criada pelo admin Shogun (não há auto-cadastro). Páginas protegidas chamam `requireUser()`; o `proxy.ts` é só checagem otimista.
- No Next 16 `middleware` se chama `proxy` (`src/proxy.ts`).
- Mobile-first: projetar em 375px, alvos de toque ≥ 44px, `inputMode="decimal"` em preços, navegação inferior.
- Todo termo técnico (CMV, CMO, markup, FC, MC) tem tooltip em linguagem simples.
- Páginas são Server Components por padrão; `"use client"` só quando necessário.
- Commits pequenos (Conventional Commits). Nunca commitar `.env*`.
- Fim de cada fase: rodar o app, validar com Chrome DevTools (375×812 e desktop), deploy de preview na Vercel.
