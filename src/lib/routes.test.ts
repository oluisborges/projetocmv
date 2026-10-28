// @vitest-environment node
// Todo link interno do app precisa levar a uma página que existe (ou a um redirect declarado).
// Evita o erro clássico de reorganizar o menu e deixar um botão apontando para o nada.
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");
const APP = path.join(SRC, "app");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of fs.readdirSync(dir)) {
    const full = path.join(dir, name);
    if (fs.statSync(full).isDirectory()) walk(full, out);
    else out.push(full);
  }
  return out;
}

/** Rotas reais: pastas com page.tsx/route.ts(x) (grupos "(app)" não contam; "[x]" é parâmetro). */
function realRoutes(): string[] {
  return walk(APP)
    .filter((f) => /[\\/](page\.tsx|route\.tsx?)$/.test(f))
    .map((f) => {
      const rel = path.relative(APP, path.dirname(f)).split(path.sep).filter((seg) => !/^\(.*\)$/.test(seg));
      return "/" + rel.join("/");
    })
    .map((r) => (r === "/." ? "/" : r));
}

const routes = realRoutes();
const toRegex = (route: string) => new RegExp("^" + route.replace(/\[[^\]]+\]/g, "[^/]+").replace(/\//g, "\\/") + "$");
const matchers = routes.map(toRegex);

/** Redirects declarados no next.config.ts: [origem, destino]. */
function declaredRedirects(): { source: RegExp }[] {
  const text = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf-8");
  return [...text.matchAll(/to\("([^"]+)",\s*"([^"]+)"\)/g)].map((m) => ({
    source: new RegExp(
      "^" +
        m[1]
          .replace(/:[a-z]+\(\[[^)]+\)\{?\d*\}?\)?/gi, "[^/]+")
          .replace(/\/:path\*/g, "(\\/.*)?")
          .replace(/:[a-z]+/gi, "[^/]+")
          .replace(/\//g, "\\/") +
        "$",
    ),
  }));
}

/** Caminhos internos escritos como texto em href=, redirect(, revalidatePath( e router.push(. */
function internalLinks(): { file: string; link: string }[] {
  const files = walk(SRC).filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f) && !f.includes(`${path.sep}lib${path.sep}routes`));
  const found: { file: string; link: string }[] = [];
  const re = /(?:href=\{?[`"']|redirect\(\s*[`"']|revalidatePath\(\s*[`"']|router\.push\(\s*[`"']|href:\s*[`"'])(\/[a-z0-9\-_/[\]${}.]*)/gi;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf-8");
    for (const m of text.matchAll(re)) {
      const raw = m[1];
      // Interpolações viram um segmento qualquer.
      const normalized = raw.replace(/\$\{[^}]*\}/g, "x");
      found.push({ file: path.relative(process.cwd(), file).replace(/\\/g, "/"), link: normalized.replace(/\/+$/, "") || "/" });
    }
  }
  return found;
}

describe("links internos", () => {
  const redirects = declaredRedirects();
  const links = internalLinks();

  it("o app tem as rotas esperadas do menu novo", () => {
    for (const r of ["/", "/marmitas", "/marmitas/[id]", "/marmitas/[id]/preco", "/insumos/receitas/nova", "/insumos/receitas/[id]", "/producao", "/producao/calcular", "/producao/estoque", "/insumos", "/mes", "/mes/estoque", "/mes/historico", "/painel", "/custos", "/custos/impostos", "/custos/cardapio", "/avisos"]) {
      expect(routes, `falta a rota ${r}`).toContain(r);
    }
  });

  it("nenhuma rota do menu antigo continua existindo como página (viraram redirects)", () => {
    for (const r of ["/fichas", "/precificacao", "/ajustes", "/ajustes/custos", "/custos/mes", "/custos/estoque", "/painel/historico"]) {
      expect(routes, `a rota antiga ${r} ainda existe`).not.toContain(r);
    }
  });

  it("todo link interno vai para uma rota que existe", () => {
    const broken = links.filter(({ link }) => {
      const path = link.split("?")[0].split("#")[0];
      if (path.startsWith("/api/") && routes.some((r) => toRegex(r).test(path))) return false;
      return !matchers.some((re) => re.test(path)) && !redirects.some((r) => r.source.test(path));
    });
    expect(
      broken.map((b) => `${b.file} -> ${b.link}`),
      "links quebrados",
    ).toEqual([]);
  });

  it("nenhum link do código aponta mais para as URLs antigas (só os redirects as conhecem)", () => {
    const old = links.filter(({ link }) => /^\/(fichas|precificacao|ajustes)(\/|$)/.test(link) || /^\/custos\/(mes|estoque)/.test(link) || link === "/painel/historico");
    expect(
      old.map((b) => `${b.file} -> ${b.link}`),
      "links para URLs antigas",
    ).toEqual([]);
  });

  it("todo destino de redirect do next.config.ts é uma rota que existe", () => {
    const text = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf-8");
    const destinations = [...text.matchAll(/to\("([^"]+)",\s*"([^"]+)"\)/g)].map((m) => m[2]);
    expect(destinations.length).toBeGreaterThan(5);
    const broken = destinations.filter((d) => {
      const concrete = d.replace(/:path\*/g, "x").replace(/:[a-z]+/gi, "x");
      return !matchers.some((re) => re.test(concrete));
    });
    expect(broken, "redirects que levam a uma rota inexistente").toEqual([]);
  });

  it("toda chave de outputFileTracingIncludes é uma rota que existe (o logo do PDF depende disso na Vercel)", () => {
    const text = fs.readFileSync(path.join(process.cwd(), "next.config.ts"), "utf-8");
    const block = text.match(/outputFileTracingIncludes:\s*\{([\s\S]*?)\},\s*experimental/)?.[1] ?? "";
    const keys = [...block.matchAll(/"(\/[^"]+)":/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(0);
    const missing = keys.filter((k) => !routes.includes(k));
    expect(missing, "chaves que não são rotas").toEqual([]);
  });

  it("os links base dos botões de exportar apontam para rotas de verdade", () => {
    const bases = walk(SRC)
      .filter((f) => /\.tsx$/.test(f) && !/\.test\./.test(f))
      .flatMap((f) => [...fs.readFileSync(f, "utf-8").matchAll(/ExportLinks[^>]*base="(\/[^"]+)"/g)].map((m) => m[1]));
    expect(bases.length).toBeGreaterThan(1);
    expect(bases.filter((b) => !routes.includes(b))).toEqual([]);
  });
});
