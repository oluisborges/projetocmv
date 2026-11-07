// Avisos de novidade (o modal que aparece depois de uma atualização).
// Para lançar um aviso: acrescente-o em ANNOUNCEMENTS e troque ACTIVE_ANNOUNCEMENT_ID pelo id dele.
// Com ACTIVE_ANNOUNCEMENT_ID = null nenhum cliente vê nada; o admin Shogun pode ver o rascunho abrindo qualquer tela com ?aviso=ver.
// No ar: novidades-2026-11-07, com duas abas (07/11 abre primeiro; 03/11 é a atualização de fichas e tabela nutricional).

/** Textos aceitam **negrito**. `highlight` + `badge`: bloco em destaque (ex.: o que vem aí). */
export type AnnouncementSection = { icon: string; title: string; body: string; bullets?: string[]; /** frase depois da lista */ after?: string; highlight?: boolean; badge?: string };

/** Uma atualização dentro de um aviso com abas (a mais nova vem primeiro e é a que abre). */
export type AnnouncementTab = { id: string; /** data da atualização, ex.: "07/11" */ label: string; /** poucas palavras sobre o que mudou */ short: string; heading: string; sections: AnnouncementSection[] };

export type Announcement = {
  /** Identifica o aviso: quem marcou "não mostrar mais" não volta a ver ESTE aviso (um aviso novo, com outro id, volta a aparecer). */
  id: string;
  title: string;
  intro: string;
  /** Aviso sem abas: as seções vêm aqui. Com `tabs`, as seções ficam dentro de cada aba. */
  sections: AnnouncementSection[];
  tabs?: AnnouncementTab[];
};

/** Aviso que está no ar para todos. `null` = nenhum. Só trocar quando o dono do projeto pedir. */
export const ACTIVE_ANNOUNCEMENT_ID: string | null = "novidades-2026-11-07";

/** O aviso que está sendo preparado (visível só para o admin, com ?aviso=ver). */
export const DRAFT_ANNOUNCEMENT_ID = "novidades-2026-11-07";

/** Atualização de 07/11 junto com a de 03/11: o aviso abre na mais nova e a pessoa pode voltar para a anterior. */
const UPDATE_NOV_07: Announcement = {
  id: "novidades-2026-11-07",
  title: "Novidades do Precificaí",
  intro: "Toque nas abas para ver o que mudou em cada atualização. A mais nova abre primeiro.",
  sections: [],
  tabs: [
    {
      id: "nov-07",
      label: "07/11",
      short: "Produção liberada",
      heading: "Atualização de 07/11",
      sections: [
        {
          icon: "🏭",
          title: "Produção liberada!",
          badge: "Novo",
          highlight: true,
          body: "O menu **Produção** está aberto para você, sem cadeado. Ele organiza o dia a dia da cozinha:",
          bullets: [
            "Plano em 4 passos: **Quanto fazer**, **Preparar** (as receitas em lote), **Comprar** e **Já fiz**.",
            "O sistema **sugere as quantidades** pelas suas vendas, e você ajusta. Dá para **repetir a última produção** com um toque.",
            "Ao dar baixa, você vê o **rendimento real**: quanto planejou, quanto saiu e a perda.",
            "**Estoque** de ingredientes e de marmitas prontas: contar, lançar compra, lançar perda (com o motivo) e definir um **estoque mínimo**.",
            "**Lote e validade** das marmitas prontas, com aviso de **o que está perto de vencer**.",
            "**Movimentos**: tudo o que mexeu no estoque, com filtro por tipo e busca.",
            "**Fechar o mês**: o CMV real, comparando o que você gastou com o que as vendas explicam.",
          ],
        },
        {
          icon: "🧾",
          title: "Lista de compras com o que você realmente comprou",
          body: "Marcou um item como comprado? Informe **quanto comprou de verdade** e **quanto pagou**: quase nunca é igual ao da lista. O estoque recebe a quantidade real, e você pode **atualizar o preço do insumo** com o valor pago. Os botões de copiar, WhatsApp e baixar ficaram juntos no botão **Compartilhar**.",
        },
        {
          icon: "📋",
          title: "Ficha de produção para baixar",
          body: "No plano de produção, **Baixar ficha de produção** abre uma janela onde você escolhe **o que entra e em que ordem**: só a **lista de compras com preços estimados** (total e por kg ou unidade), a **ficha completa** ou a versão para a **cozinha**, sem preços. Você vê a prévia na hora.",
        },
        {
          icon: "🧩",
          title: "Fichas com nomes novos",
          body: "Passamos a usar os nomes que a cozinha já conhece:",
          bullets: [
            "**Ficha de montagem**: a do produto (a marmita montada).",
            "**Ficha técnica**: a da receita em lote.",
            "No Cardápio, a aba agora se chama **Baixar Fichas**, e o botão em todo lugar é **Baixar ficha**.",
          ],
        },
        {
          icon: "📸",
          title: "Ficha de montagem mais completa",
          body: "Dentro do produto, na aba **Ficha de Montagem**, você pode:",
          bullets: [
            "Colocar a **foto** de como o prato deve ficar.",
            "Definir a **ordem de montagem** dos itens, com as setas.",
            "Escrever o **passo a passo da montagem**.",
            "Imprimir com espaço para **peso final, lote e validade**.",
          ],
          after: "Nas **receitas**, agora existe o **Modo de preparo**, que sai na ficha técnica.",
        },
        {
          icon: "📊",
          title: "CMV e CMO no Painel",
          body: "Em **Para onde vai cada R$ 100**, o gasto com insumos mostra a sigla **CMV** e a equipe mostra **CMO**, cada uma com a explicação em linguagem simples.",
        },
        {
          icon: "📱",
          title: "Mais leve de usar",
          body: "Cabeçalhos e cartões de custo ocupam menos espaço no celular, os menus ficaram mais organizados e a página de erro agora é em português. No computador, o app aparece no mesmo formato do celular, centralizado. Insumos e embalagens **arquivados** agora podem ser restaurados.",
        },
      ],
    },
    {
      id: "nov-03",
      label: "03/11",
      short: "Fichas e tabela nutricional",
      heading: "Atualização de 03/11",
      sections: [
        {
          icon: "📄",
          title: "Fichas técnicas para imprimir",
          body: "Em **Cardápio › Baixar Fichas** (e dentro de cada produto) você baixa a ficha em **PDF ou Excel**, com a sua marca. Escolha o que vai nela: o modelo **Cozinha** (pesos e modo de preparo, sem valores), o modelo **Financeiro** (custos, preço de venda e CMV) ou marque campo por campo, vendo a prévia na hora.",
        },
        {
          icon: "🥗",
          title: "Tabela nutricional automática",
          body: "Dentro de cada produto, a nova aba **Tabela Nutricional** monta a tabela sozinha a partir dos ingredientes, com base na **TACO** e no formato das normas da Anvisa (RDC 429/2020 e IN 75/2020). Você baixa em **PDF**, imprime e pode **alterar qualquer valor**. A conferência e a validação dos valores antes da utilização no rótulo são de responsabilidade do usuário.",
        },
        {
          icon: "🗂️",
          title: "Produto e Cardápio com abas novas",
          body: "Dentro de cada produto agora existem quatro abas:",
          bullets: [
            "Itens: a antiga ficha, com os ingredientes e o custo.",
            "Ficha de Montagem: baixe a ficha do produto ali mesmo.",
            "Tabela Nutricional: calculada pelos ingredientes.",
            "Preço de Venda: o preço e o lucro.",
          ],
          after: "No Cardápio, as abas ficam na ordem: **Produtos, Combos, Baixar Fichas e Sincronizar Cardápio**.",
        },
        {
          icon: "🛡️",
          title: "Margem de segurança à sua escolha",
          body: "Em **Financeiro › Impostos** você escolhe quanto somar ao custo dos ingredientes para cobrir perdas e desperdício: **0%, 5%, 10% (o padrão), 15%, 20%** ou outro valor.",
        },
        {
          icon: "📅",
          title: "Meses anteriores no Resumo",
          body: "No **Resumo do Início**, toque no mês para ver como foi cada um dos meses anteriores.",
        },
        {
          icon: "🧮",
          title: "Cadastro de ingredientes mais claro",
          body: "O **fator de correção** (quanto comprar para ter 1 kg depois da limpeza) e o **fator de cocção** (quanto o ingrediente rende depois de pronto) agora aparecem como perguntas simples, cada um com um texto de ajuda.",
        },
      ],
    },
  ],
};

/** Só o aviso de 07/11 fica no ar; ele traz a atualização de 07/11 e a de 03/11. Quem dispensou avisos antigos continua com a dispensa registrada. */
export const ANNOUNCEMENTS: Announcement[] = [UPDATE_NOV_07];

export const findAnnouncement = (id: string | null): Announcement | null => (id ? (ANNOUNCEMENTS.find((a) => a.id === id) ?? null) : null);

/**
 * Qual aviso mostrar para esta pessoa agora: o que está no ar e que ela ainda não dispensou.
 * `previewAllowed` (admin Shogun): enquanto não há aviso no ar, o rascunho fica disponível só com ?aviso=ver, sem gravar nada.
 */
export function pickAnnouncement(input: { dismissedIds: string[]; previewAllowed: boolean }): { announcement: Announcement; preview: boolean } | null {
  const live = findAnnouncement(ACTIVE_ANNOUNCEMENT_ID);
  if (live && !input.dismissedIds.includes(live.id)) return { announcement: live, preview: false };
  const draft = findAnnouncement(DRAFT_ANNOUNCEMENT_ID);
  if (!live && draft && input.previewAllowed) return { announcement: draft, preview: true };
  return null;
}
