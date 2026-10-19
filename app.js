// ─────────────────────────────────────────────────────────────────────────────
// FDS Calculette — l'écran. Toute la logique de calcul est dans calcul.js (essayée en ligne de commande).
//
// RÈGLE DE VERSION (même règle que Scan BL) : à chaque modification livrée, changer EN MÊME TEMPS
//   1. VERSION et DATE_VERSION ci-dessous,
//   2. CACHE_VERSION dans sw.js (« fdscalc-v1 » → « fdscalc-v2 »…).
// Sans le second, les téléphones déjà installés continuent de servir l'ancienne version depuis leur
// cache, sans aucun message d'erreur. `node --test` vérifie que les deux numéros concordent.
// ─────────────────────────────────────────────────────────────────────────────
(function () {
  "use strict";
  const C = window.Calcul;
  const VERSION = "2";
  const DATE_VERSION = "19/10/2026";

  const $ = id => document.getElementById(id);

  // Mémoire de l'appareil. Lire ou écrire peut LEVER une exception (navigation privée, données de site
  // bloquées) : on essaie, et si ça ne marche pas, tant pis — rien ici ne vaut qu'on fasse tomber l'écran.
  const memoire = {
    lire(cle, defaut) { try { const v = localStorage.getItem(cle); return v === null ? defaut : v; } catch (e) { return defaut; } },
    ecrire(cle, v) { try { localStorage.setItem(cle, v); } catch (e) { /* tant pis */ } },
  };
  // Les saisies en cours survivent à un rechargement (iOS décharge volontiers une application restée en
  // arrière-plan) mais pas à sa fermeture volontaire : sessionStorage, pas localStorage. Rien ne reste d'un jour à l'autre.
  const session = {
    lire() { try { return JSON.parse(sessionStorage.getItem("fdscalc_etat") || "null"); } catch (e) { return null; } },
    ecrire(v) { try { sessionStorage.setItem("fdscalc_etat", JSON.stringify(v)); } catch (e) { /* tant pis */ } },
  };

  // ── État : TOUT ce qui est saisi, en texte (comme dans les champs) ─────────────
  // Calculateur : le tarif, puis deux chaînes. ACHAT : la remise fournisseur (`remF`) ou le prix d'achat (`pa`) est
  // saisi, `achatPilote` dit lequel. VENTE : une seule des lignes pv / marge / coef / remise (remise CLIENT) est saisie,
  // `pilote` dit laquelle et `saisie` en porte le texte.
  const etat = Object.assign({
    tarif: "", remF: "", pa: "", achatPilote: "pa",
    pilote: "coef", saisie: "", qte: "",
    mDev: "EUR", mTexte: "",                                      // change : la ligne saisie et son montant
  }, session.lire() || {});
  etat.usd = memoire.lire("fdscalc_taux_usd", "1,17");            // dollars pour 1 €
  etat.gbp = memoire.lire("fdscalc_taux_gbp", "0,87");            // livres pour 1 € (valeur d'amorçage)
  const sauver = () => session.ecrire({ tarif: etat.tarif, remF: etat.remF, pa: etat.pa, achatPilote: etat.achatPilote,
    pilote: etat.pilote, saisie: etat.saisie, qte: etat.qte, mDev: etat.mDev, mTexte: etat.mTexte });
  const entreesCalcul = () => ({ tarif: etat.tarif, achatPilote: etat.achatPilote, remF: etat.remF, pa: etat.pa,
    pilote: etat.pilote, saisie: etat.saisie });

  // ── Fabrication des lignes ──────────────────────────────────────────────────
  // Une ligne de saisie : libellé, définition, étiquette d'état (« vous saisissez » / « calculé »), champ, unité.
  function ligneHtml({ id, lib, def, unite }) {
    return '<div class="ligne" id="l-' + id + '">'
      + '<div class="ligne-tete"><label for="' + id + '">' + lib + (def ? "<small>" + def + "</small>" : "") + "</label>"
      + '<span class="tag" id="t-' + id + '"></span></div>'
      + '<div class="champ"><input id="' + id + '" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off"'
      + ' autocapitalize="off" autocorrect="off" spellcheck="false" placeholder="0">'
      + (unite ? '<span class="unite">' + unite + "</span>" : "") + "</div></div>";
  }
  // Un titre de groupe, dans le cadre jaune : il dit ce que fait le groupe et ce qu'on y saisit.
  const groupe = (titre, aide) => '<div class="groupe"><b>' + titre + "</b>" + (aide ? "<span>" + aide + "</span>" : "") + "</div>";
  // L'organisation suit le raisonnement, de haut en bas : le TARIF, puis l'ACHAT (ce que l'on paie), puis la VENTE
  // (ce que l'on facture). Dans l'achat et dans la vente, on saisit UNE seule ligne, les autres se calculent — comme dans
  // l'onglet Calcul de marge de FDS Catalogue. Le tarif sert aux deux remises : la remise fournisseur donne le prix
  // d'achat, la remise client donne le prix de vente.
  $("lignes").innerHTML =
    groupe("Tarif", "Le tarif du fournisseur. Il sert aux deux remises ; inutile si vous partez du prix d'achat.")
    + ligneHtml({ id: "tarif", lib: "Tarif catalogue", def: "", unite: "€" })
    + groupe("Achat · ce que vous payez", "Saisissez la remise fournisseur OU le prix d'achat.")
    + ligneHtml({ id: "remF", lib: "Remise fournisseur", def: "achat = tarif − remise", unite: "%" })
    + ligneHtml({ id: "pa", lib: "Prix d'achat HT", def: "", unite: "€" })
    + groupe("Vente · ce que vous facturez", "Saisissez UNE seule ligne : marge, coefficient, remise client ou prix de vente.")
    + ligneHtml({ id: "marge", lib: "Marge", def: "(vente − achat) ÷ vente", unite: "%" })
    + ligneHtml({ id: "coef", lib: "Coefficient", def: "vente ÷ achat" })
    + ligneHtml({ id: "remise", lib: "Remise client", def: "vente = tarif − remise", unite: "%" })
    + ligneHtml({ id: "pv", lib: "Prix de vente HT", def: "", unite: "€" });
  $("ligne-qte").innerHTML = ligneHtml({ id: "qte", lib: "Quantité", def: "" });
  $("lignes-montant").innerHTML = [
    { id: "mEUR", lib: "Montant en euros",   def: "", unite: "€" },
    { id: "mUSD", lib: "Montant en dollars", def: "", unite: "$" },
    { id: "mGBP", lib: "Montant en livres",  def: "", unite: "£" },
  ].map(ligneHtml).join("");

  // Les deux taux : un champ et, à droite du libellé, un lien vers le cours du jour. Une ancre, pas window.open :
  // appui long et « ouvrir dans… » marchent. Aucune donnée ne part, on y lit le cours et on le recopie à la main.
  function tauxHtml(id, lib, unite, href) {
    return '<div class="ligne champ-taux actif" id="l-' + id + '"><div class="ligne-tete"><label for="' + id + '">' + lib + "</label>"
      + '<a class="lien" href="' + href + '" target="_blank" rel="noopener noreferrer">Taux du jour ↗</a></div>'
      + '<div class="champ"><input id="' + id + '" type="text" inputmode="decimal" enterkeyhint="done" autocomplete="off" spellcheck="false" placeholder="0">'
      + '<span class="unite">' + unite + "</span></div></div>";
  }
  $("lignes-taux").innerHTML =
    tauxHtml("usd", "Taux du dollar", "$ pour 1 €", "https://www.google.com/search?q=euro+dollar")
    + tauxHtml("gbp", "Taux de la livre sterling", "£ pour 1 €", "https://www.google.com/search?q=euro+livre+sterling");

  // Table coefficient ↔ marge : une ligne = un bouton, qui reporte le coefficient dans le calcul.
  const lignesTable = C.tableCoefMarge();
  // Le coefficient s'affiche toujours à deux décimales (« 1,20 », pas « 1,2 ») : une colonne de chiffres se lit mieux alignée.
  $("table").innerHTML = '<div class="tete"><span>Marge souhaitée</span><span>Coefficient</span></div>'
    + lignesTable.map((l, i) => '<button type="button" data-i="' + i + '"' + (i >= 41 ? ' class="rond"' : "") + "><span>"
      + C.pct(l.marge) + "</span><b>" + l.coef.toFixed(2).replace(".", ",") + "</b></button>").join("");

  // ── Affichage ───────────────────────────────────────────────────────────────
  // Poser une valeur sans réécrire un champ qui la porte déjà : sinon le curseur saute pendant la frappe.
  const poser = (id, v) => { const el = $(id); if (el.value !== v) el.value = v; };
  const etiquette = (id, actif, texte) => {
    $("l-" + id).classList.toggle("actif", actif);
    $("t-" + id).textContent = texte;
  };
  const message = (texte, genre) => { const m = $("message"); m.textContent = texte; m.className = "message" + (genre ? " " + genre : ""); };
  const TAUX = () => C.tauxDepuisTextes(etat.usd, etat.gbp);
  const SYMBOLE = { EUR: "€", USD: "$", GBP: "£" };

  function render() {
    // 1. Calculateur
    const r = C.calculer(entreesCalcul());
    // Une ligne qui pilote montre le texte saisi tel quel ; les autres, la valeur calculée.
    const vente = (id, calcule) => poser(id, etat.pilote === id ? etat.saisie : calcule);
    vente("pv", C.ecrirePrix(r.pvC));
    vente("marge", C.ecrire(r.marge === null ? null : r.marge * 100, 2));
    vente("coef", C.ecrire(r.coef, 4));
    vente("remise", C.ecrire(r.remiseEq === null ? null : r.remiseEq * 100, 2));
    const parRemF = etat.achatPilote === "remF";
    poser("remF", parRemF ? etat.remF : C.ecrire(r.remFEq === null ? null : r.remFEq * 100, 2));
    poser("pa", parRemF ? C.ecrirePrix(r.paN) : etat.pa);
    poser("tarif", etat.tarif); poser("qte", etat.qte);

    // Étiquettes. Une remise qui sort négative n'est pas une erreur : c'est un prix au-dessus du tarif, on le dit.
    const calcule = (neg, negTexte) => neg ? "calculé · " + negTexte : "calculé";
    ["pv", "marge", "coef"].forEach(id => etiquette(id, etat.pilote === id, etat.pilote === id ? "✎ vous saisissez" : "calculé"));
    etiquette("remise", etat.pilote === "remise",
      etat.pilote === "remise" ? "✎ vous saisissez"
        : !r.baseOk ? "tarif à renseigner" : calcule(r.remiseEq !== null && r.remiseEq < 0, "majoration"));
    etiquette("remF", parRemF, parRemF ? "✎ vous saisissez"
      : !r.baseOk ? "tarif à renseigner" : calcule(r.remFEq !== null && r.remFEq < 0, "achat au-dessus du tarif"));
    etiquette("pa", !parRemF, !parRemF ? "✎ vous saisissez" : "calculé");
    // Le tarif est à renseigner dès qu'une remise pilote ; sinon il est facultatif.
    const tarifRequis = parRemF || etat.pilote === "remise";
    etiquette("tarif", tarifRequis, tarifRequis ? "✎ à renseigner" : "facultatif");
    etiquette("qte", true, "✎ à renseigner");

    // Résultats : le cadre vert, collé en haut. Prix d'achat et prix de vente, les deux bouts de la chaîne.
    $("r-pa").textContent = r.paN === null ? "—" : C.euros(r.paN) + " €";
    $("r-pv").textContent = r.pvC === null ? "—" : C.euros(r.pvC) + " €";
    $("r-marge").textContent = C.pct(r.marge);
    $("r-gain").textContent = r.gain === null ? "—" : C.euros(r.gain) + " €";

    // Ce qui manque, dit en clair plutôt que des tirets muets. L'achat d'abord (la vente en dépend). Rien de saisi : ton neutre, pas d'alerte.
    const rienSaisi = etat.tarif === "" && etat.pa === "" && etat.remF === "" && etat.saisie === "";
    if (r.margeImpossible) message("Une marge de 100 % ou plus est impossible : le prix de vente serait infini.", "erreur");
    else if (r.manqueAchat) message(r.manqueAchat, rienSaisi || (etat.remF === "" && etat.tarif === "") ? "" : "alerte");
    else if (r.manque) message(r.manque, rienSaisi ? "" : "alerte");
    else if (r.indice) message(r.indice, "");
    else message("Attention : un coefficient de 1,50 donne une marge de 33,3 %, pas de 50 %.", "");

    // Sur une quantité
    const s = C.simuler(etat.qte, r.pvC, r.paN);
    $("s-ca").textContent = s ? C.euros(s.ca) + " €" : "—";
    $("s-cout").textContent = s ? C.euros(s.cout) + " €" : "—";
    $("s-marge").textContent = s ? C.euros(s.marge) + " €" : "—";

    // 2. Change : on tape dans la ligne de son choix, les deux autres se vident, les équivalents sont dans le cadre vert
    const taux = TAUX();
    const mN = C.lire(etat.mTexte);
    ["EUR", "USD", "GBP"].forEach(d => {
      const saisi = etat.mDev === d && etat.mTexte !== "";
      poser("m" + d, etat.mDev === d ? etat.mTexte : "");
      etiquette("m" + d, saisi, saisi ? "✎ vous saisissez" : "");
      const v = C.convertir(mN, etat.mDev, d, taux);
      $("e-" + d).textContent = v === null ? "—" : C.euros(v) + " " + SYMBOLE[d];
      $("e-" + d + "-n").textContent = d === etat.mDev && mN !== null ? "montant saisi" : "";
    });
    poser("usd", etat.usd); poser("gbp", etat.gbp);
    const sansUsd = !(taux.USD > 0), sansGbp = !(taux.GBP > 0);
    $("e-message").hidden = !(sansUsd || sansGbp);
    $("e-message").textContent = "Saisissez un taux valide pour "
      + (sansUsd && sansGbp ? "le dollar et la livre" : sansUsd ? "le dollar" : "la livre") + ".";
    margeHaute();
  }

  // Le cadre vert reste collé en haut de la zone qui défile. Quand le navigateur fait défiler pour amener un
  // champ à l'écran (touche d'un champ, clavier qui s'ouvre), il l'amène au bord haut — SOUS ce cadre, qui le
  // cacherait. `scroll-padding-top` lui dit de s'arrêter plus bas. La hauteur varie (écran Marge ou Change,
  // largeur de l'écran), donc on la mesure au lieu de la supposer.
  function margeHaute() {
    const collant = document.querySelector(".ecran:not([hidden]) .collant");
    $("zone").style.scrollPaddingTop = collant ? collant.offsetHeight + 24 + "px" : "";
  }

  // ── Saisies ─────────────────────────────────────────────────────────────────
  // Toucher un champ sélectionne tout : la frappe remplace la valeur, comme dans FDS Catalogue.
  // Le délai est nécessaire sur iOS, qui replace sinon le curseur après le focus.
  document.addEventListener("focusin", e => {
    const el = e.target;
    if (el.tagName === "INPUT") setTimeout(() => { try { el.setSelectionRange(0, el.value.length); } catch (x) { /* tant pis */ } }, 0);
  });
  // « OK » du clavier : on le referme.
  document.addEventListener("keydown", e => { if (e.key === "Enter" && e.target.tagName === "INPUT") e.target.blur(); });

  document.addEventListener("input", e => {
    const el = e.target;
    if (el.tagName !== "INPUT") return;
    const id = el.id, v = el.value;
    // Chaîne ACHAT : la dernière des deux lignes saisies (remise fournisseur, prix d'achat) pilote l'autre.
    if (id === "pa") { etat.achatPilote = "pa"; etat.pa = v; }
    else if (id === "remF") { etat.achatPilote = "remF"; etat.remF = v; }
    else if (id === "tarif") etat.tarif = v;
    else if (id === "qte") etat.qte = v;
    else if (id === "mEUR" || id === "mUSD" || id === "mGBP") { etat.mDev = id.slice(1); etat.mTexte = v; }
    else if (id === "usd") { etat.usd = v; memoire.ecrire("fdscalc_taux_usd", v); }
    else if (id === "gbp") { etat.gbp = v; memoire.ecrire("fdscalc_taux_gbp", v); }
    else { etat.pilote = id; etat.saisie = v; }     // pv, marge, coef, remise : la dernière saisie pilote
    render(); sauver();
  });

  $("effacer").addEventListener("click", () => {
    etat.tarif = ""; etat.remF = ""; etat.pa = ""; etat.achatPilote = "pa";
    etat.pilote = "coef"; etat.saisie = ""; etat.qte = ""; etat.mDev = "EUR"; etat.mTexte = "";
    render(); sauver();
    $("zone").scrollTop = 0;
  });

  // ── Navigation ──────────────────────────────────────────────────────────────
  const ECRANS = ["marge", "change", "table", "infos"];
  function aller(nom) {
    ECRANS.forEach(n => {
      $("ecran-" + n).hidden = n !== nom;
      $("onglet-" + n).setAttribute("aria-selected", n === nom ? "true" : "false");
    });
    $("zone").scrollTop = 0;
    margeHaute();
  }
  document.querySelector(".onglets").addEventListener("click", e => {
    const b = e.target.closest("button[data-ecran]");
    if (b) aller(b.dataset.ecran);
  });
  // Un coefficient de la table → le calcul : le coefficient pilote, et l'on revient sur l'écran Marge.
  $("table").addEventListener("click", e => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    etat.pilote = "coef"; etat.saisie = C.ecrire(lignesTable[+b.dataset.i].coef, 2);
    render(); sauver(); aller("marge");
  });

  // ── Thème ───────────────────────────────────────────────────────────────────
  const racine = document.documentElement;
  function majBoutonTheme() {
    const sombre = racine.getAttribute("data-theme") === "sombre";
    $("theme").textContent = sombre ? "☀︎" : "☾";
    $("theme").setAttribute("aria-label", sombre ? "Passer en mode jour" : "Passer en mode nuit");
  }
  $("theme").addEventListener("click", () => {
    const sombre = racine.getAttribute("data-theme") !== "sombre";
    racine.setAttribute("data-theme", sombre ? "sombre" : "clair");
    memoire.ecrire("fdscalc_theme", sombre ? "sombre" : "clair");
    majBoutonTheme();
  });
  majBoutonTheme();

  // ── Version ─────────────────────────────────────────────────────────────────
  // Le numéro est le seul moyen de savoir quelle version tourne réellement sur le téléphone.
  $("pied-version").textContent = "FDS Calculette · version " + VERSION + " · " + DATE_VERSION;
  $("version-texte").textContent = "Version " + VERSION + " du " + DATE_VERSION + ".";

  // ── Application installable et hors ligne ───────────────────────────────────
  let reg = null;
  const montrerMaj = worker => {
    $("maj").hidden = false;
    $("majBtn").onclick = () => { $("majBtn").disabled = true; worker.postMessage({ type: "SKIP_WAITING" }); };
  };
  // Hors http(s) (page ouverte depuis un fichier), il n'y a pas de service worker : l'application marche, sans cache.
  // En local (développement), il est coupé sauf demande (`?sw` dans l'adresse) : cache d'abord, il masquerait
  // chaque modification — c'est son rôle en production, pas en cours de travail. S'il en reste un, on le retire.
  const enLocal = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  const veutSw = !enLocal || /[?&]sw\b/.test(location.search);
  if (!veutSw && "serviceWorker" in navigator) {
    navigator.serviceWorker.getRegistrations().then(rs => rs.forEach(r => r.unregister())).catch(() => {});
    if (window.caches) caches.keys().then(ks => ks.forEach(k => caches.delete(k))).catch(() => {});
  }
  if (veutSw && "serviceWorker" in navigator && /^https?:$/.test(location.protocol)) {
    let recharge = false;
    // Le nouveau service worker a pris la main : on recharge pour afficher la nouvelle version.
    navigator.serviceWorker.addEventListener("controllerchange", () => { if (!recharge) { recharge = true; location.reload(); } });
    navigator.serviceWorker.register("sw.js").then(r => {
      reg = r;
      if (r.waiting && navigator.serviceWorker.controller) montrerMaj(r.waiting);
      r.addEventListener("updatefound", () => {
        const w = r.installing;
        if (w) w.addEventListener("statechange", () => { if (w.state === "installed" && navigator.serviceWorker.controller) montrerMaj(w); });
      });
    }).catch(() => { /* sans service worker : pas de mode hors ligne, mais tout le reste marche */ });
    // Une application restée ouverte des jours ne regarde jamais s'il y a du nouveau : on le lui fait faire au retour au premier plan.
    document.addEventListener("visibilitychange", () => { if (!document.hidden && reg) reg.update().catch(() => {}); });
  }
  // Vérification à la demande (écran Infos) : dit clairement le résultat.
  $("verifier").addEventListener("click", async () => {
    const m = $("verifier-message");
    if (!reg) { m.textContent = "Disponible seulement quand l'application est ouverte depuis son adresse web."; return; }
    m.textContent = "Vérification…";
    try {
      await reg.update();
      const w = reg.installing || reg.waiting;
      if (w && w.state !== "installed" && w.state !== "activated") {
        await new Promise(fin => w.addEventListener("statechange", () => { if (w.state === "installed" || w.state === "redundant") fin(); }));
      }
      if (reg.waiting) { montrerMaj(reg.waiting); m.textContent = "Une mise à jour est prête : touchez « Installer » en haut de l'écran."; }
      else m.textContent = "Vous avez la dernière version (" + VERSION + ").";
    } catch (e) { m.textContent = "Pas de réseau : impossible de vérifier pour le moment."; }
  });
  // Android : Chrome propose lui-même l'installation, on la rend accessible d'un bouton.
  let invite = null;
  window.addEventListener("beforeinstallprompt", e => { e.preventDefault(); invite = e; $("installer").hidden = false; });
  $("installer").addEventListener("click", async () => {
    if (!invite) return;
    invite.prompt();
    try { await invite.userChoice; } catch (e) { /* refusé */ }
    invite = null; $("installer").hidden = true;
  });
  window.addEventListener("appinstalled", () => { $("installer").hidden = true; });

  render();
})();
