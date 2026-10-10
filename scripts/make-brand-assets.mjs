// Gera os arquivos de marca (PNG) a partir das logos originais enviadas pela Shogun.
// Uso: node scripts/make-brand-assets.mjs <capacete.webp> <logo-empilhada.webp> <logo-vertical.webp>
// Os originais não ficam no repositório; só os PNGs gerados em public/brand e src/app.
import sharp from "sharp";
import { mkdirSync } from "node:fs";

const [helmetSrc, stackedSrc, verticalSrc] = process.argv.slice(2);
if (!helmetSrc || !stackedSrc || !verticalSrc) {
  console.error("Uso: node scripts/make-brand-assets.mjs <capacete> <logo-empilhada> <logo-vertical>");
  process.exit(1);
}

const WHITE = { r: 255, g: 255, b: 255, alpha: 1 };
mkdirSync("public/brand", { recursive: true });

const trimmed = async (src) => sharp(src).trim({ background: "#ffffff", threshold: 12 }).png().toBuffer();

// Capacete: ícone do app, favicon, atalho na tela inicial do celular.
const helmet = await trimmed(helmetSrc);
const hm = await sharp(helmet).metadata();
console.log("capacete recortado:", hm.width, "x", hm.height, "alpha:", hm.hasAlpha);

/** Capacete centralizado num quadrado branco, com `pad` de margem (0.08 = 8% de cada lado). */
const place = async (size, pad, file) => {
  const input = await sharp(helmet).resize({ width: Math.round(size * (1 - pad * 2)), height: Math.round(size * (1 - pad * 2)), fit: "inside" }).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: WHITE } })
    .composite([{ input, gravity: "center" }])
    .png()
    .toFile(file);
  console.log("ok", file);
};

await place(512, 0.08, "src/app/icon.png");
await place(180, 0.1, "src/app/apple-icon.png");
await place(192, 0.08, "public/brand/icon-192.png");
await place(512, 0.08, "public/brand/icon-512.png");
await place(512, 0.22, "public/brand/icon-maskable-512.png"); // margem maior: o Android recorta em círculo

// Capacete sem fundo branco quadrado, para o topo do app (altura pequena, nítido em tela retina).
await sharp(helmet).resize({ height: 160 }).png().toFile("public/brand/helmet.png");
console.log("ok public/brand/helmet.png");

// Logo completa (capacete + SHOGUN GRUPO) para a tela de login.
const stacked = await trimmed(stackedSrc);
await sharp(stacked).resize({ width: 560 }).png().toFile("public/brand/logo-stacked.png");
console.log("ok public/brand/logo-stacked.png");

const vertical = await trimmed(verticalSrc);
await sharp(vertical).resize({ height: 640 }).png().toFile("public/brand/wordmark-vertical.png");
console.log("ok public/brand/wordmark-vertical.png");
