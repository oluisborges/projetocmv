# Integração com o cardápio digital (CardápioWeb e Prefiro Delivery)

Data: 2026-10-17. Decisões tomadas com o dono do produto em conversa; o que é palpite meu está marcado como **(minha escolha)**.

## Por quê
O dono digita à mão o faturamento e a quantidade vendida do mês. Com a integração, o app lê as vendas do cardápio (o que foi vendido, quanto e por quanto) e calcula o lucro real, cruzando com o custo das fichas.

## Decisões do dono do produto
- **Independente do projetosecreto.** Banco, código e credenciais próprios. O código dele só serve de referência (a lógica de tradução dos pedidos é copiada, não importada).
- **O time Shogun conecta o cardápio**, pelo painel de admin. O dono nunca vê nem digita credencial.
- **O dono vincula** cada item vendido a uma ficha (ou combo). O admin Shogun pode alterar pela visão "ver como". **Vários itens/opções do cardápio podem apontar para a mesma ficha.**
- **Números reais convivem com os digitados.** Quem vende dentro e fora do cardápio continua informando o faturamento manual, mas **só o de fora**. Faturamento do mês = cardápio + digitado. Idem para a quantidade de marmitas.
- **Lucro em duas linhas:** lucro do cardápio (real, pelo custo das fichas) e lucro da venda por fora (**estimado**, mesmo percentual do cardápio). Cada linha é rotulada como real ou estimada.

## Não objetivos
- Clientes, telefones, consentimento e marketing (isso é do CRM, não daqui).
- Escrever no cardápio (preço, estoque). A integração é só leitura.
- Compartilhar dados com o projetosecreto.

## Como funciona
**Conexão (admin Shogun).** Por marmitaria/unidade, uma conexão por provedor:
- CardápioWeb: API Key gerada pelo lojista em Configurações → Integrações → API.
- Prefiro: hash do estabelecimento + chave de API (Basic = base64(md5(HASH|CHAVE))).
Credenciais ficam em `menu_credentials`, tabela com RLS ligada e **nenhuma policy** (só o service role lê), nunca no navegador. O painel só mostra "conectado / último sync / erro".

**Pedidos.** Só pedidos que viram venda entram (CardápioWeb: `closed`; Prefiro: em produção em diante). Cancelado sai da base se já tinha entrado. Cada pedido guarda total, desconto, taxa de entrega, canal, data (fuso de Brasília) e as linhas de item.

**Itens e vínculo.** Cada linha de item (e cada opção/complemento) vira um `menu_products` (chave estável do provedor + nome). O vínculo está no próprio produto: `recipe_id` ou `combo_id` (vários produtos → mesma ficha), `units_per_sale` (quantas marmitas uma venda daquele item leva), ou `ignored` (ex.: bebida, taxa). Produto novo nasce sem vínculo e aparece num aviso para o dono. Sugestão automática por nome, sempre confirmada pelo dono **(minha escolha)**.

**Sincronização.** Rotas do próprio Next.js na Vercel **(minha escolha)**: webhook (aviso de pedido novo/alterado vira fila), consulta periódica e botão "Sincronizar agora". A carga inicial é retomável (limites: CardápioWeb 5 chamadas/min no histórico). Carga inicial: o mês atual e os 3 anteriores, inteiros (decisão do dono do produto). Depois, uma conferência por dia à meia-noite de Brasília. No plano Hobby da Vercel o cron é diário; a frescura vem do webhook e do botão.

**Cálculo (`src/lib/calc`).** Funções puras com `decimal.js`:
- Receita do cardápio no mês = soma do total dos pedidos-venda.
- Lucro do cardápio (por linha vinculada) = receita da linha − custo da ficha × qtd × `units_per_sale` − receita × (imposto + taxa do canal). Linhas sem vínculo entram na receita mas ficam fora do lucro e geram aviso de cobertura ("X% da receita ainda sem vínculo").
- Lucro da venda por fora (estimado) = faturamento digitado × margem % do cardápio (só quando a cobertura é suficiente) **(minha escolha: mínimo de 50% da receita vinculada)**.

**Telas.**
1. Admin: conectar/testar/desconectar, status e erro por marmitaria.
2. Dono: "Vínculos" (itens sem ficha primeiro, vários itens → uma ficha).
3. Custos → Mês: faturamento e unidades passam a mostrar "cardápio" + "por fora" + total; lucro em duas linhas, rotuladas.
4. Painel: mesmos números, com selo real/estimado.

## Restrições
- Convenções do projeto: pt-BR, mobile-first (375px), tooltips em termos técnicos, RLS + índice em `org_id` + `unit_id` em toda tabela nova, `server-only` para a service role, cálculo só em `lib/calc` com teste.
- Sem conexão, tudo se comporta como hoje (faturamento digitado = total).

## Fases
1. **Base:** migração, tradução dos pedidos (CardápioWeb e Prefiro), cálculo do lucro, testes. ← primeira entrega
2. **Sincronização:** clientes HTTP dos dois provedores, fila, rotas (webhook, cron, manual), conexão no admin.
3. **Dono:** tela de vínculos, integração com Custos → Mês e Painel.
4. **Validação:** fluxo completo no app (375px e desktop), com dados de teste; conexão real com chave de um cliente piloto.

## Em aberto (precisa de chave real para fechar)
- Formato exato do total e das linhas de item de cada provedor (se o preço do item já inclui as opções).
- Se o histórico do CardápioWeb aceita 1 ou 3 anos.
- Retenção/limites de chamadas da Prefiro (não são públicos).

## Operação e escala (30+ clientes)
- **Cron diário** (`0 3 * * *` UTC = 00:00 em Brasília) só descobre quem está devendo e **despacha uma função por conexão** (`/api/menu/run/[id]`, em paralelo). Cada cliente tem o próprio orçamento de tempo (50 s) e o próprio limite de chamadas ao provedor: o tempo total não cresce com o número de clientes.
- **Carga em ciclos encadeados:** se sobra trabalho (histórico por listar ou fila de pedidos) e houve progresso, o ciclo chama o próximo sozinho (limite de 150 ciclos). Trava por conexão (`locked_until`) impede dois ciclos ao mesmo tempo; se uma função morrer, a trava expira sozinha.
- **Webhook** (opcional, em tempo quase real) só enfileira e escoa a fila; nunca lista o histórico, para não gastar o limite do provedor.
- **Recuperação:** conexão sem conferir há mais de 14 dias volta a listar por janelas. Chamadas ao provedor têm timeout de 20 s. Chave recusada pausa só aquela conexão (status "erro"); o painel Shogun mostra "Atrasado" se passar de 30 h sem conferir.
- **Banco:** as telas leem totais por funções `security definer` que checam a marmitaria uma vez por chamada (sem RLS linha a linha). Medido com 107 mil pedidos e 167 mil linhas: totais do mês em 2–11 ms; série de 13 meses em ~100 ms.
- **Limites conhecidos:** plano Hobby da Vercel roda o cron em qualquer minuto da hora marcada (não exatamente 00:00) e é para uso não comercial; Supabase Free tem 500 MB e não tem backup diário. Pedido que for cancelado depois de fechado no CardápioWeb só é pego pelo webhook (a listagem do histórico traz só os fechados).
