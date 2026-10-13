/**
 * Nome "normalizado" para comparar insumos: minúsculas, sem acento e sem espaços sobrando. Tem que dar o mesmo
 * resultado que `private.norm_name` no banco (a regra de nome repetido vale nos dois lugares).
 * "Arroz branco" e "arroz  BRANCO " são o mesmo insumo; "Arroz branco Tio João" é outro (marca diferente).
 */
export function normalizeName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[áàâãä]/g, "a")
    .replace(/[éèêë]/g, "e")
    .replace(/[íìîï]/g, "i")
    .replace(/[óòôõö]/g, "o")
    .replace(/[úùûü]/g, "u")
    .replace(/ç/g, "c")
    .replace(/ñ/g, "n")
    .replace(/\s+/g, " ")
    .trim();
}
