// Sert le dossier Programme en local, pour essayer l'application dans un navigateur :
//   node outils/servir.mjs [port]        puis http://localhost:8123/
//   http://localhost:8123/?sw            avec le service worker (essai du mode hors ligne et des mises à jour) ;
//                                        sans `?sw`, il est coupé en local pour que chaque modification se voie.
//
// Pourquoi ne pas ouvrir index.html en double-clic : sans adresse http(s), le service worker (mode hors ligne,
// mises à jour) ne s'installe pas. `localhost` est la seule adresse http que les navigateurs traitent comme sûre.
// Sur un téléphone, l'adresse du poste en http ne suffit PAS : pas de service worker, pas d'installation. L'essai
// réel se fait sur l'adresse publiée (https://amdpdev.github.io/fds-calculette/).
//
// Aucun cache côté navigateur : on modifie un fichier, on recharge, on voit la modification.
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const racine = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const port = Number(process.argv[2]) || 8123;
const TYPES = {
  ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml", ".png": "image/png", ".ico": "image/x-icon", ".css": "text/css; charset=utf-8",
};

http.createServer((req, res) => {
  let chemin;
  try { chemin = decodeURIComponent(new URL(req.url, "http://x").pathname); } catch { res.writeHead(400).end(); return; }
  if (chemin.endsWith("/")) chemin += "index.html";
  const fichier = path.resolve(racine, "." + chemin);
  // Jamais en dehors du dossier (ni dans .git, ni dans tests/ ou outils/ : rien de tout cela n'est l'application)
  const rel = path.relative(racine, fichier);
  if (rel.startsWith("..") || path.isAbsolute(rel) || /^(\.git|tests|outils)([\\/]|$)/.test(rel)) { res.writeHead(404).end("Introuvable"); return; }
  fs.readFile(fichier, (err, donnees) => {
    if (err) { res.writeHead(404).end("Introuvable"); return; }
    res.writeHead(200, { "Content-Type": TYPES[path.extname(fichier)] || "application/octet-stream", "Cache-Control": "no-store" });
    res.end(donnees);
  });
}).listen(port, "127.0.0.1", () => console.log("FDS Calculette : http://localhost:" + port + "/  (Ctrl+C pour arrêter)"));
