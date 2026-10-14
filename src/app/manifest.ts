import type { MetadataRoute } from "next";

/** Permite "Adicionar à tela inicial" no celular: o app abre em tela cheia, como um aplicativo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Precificaí",
    short_name: "Precificaí",
    description: "Descubra quanto você ganha em cada produto: custo, margem e preço certo.",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#fafaf9",
    theme_color: "#0f766e",
    lang: "pt-BR",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
