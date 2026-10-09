/** "Marmitaria da Ana & Filhos" -> "marmitaria-da-ana-filhos" (sem acento, só a-z, 0-9 e hífen). */
export function slugify(text: string): string {
  const slug = text
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 50);
  return slug.length >= 2 ? slug : "marmitaria";
}
