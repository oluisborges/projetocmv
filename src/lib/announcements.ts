// Avisos de novidade (o modal que aparece depois de uma atualização).
// Para lançar um aviso: acrescente-o em ANNOUNCEMENTS e troque ACTIVE_ANNOUNCEMENT_ID pelo id dele.
// Com ACTIVE_ANNOUNCEMENT_ID = null nenhum cliente vê nada; o admin Shogun pode ver o rascunho abrindo qualquer tela com ?aviso=ver.
// No ar desde a atualização de menus e receitas (novidades-2026-10).

/** Textos aceitam **negrito**. `highlight` + `badge`: bloco em destaque (ex.: o que vem aí). */
export type AnnouncementSection = { icon: string; title: string; body: string; bullets?: string[]; /** frase depois da lista */ after?: string; highlight?: boolean; badge?: string };

export type Announcement = {
  /** Identifica o aviso: quem marcou "não mostrar mais" não volta a ver ESTE aviso (um aviso novo, com outro id, volta a aparecer). */
  id: string;
  title: string;
  intro: string;
  sections: AnnouncementSection[];
};

/** Aviso que está no ar para todos. `null` = nenhum. Só trocar quando o dono do projeto pedir. */
export const ACTIVE_ANNOUNCEMENT_ID: string | null = "novidades-2026-10";

/** O aviso que está sendo preparado (visível só para o admin, com ?aviso=ver). */
export const DRAFT_ANNOUNCEMENT_ID = "novidades-2026-10";

export const ANNOUNCEMENTS: Announcement[] = [
  {
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
  },
];

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
