// Gera os PNGs da marca Precificaí a partir dos SVGs em public/brand (que vêm do design system).
// Uso: node scripts/make-brand-assets.mjs
import sharp from "sharp";
import { copyFileSync, readFileSync } from "node:fs";

const TEAL = "#0F766E";
const svg = (name) => readFileSync(`public/brand/${name}.svg`);
const png = (buf, size, file, opts = {}) => sharp(buf, { density: 384 }).resize(size).png(opts).toFile(file).then(() => console.log("ok", file));

// Ícones do app (Android/iOS/aba do navegador): o tile arredondado do design system.
await png(svg("icone-app-teal"), { width: 192, height: 192 }, "public/brand/icon-192.png");
await png(svg("icone-app-teal"), { width: 512, height: 512 }, "public/brand/icon-512.png");
await png(svg("icone-app-teal"), { width: 512, height: 512 }, "src/app/icon.png");

// iOS não aceita transparência: tile cheio, o próprio iOS arredonda.
const tile = await sharp(svg("icone-app-teal"), { density: 384 }).resize(144, 144).png().toBuffer();
await sharp({ create: { width: 180, height: 180, channels: 4, background: TEAL } })
  .composite([{ input: tile, gravity: "center" }])
  .png()
  .toFile("src/app/apple-icon.png");
console.log("ok src/app/apple-icon.png");

// Maskable: fundo teal até a borda e símbolo na zona segura (o Android recorta em círculo).
const inner = await sharp(svg("icone-app-teal"), { density: 384 }).resize(380, 380).png().toBuffer();
await sharp({ create: { width: 512, height: 512, channels: 4, background: TEAL } })
  .composite([{ input: inner, gravity: "center" }])
  .png()
  .toFile("public/brand/icon-maskable-512.png");
console.log("ok public/brand/icon-maskable-512.png");

// Logo em PNG: o gerador de imagem do cartão compartilhável lê do disco.
await png(svg("logo-horizontal"), { width: 1200 }, "public/brand/logo-horizontal.png");
await png(svg("logo-powered-by-shogun"), { width: 1200 }, "public/brand/logo-powered-by-shogun.png");

// Aba do navegador: o SVG pequeno e reforçado do design system.
copyFileSync("public/brand/favicon.svg", "src/app/icon.svg");
console.log("ok src/app/icon.svg");
