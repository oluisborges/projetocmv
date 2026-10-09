import type { MetadataRoute } from "next";

/** App privado (dados de negócio dos clientes): nada aqui deve aparecer em buscadores. */
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
