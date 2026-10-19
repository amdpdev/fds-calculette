// Garde-fou de la règle de version : app.js (ce que l'écran affiche) et sw.js (ce qui déclenche la mise à jour
// sur les téléphones) doivent porter le même numéro, et le service worker doit mettre en cache tout ce que
// charge index.html. Sans cela, une mise à jour n'arrive jamais sur les appareils déjà installés.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

const lire = f => fs.readFileSync(new URL("../" + f, import.meta.url), "utf8");

test("VERSION (app.js) et CACHE_VERSION (sw.js) concordent", () => {
  const v = lire("app.js").match(/const VERSION = "(\d+)"/)?.[1];
  const c = lire("sw.js").match(/CACHE_VERSION = 'fdscalc-v(\d+)'/)?.[1];
  assert.ok(v, "VERSION introuvable dans app.js");
  assert.ok(c, "CACHE_VERSION introuvable dans sw.js");
  assert.equal(v, c, `app.js dit version ${v}, sw.js dit fdscalc-v${c} : les changer ensemble`);
});

test("tout ce que charge index.html est dans le précache", () => {
  const html = lire("index.html"), sw = lire("sw.js");
  const precache = [...sw.matchAll(/'\.\/([^']*)'/g)].map(m => m[1]);
  const charges = [
    ...[...html.matchAll(/<script src="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<link rel="(?:manifest|icon|apple-touch-icon)"[^>]*href="([^"]+)"/g)].map(m => m[1]),
    ...[...html.matchAll(/<img src="([^"]+)"/g)].map(m => m[1]),
  ];
  assert.ok(charges.length >= 5, "peu de ressources repérées : le motif a-t-il changé ?");
  for (const f of charges) assert.ok(precache.includes(f), `${f} est chargé par index.html mais absent du précache`);
});

test("chaque fichier du précache existe", () => {
  const sw = lire("sw.js");
  for (const m of sw.matchAll(/'\.\/([^']+)'/g)) {
    if (m[1] === "") continue;
    assert.ok(fs.existsSync(new URL("../" + m[1], import.meta.url)), `${m[1]} est dans le précache mais absent du dossier`);
  }
});

test("le manifeste pointe sur des icônes qui existent", () => {
  const man = JSON.parse(lire("manifest.json"));
  for (const i of man.icons) assert.ok(fs.existsSync(new URL("../" + i.src, import.meta.url)), `${i.src} introuvable`);
  assert.ok(man.icons.some(i => i.sizes === "192x192" && i.purpose === "any"), "icône 192 manquante (Android)");
  assert.ok(man.icons.some(i => i.sizes === "512x512" && i.purpose === "any"), "icône 512 manquante (Android)");
  assert.ok(man.icons.some(i => i.purpose === "maskable"), "icône adaptative manquante (Android)");
});
