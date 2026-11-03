// Avisos de novidade (o modal que aparece depois de uma atualização).
// Para lançar um aviso: acrescente-o em ANNOUNCEMENTS e troque ACTIVE_ANNOUNCEMENT_ID pelo id dele.
// Com ACTIVE_ANNOUNCEMENT_ID = null nenhum cliente vê nada; o admin Shogun pode ver o rascunho abrindo qualquer tela com ?aviso=ver.
// No ar: novidades-2026-11-03, com duas abas (03/11 abre primeiro; 27/10 é a atualização de menus e receitas).

/** Textos aceitam **negrito**. `highlight` + `badge`: bloco em destaque (ex.: o que vem aí). */
export type AnnouncementSection = { icon: string; title: string; body: string; bullets?: string[]; /** frase depois da lista */ after?: string; highlight?: boolean; badge?: string };

/** Uma atualização dentro de um aviso com abas (a mais nova vem primeiro e é a que abre). */
export type AnnouncementTab = { id: string; /** data da atualização, ex.: "03/11" */ label: string; /** poucas palavras sobre o que mudou */ short: string; heading: string; sections: AnnouncementSection[] };

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
export const ACTIVE_ANNOUNCEMENT_ID: string | null = "novidades-2026-11-03";

/** O aviso que está sendo preparado (visível só para o admin, com ?aviso=ver). */
export const DRAFT_ANNOUNCEMENT_ID = "novidades-2026-11-03";

const UPDATE_OCT_27: Announcement = {
    id: "novidades-2026-10",
    title: "O Precificaí ficou mais fácil de usar",
    intro: "Mudamos várias coisas para você ver o seu lucro de um jeito mais simples. Leva 1 minuto para ler.",
    sections: [
      {
        icon: "🍚",
        title: "Agora você pode cadastrar receitas",
        body: "Arroz, feijão, molho, estrogonofe: aquilo que você faz em panela grande e usa em várias marmitas. **Cadastre a receita uma vez** e diga quanto ela rende pronta: o sistema calcula **quanto custa cada grama**. Na marmita, é só dizer quantos gramas daquela receita vão dentro. Assim o seu **gasto com ingredientes (o CMV)** fica muito mais certo, porque o tempero e o sal do lote também entram na conta.",
      },
      {
        icon: "🧭",
        title: "Menus em novos lugares, com nomes mais claros",
        body: "Mudamos os nomes e a organização para ficar fácil de achar tudo:",
        bullets: [
          "Início: o Resumo mostra como está o seu mês e o que fazer agora. A Visão Avançada tem as análises mais detalhadas.",
          "Cardápio (antes “Marmitas”): seus produtos, os combos e a aba Sincronizar Cardápio, que liga os produtos do seu cardápio digital às suas fichas.",
          "Ingredientes (antes “Insumos”): comida, receitas e embalagens num só lugar, com o botão + Novo.",
          "Financeiro (antes “Custos”): contas fixas, equipe, impostos, meta de lucro e histórico.",
        ],
      },
      {
        icon: "✂️",
        title: "Tiramos o que atrapalhava",
        body: "Saíram telas e botões que repetiam a mesma informação ou confundiam. Os números mais importantes agora aparecem logo na primeira tela.",
      },
      {
        icon: "🏭",
        title: "Produção",
        badge: "Em breve",
        highlight: true,
        body: "Um menu novo para o dia a dia da cozinha, em **fase final**. Ele vai:",
        bullets: [
          "Quanto produzir: sugere a quantidade de cada marmita, pelo que você vendeu nas últimas semanas.",
          "Lista de compras: monta o que falta, já descontando o que você tem no estoque.",
          "Estoque: controla os ingredientes e as marmitas prontas.",
        ],
        after: "Ele aparece no menu com um **cadeadinho** porque ainda estamos terminando. Em breve ele é liberado!",
      },
    ],
};

/** Atualização de 03/11 junto com a de 27/10: o aviso abre na mais nova e a pessoa pode voltar para a anterior. */
const UPDATE_NOV_03: Announcement = {
  id: "novidades-2026-11-03",
  title: "Novidades do Precificaí",
  intro: "Toque nas abas para ver o que mudou em cada atualização. A mais nova abre primeiro.",
  sections: [],
  tabs: [
    {
      id: "nov-03",
      label: "03/11",
      short: "Fichas e tabela nutricional",
      heading: "Atualização de 03/11",
      sections: [
        {
          icon: "📄",
          title: "Fichas técnicas para imprimir",
          body: "Em **Cardápio › Fichas Técnicas** (e dentro de cada produto) você baixa a ficha em **PDF ou Excel**, com a sua marca. Escolha o que vai nela: o modelo **Cozinha** (pesos e modo de preparo, sem valores), o modelo **Financeiro** (custos, preço de venda e CMV) ou marque campo por campo, vendo a prévia na hora.",
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
            "Ficha Técnica: baixe a ficha do produto ali mesmo.",
            "Tabela Nutricional: calculada pelos ingredientes.",
            "Preço de Venda: o preço e o lucro.",
          ],
          after: "No Cardápio, as abas ficam na ordem: **Produtos, Combos, Fichas Técnicas e Sincronizar Cardápio**.",
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
        {
          icon: "🏭",
          title: "Produção",
          badge: "Em breve",
          highlight: true,
          body: "Continua em **fase final**. Quando for liberada, ela vai sugerir quanto produzir, montar a lista de compras e controlar o estoque.",
          after: "Segue com o **cadeadinho** no menu por enquanto.",
        },
      ],
    },
    { id: "out-27", label: "27/10", short: "Menus e receitas", heading: "Atualização de 27/10", sections: UPDATE_OCT_27.sections },
  ],
};

/** O aviso de 27/10 fica guardado (quem já o dispensou não o vê de novo); no ar vai o de 03/11, que traz as duas atualizações. */
export const ANNOUNCEMENTS: Announcement[] = [UPDATE_OCT_27, UPDATE_NOV_03];

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
