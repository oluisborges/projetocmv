import type { NextConfig } from "next";

// cacheComponents/partialPrefetching (padrão do scaffold) desligados: o app é
// autenticado e quase todo dinâmico, então o modelo clássico é mais simples.
const nextConfig: NextConfig = {
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
