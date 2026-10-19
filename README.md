# FDS Calculette

Calculette de marge pour **iPhone et Android**, installable sur l'écran d'accueil et utilisable **sans réseau**.
Elle reprend l'onglet « Calcul de marge » de FDS Catalogue (AMDP).

**Application en ligne : https://amdpdev.github.io/fds-calculette/**

## Ce qu'elle fait

- **Marge** : prix de vente, marge, prix d'achat, coefficient et remise sur tarif. Une seule ligne se saisit, les autres se calculent. Estimation du chiffre d'affaires et de la marge totale sur une quantité.
- **Change** : conversion euro, dollar, livre sterling, avec des taux que l'on saisit soi-même.
- **Table** : coefficient à appliquer pour obtenir telle marge.

Coefficient = prix de vente ÷ prix d'achat. Marge = (prix de vente − prix d'achat) ÷ prix de vente. Un coefficient de 1,50 donne une marge de 33,3 %, pas de 50 %. Tous les prix sont HT.

## L'installer

- **iPhone** (Safari) : Partager, puis *Sur l'écran d'accueil*.
- **Android** (Chrome) : menu ⋮, puis *Installer l'application*.

## Données

Tous les calculs se font sur l'appareil : rien n'est envoyé. Seuls les deux taux de change et le mode jour / nuit sont retenus sur l'appareil. **Ce dépôt est public** pour l'hébergement de l'application : n'y mettre aucune donnée réelle (prix, clients, fournisseurs).

## Fichiers

| Fichier | Rôle |
|---|---|
| `index.html` | La page et sa mise en forme |
| `calcul.js` | La logique de calcul, sans interface (essayée par `node --test`) |
| `app.js` | L'écran |
| `sw.js` | Service worker : mode hors ligne et mises à jour |
| `manifest.json`, `icone*.png`, `icone.svg`, `apple-touch-icon.png` | Installation sur l'écran d'accueil |
| `tests/` | Essais de la logique et de la règle de version |
| `outils/servir.mjs` | Serveur local pour essayer la page |
| `outils/fabriquer-icones.mjs` | Fabrique l'icône (« C% » et « FDS ») et ses PNG |

## Travailler dessus

```bash
node --test                       # les essais
node outils/servir.mjs            # http://localhost:8123/  (ajouter ?sw pour essayer le mode hors ligne)
node outils/fabriquer-icones.mjs  # refait l'icône (demande Chrome ou Edge)
```

**Règle de version, obligatoire à chaque modification livrée** : changer ensemble `VERSION` et `DATE_VERSION` dans `app.js` **et** `CACHE_VERSION` dans `sw.js` (`fdscalc-v1` devient `fdscalc-v2`). Sans le second, les téléphones déjà installés gardent l'ancienne version sans aucun message. `node --test` vérifie que les deux numéros concordent. Un fichier ajouté à `index.html` doit aussi entrer dans `PRECACHE_URLS` de `sw.js` (le même essai le vérifie).
