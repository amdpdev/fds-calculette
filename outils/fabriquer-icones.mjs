// ─────────────────────────────────────────────────────────────────────────────
// Fabrique les icônes de FDS Calculette : « C% » en grand, « FDS » en petit, blanc sur
// le bleu du logo de FDS Catalogue (44, 110, 190).
//
//   node outils/fabriquer-icones.mjs            écrit icone.svg et les PNG dans le dossier parent
//   node outils/fabriquer-icones.mjs --apercu   écrit aussi apercu-icones.png (les formats côte à côte)
//
// Le dessin est fait de TRACÉS (arcs, traits), jamais de texte : une police varie d'un appareil
// à l'autre, un tracé est identique partout. Même raison pour laquelle le logo de FDS Catalogue est géométrique.
//
// Les PNG sont rendus par Chrome en mode sans fenêtre (installé sur le poste, rien à ajouter).
// Quatre sorties, quatre usages — ne pas en supprimer une en croyant à un doublon :
//   icone.svg                favicon et icône « any » du manifeste (coins arrondis)
//   icone-192.png / -512.png Android : icônes « any » du manifeste (coins arrondis, fond transparent)
//   icone-maskable-512.png   Android adaptatif : plein cadre, dessin réduit pour tenir dans la zone
//                            de sécurité (cercle de 40 % du côté), le système découpe lui-même la forme
//   apple-touch-icon.png     iPhone : 180 × 180 PLEIN CADRE, sans transparence (iOS arrondit lui-même
//                            et noircit toute transparence)
// ─────────────────────────────────────────────────────────────────────────────
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";

const dossier = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const CHROME = [
  "C:/Program Files/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Google/Chrome/Application/chrome.exe",
  "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe",
].find(p => fs.existsSync(p));

const BLEU = "#2c6ebe";     // le bleu du logo de FDS Catalogue
const BLANC = "#ffffff";

// Le dessin, en coordonnées 0..100. Centré sur (50, 50) à l'œil, dans le cercle de sécurité.
//   « C »  : arc ouvert à droite, trait épais
//   « % »  : deux anneaux et une barre oblique
//   « FDS »: trois lettres de 10 de haut, tracées au trait
const GLYPHE = `
  <g transform="translate(5.2 -3.5)">
    <path d="M41.6 35.4 A15 15 0 1 0 41.6 56.6" stroke-width="7.6"/>
    <circle cx="60.2" cy="36.5" r="4.6" stroke-width="4.3"/>
    <circle cx="71.2" cy="56" r="4.6" stroke-width="4.3"/>
    <line x1="73.7" y1="28" x2="57.7" y2="64" stroke-width="4.9"/>
  </g>
  <g stroke-width="2.8">
    <path d="M42.9 68.5 H36.9 V78.5 M36.9 73.1 H41.9"/>
    <path d="M46.3 68.5 V78.5 H49.3 A4 5 0 0 0 49.3 68.5 Z"/>
    <path d="M62.7 70.6 C62.3 69.1 61.1 68.5 59.9 68.5 C58.1 68.5 57 69.6 57 70.9 C57 72.7 58.9 73 59.9 73.5 C61 74 62.8 74.4 62.8 76.1 C62.8 77.5 61.6 78.5 59.9 78.5 C58.3 78.5 57.2 77.7 56.9 76.3"/>
  </g>`;

// `rayon` : coins arrondis (0 = plein cadre). `reduction` : échelle du dessin autour du centre.
function svg({ taille = 100, rayon = 0, reduction = 1 }) {
  const t = reduction === 1 ? "" : ` transform="translate(50 50) scale(${reduction}) translate(-50 -50)"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${taille}" height="${taille}" viewBox="0 0 100 100">`
    + `<rect width="100" height="100"${rayon ? ` rx="${rayon}"` : ""} fill="${BLEU}"/>`
    + `<g fill="none" stroke="${BLANC}" stroke-linecap="round" stroke-linejoin="round"${t}>${GLYPHE}\n</g></svg>`;
}

// Un PNG de `taille` pixels : Chrome ouvre une page qui ne contient que le SVG et la photographie.
function png(contenuSvg, taille, sortie, transparent) {
  if (!CHROME) throw new Error("Ni Chrome ni Edge trouvé : impossible de rendre les PNG");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "icones-"));
  const page = path.join(tmp, "p.html");
  fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><style>html,body{margin:0;background:transparent}svg{display:block}</style>${contenuSvg}`);
  const r = spawnSync(CHROME, [
    "--headless=new", "--disable-gpu", "--hide-scrollbars", "--no-first-run",
    "--force-device-scale-factor=1", `--window-size=${taille},${taille}`,
    ...(transparent ? ["--default-background-color=00000000"] : []),
    `--screenshot=${sortie}`, pathToFileURL(page).href,
  ], { stdio: "ignore", timeout: 60000 });
  fs.rmSync(tmp, { recursive: true, force: true });
  if (r.status !== 0 || !fs.existsSync(sortie)) throw new Error("Chrome n'a pas produit " + sortie);
  // Le PNG doit faire exactement taille × taille : on le lit dans l'en-tête IHDR.
  const b = fs.readFileSync(sortie);
  const w = b.readUInt32BE(16), h = b.readUInt32BE(20);
  if (w !== taille || h !== taille) throw new Error(`${path.basename(sortie)} : ${w}×${h} au lieu de ${taille}×${taille}`);
  return b.length;
}

const sorties = [
  ["icone-192.png",          svg({ taille: 192, rayon: 22 }),                 192, true],
  ["icone-512.png",          svg({ taille: 512, rayon: 22 }),                 512, true],
  ["icone-maskable-512.png", svg({ taille: 512, reduction: 0.86 }),           512, false],
  ["apple-touch-icon.png",   svg({ taille: 180 }),                            180, false],
];

fs.writeFileSync(path.join(dossier, "icone.svg"), svg({ rayon: 22 }) + "\n");
console.log("icone.svg");
for (const [nom, contenu, taille, transp] of sorties) {
  const o = png(contenu, taille, path.join(dossier, nom), transp);
  console.log(nom.padEnd(24), taille + "×" + taille, o + " octets");
}

if (process.argv.includes("--apercu")) {
  // Les formats côte à côte, sur un damier gris : on y voit la transparence des coins et la
  // découpe d'une icône adaptative (cercle, carré arrondi) sur l'icône plein cadre.
  const cases = [
    ["icone.svg 120", svg({ taille: 120, rayon: 22 })],
    ["iPhone 120", `<div style="border-radius:27px;overflow:hidden;width:120px;height:120px">${svg({ taille: 120 })}</div>`],
    ["Android cercle", `<div style="border-radius:50%;overflow:hidden;width:120px;height:120px">${svg({ taille: 120, reduction: 0.86 })}</div>`],
    ["Android carré arrondi", `<div style="border-radius:30%;overflow:hidden;width:120px;height:120px">${svg({ taille: 120, reduction: 0.86 })}</div>`],
    ["60 px", svg({ taille: 60, rayon: 22 })],
    ["32 px", svg({ taille: 32, rayon: 22 })],
    ["16 px", svg({ taille: 16, rayon: 22 })],
  ];
  const html = cases.map(([n, s]) => `<figure style="margin:0;text-align:center;font:12px sans-serif;color:#333">${s}<figcaption>${n}</figcaption></figure>`).join("");
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "apercu-"));
  const page = path.join(tmp, "a.html");
  fs.writeFileSync(page, `<!doctype html><meta charset="utf-8"><body style="margin:0;padding:20px;display:flex;gap:22px;align-items:flex-end;`
    + `background:repeating-conic-gradient(#d8d8d8 0 25%,#f4f4f4 0 50%) 0 0/20px 20px">${html}</body>`);
  const sortie = path.join(dossier, "apercu-icones.png");
  spawnSync(CHROME, ["--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
    "--window-size=1000,200", `--screenshot=${sortie}`, pathToFileURL(page).href], { stdio: "ignore", timeout: 60000 });
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log("apercu-icones.png (à ne pas versionner)");
}
