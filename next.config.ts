import type { NextConfig } from "next";

// cacheComponents/partialPrefetching (padrão do scaffold) desligados: o app é
// autenticado e quase todo dinâmico, então o modelo clássico é mais simples.
// Cabeçalhos de segurança em todas as rotas. Sem CSP completa de propósito: o Next injeta scripts próprios
// e uma política restritiva quebraria a página; aqui só o que é seguro e vale muito (anti-iframe e afins).
const securityHeaders = [
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
];

const nextConfig: NextConfig = {
  // Importação de NF-e e planilhas envia arquivos para uma Server Action (padrão do Next: 1 MB; a Vercel corta em 4,5 MB).
  // O logo do PDF é lido do disco no servidor: sem isto, a Vercel não leva a pasta public junto com a função.
  outputFileTracingIncludes: {
    "/painel/exportar": ["./public/brand/logo-horizontal.png"],
    "/fichas/exportar": ["./public/brand/logo-horizontal.png"],
  },
  experimental: { serverActions: { bodySizeLimit: "4mb" } },
  // URLs antigas (favoritos, links enviados) continuam funcionando depois da reorganização do menu.
  async redirects() {
    const to = (source: string, destination: string) => ({ source, destination, permanent: false });
    return [
      to("/fichas", "/marmitas"),
      to("/fichas/:path*", "/marmitas/:path*"),
      to("/precificacao", "/marmitas"),
      to("/precificacao/ajustes", "/ajustes/impostos"),
      to("/precificacao/:id([0-9a-f-]{36})", "/marmitas/:id/preco"),
      to("/custos/mes", "/mes"),
      to("/custos/estoque", "/mes/estoque"),
      to("/custos/cardapio", "/ajustes/cardapio"),
      to("/custos", "/ajustes/custos"),
      to("/painel/historico", "/mes/historico"),
    ];
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
