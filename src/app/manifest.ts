import type { MetadataRoute } from "next";

/** Permite "Adicionar à tela inicial" no celular: o app abre em tela cheia, como um aplicativo. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Shogun Precificação",
    short_name: "Shogun",
    description: "Custo, margem e preço certo do que você vende",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#f5f7f3",
    theme_color: "#1c3b33",
    lang: "pt-BR",
    icons: [
      { src: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/brand/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/brand/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
