// ─────────────────────────────────────────────────────────────────────────────
// FDS Calculette — la logique de calcul, sans aucune interface.
//
// Reprise, formule pour formule, de l'onglet « Calcul de marge » de FDS Catalogue
// (CalculMarge.jsx). Séparée de l'écran pour pouvoir être essayée en ligne de commande :
//   node --test
//
// Les deux définitions à ne pas confondre — c'est l'erreur classique :
//   coefficient (mark-up) = prix de vente ÷ prix d'achat
//   marge                 = (prix de vente − prix d'achat) ÷ prix de vente
// Tous les prix sont HT. Un coefficient de 1,50 donne une marge de 33,3 %, pas de 50 %.
//
// Chargé par index.html (variable globale `Calcul`) et par Node (`require`).
// ─────────────────────────────────────────────────────────────────────────────
(function (racine, fabrique) {
  if (typeof module === "object" && module.exports) module.exports = fabrique();
  else racine.Calcul = fabrique();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // Saisie à la française : « 12,5 », « 1 250,40 » et « 12.5 » sont acceptés.
  // Un texte qui n'est pas un nombre rend null (et non 0 : un champ vide n'est pas un zéro).
  const lire = s => {
    const t = String(s == null ? "" : s).replace(/\s/g, "").replace(",", ".");
    if (t === "" || !/^-?\d*\.?\d*$/.test(t)) return null;
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  };
  const valide = n => n !== null && n !== undefined && Number.isFinite(n);

  // Un nombre dans un champ de saisie, `dec` décimales au plus (les zéros inutiles sont retirés).
  const ecrire = (n, dec) => !valide(n) ? ""
    : String(Math.round(n * 10 ** dec) / 10 ** dec).replace(".", ",");
  // Un prix dans un champ de saisie : toujours deux décimales, zéro final compris (« 107,60 », pas « 107,6 »).
  const ecrirePrix = n => !valide(n) ? ""
    : (Math.round(n * 100) / 100).toFixed(2).replace(".", ",");
  // À l'affichage, en français : « 1 250,40 ».
  const euros = n => !valide(n) ? "—"
    : n.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const pct = n => !valide(n) ? "—"
    : (n * 100).toLocaleString("fr-FR", { minimumFractionDigits: 1, maximumFractionDigits: 2 }) + " %";

  // ── 1. Calculateur ─────────────────────────────────────────────────────────
  // Deux chaînes, qui partagent le même TARIF, et dans chacune la DERNIÈRE saisie pilote les autres lignes
  // (aucun bouton « calculer ») :
  //   ACHAT (`achatPilote`) : « pa » (le prix d'achat est saisi) ou « remF » (la remise fournisseur est saisie
  //                           et le prix d'achat en découle : PA = tarif − remise). Le prix d'achat sort de cette chaîne.
  //   VENTE (`pilote`)      : « pv », « marge », « coef » ou « remise » (remise CLIENT : vente = tarif − remise).
  //                           Part du prix d'achat que la chaîne ACHAT a produit.
  // D'où les trois parcours : tarif + remise fournisseur → prix d'achat ; tarif + remise client (avec le prix
  // d'achat) → prix de vente et marge restante ; prix d'achat + marge → prix de vente. Ils s'enchaînent.
  //   e = { tarif, achatPilote: "pa"|"remF" (« pa » si absent), pa, remF,
  //         pilote: "pv"|"marge"|"coef"|"remise", saisie }  — tous des TEXTES saisis.
  function calculer(e) {
    const pilote = e.pilote;
    const x = lire(e.saisie), tarifN = lire(e.tarif);
    const baseOk = tarifN !== null && tarifN > 0;

    // ── Chaîne ACHAT ──
    // Le prix d'achat issu d'une remise est arrondi au centime, comme tout prix : le gain et la marge
    // partent de CE prix (433,50 € et non 433,5000000001 €).
    const achatParRemise = e.achatPilote === "remF";
    const remFN = lire(e.remF);
    let paN = null, manqueAchat = null, remFEq = null;
    if (achatParRemise) {
      if (!baseOk) manqueAchat = "Renseignez le tarif pour calculer le prix d'achat.";
      else if (remFN === null) manqueAchat = "Renseignez la remise fournisseur.";
      else if (remFN >= 100) manqueAchat = "Une remise de 100 % ou plus est impossible : le prix d'achat serait nul.";
      else if (remFN < 0) manqueAchat = "Une remise fournisseur ne peut pas être négative.";
      else paN = Math.round(tarifN * (1 - remFN / 100) * 100) / 100;
    } else {
      paN = lire(e.pa);
      // Remise qui, appliquée au tarif, redonne ce prix d'achat (négative = prix d'achat au-dessus du tarif).
      if (baseOk && paN !== null) remFEq = 1 - paN / tarifN;
    }

    // ── Chaîne VENTE ──
    let pv = null, coef = null, marge = null;     // marge en fraction : 0,4 = 40 %

    // Du prix de vente, on déduit coefficient et marge dès que le prix d'achat est là.
    const depuisPv = v => { pv = v; if (paN > 0) { coef = pv / paN; marge = (pv - paN) / pv; } };

    if (pilote === "remise") {
      // Remise de 0 % permise : le prix de vente est alors le tarif lui-même.
      if (x !== null && x >= 0 && x < 100 && baseOk) depuisPv(tarifN * (1 - x / 100));
    } else if (x !== null) {
      if (pilote === "pv" && x > 0)   depuisPv(x);
      if (pilote === "coef" && x > 0) { coef = x; marge = 1 - 1 / coef; if (paN !== null) pv = paN * coef; }
      // Une marge négative est possible (vente sous le prix d'achat).
      if (pilote === "marge" && x < 100) { marge = x / 100; coef = 1 / (1 - marge); if (paN !== null) pv = paN * coef; }
    }

    // Le prix de vente affiché est arrondi au centime ; le gain et la simulation partent de CE prix,
    // sinon « 11,57 − 7,71 » s'afficherait 3,85 (le prix exact 11,565 − 7,71 = 3,855 tombant du mauvais côté).
    const pvC = pv === null ? null : Math.round(pv * 100) / 100;
    const gain = (pvC !== null && paN !== null) ? Math.round((pvC - paN) * 100) / 100 : null;
    // Remise qui, appliquée au tarif, redonne ce prix de vente (négative = majoration).
    const remiseEq = (baseOk && pvC !== null) ? 1 - pvC / tarifN : null;

    // Le résultat est-il possible ? Sinon, dire ce qui manque plutôt que d'afficher des tirets muets.
    let manque = null;
    if (pv === null) {
      if (pilote === "marge" && x !== null && x >= 100) manque = null;   // message d'erreur dédié (margeImpossible)
      else if (x === null || (x <= 0 && (pilote === "pv" || pilote === "coef"))) manque = "Remplissez une des lignes.";
      else if ((pilote === "coef" || pilote === "marge") && paN === null) manque = "Renseignez le prix d'achat pour obtenir le prix de vente.";
      else if (pilote === "remise" && x >= 100) manque = "Une remise de 100 % ou plus est impossible : le prix de vente serait nul.";
      else if (pilote === "remise" && !baseOk) manque = "Renseignez le tarif pour calculer une remise.";
    }
    const margeImpossible = pilote === "marge" && x !== null && x >= 100;
    // Un prix de vente connu sans prix d'achat : on le lit, mais on dit pourquoi la marge reste vide.
    const indice = (pv !== null && paN === null && !manqueAchat) ? "Renseignez le prix d'achat pour voir la marge." : null;

    return { paN, x, tarifN, baseOk, pv, pvC, coef, marge, gain, remiseEq, remFEq, manque, manqueAchat, indice, margeImpossible };
  }

  // ── 1 bis. Sur une quantité ────────────────────────────────────────────────
  // Repart du prix de vente arrondi (`pvC`) et du prix d'achat du calculateur.
  function simuler(qte, pvC, paN) {
    const q = lire(qte);
    if (!(q !== null && q >= 0 && pvC !== null && paN !== null)) return null;
    return { ca: q * pvC, cout: q * paN, marge: q * (pvC - paN) };
  }

  // ── 2. Change ──────────────────────────────────────────────────────────────
  // Chaque monnaie vaut tant d'unités pour 1 euro (1 € = 1,17 $ ; 1 € = 0,87 £). Toute conversion passe par
  // l'euro. Une monnaie dont le taux manque ou n'est pas positif rend null : conversion impossible.
  const MONNAIES = ["EUR", "USD", "GBP"];
  function convertir(val, de, vers, parEuro) {
    if (val === null || val === undefined) return null;
    if (!de || !vers || de === vers) return val;
    if (!(parEuro[de] > 0) || !(parEuro[vers] > 0)) return null;
    return val / parEuro[de] * parEuro[vers];
  }
  // Les taux saisis en texte → table prête pour `convertir`.
  const tauxDepuisTextes = (usd, gbp) => ({ EUR: 1, USD: lire(usd), GBP: lire(gbp) });

  // ── 3. Table coefficient ↔ marge ───────────────────────────────────────────
  // Marge de 10 % à 50 % par pas de 1 %, plus les coefficients ronds 3 et 4. Même contenu que les
  // colonnes A et B du classeur d'origine, mais calculé au lieu d'être recopié à la main.
  function tableCoefMarge() {
    const t = [];
    for (let m = 10; m <= 50; m++) t.push({ marge: m / 100, coef: Math.round(10000 / (100 - m)) / 100 });
    [3, 4].forEach(c => t.push({ marge: 1 - 1 / c, coef: c }));
    return t;
  }

  return { lire, ecrire, ecrirePrix, euros, pct, calculer, simuler, convertir, tauxDepuisTextes, MONNAIES, tableCoefMarge };
});
