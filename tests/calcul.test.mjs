// Essais de la logique de calcul : node --test   (depuis le dossier Programme)
// Les valeurs attendues sont celles relevées dans l'onglet « Calcul de marge » de FDS Catalogue
// (17/10/2026), pour que la calculette donne exactement les mêmes chiffres que lui.
import { test } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
const C = createRequire(import.meta.url)("../calcul.js");

const calc = (pa, pilote, saisie, tarif = "") => C.calculer({ pa, pilote, saisie, tarif });

test("lecture à la française", () => {
  assert.equal(C.lire("12,5"), 12.5);
  assert.equal(C.lire("12.5"), 12.5);
  assert.equal(C.lire("1 250,40"), 1250.4);
  assert.equal(C.lire(""), null);
  assert.equal(C.lire("abc"), null);
  assert.equal(C.lire("-3"), -3);
  assert.equal(C.lire(null), null);
});

test("écriture : prix à deux décimales, coefficient sans zéros inutiles", () => {
  assert.equal(C.ecrirePrix(107.6), "107,60");
  assert.equal(C.ecrirePrix(null), "");
  assert.equal(C.ecrire(1.5, 4), "1,5");
  assert.equal(C.ecrire(1.55641, 4), "1,5564");
});

test("coefficient 1,5 sur 7,71 € → 11,57 € (arrondi au centime)", () => {
  const r = calc("7,71", "coef", "1,5");
  assert.equal(r.pvC, 11.57);
  assert.ok(Math.abs(r.marge - 1 / 3) < 1e-12);
});

test("le gain part du prix arrondi : 11,57 − 7,71 = 3,86 (et non 3,85)", () => {
  assert.equal(calc("7,71", "coef", "1,5").gain, 3.86);
});

test("prix de vente à 2 décimales : 0,36 × 1,45 → 0,52", () => {
  assert.equal(calc("0,36", "coef", "1,45").pvC, 0.52);
});

test("marge 40 % sur 7,71 € → 12,85 €", () => {
  assert.equal(calc("7,71", "marge", "40").pvC, 12.85);
});

test("prix de vente 12 € sur 7,71 € → coefficient 1,5564", () => {
  const r = calc("7,71", "pv", "12");
  assert.equal(C.ecrire(r.coef, 4), "1,5564");
});

test("un coefficient de 1,50 donne 33,3 % de marge, pas 50 %", () => {
  assert.equal(C.pct(calc("100", "coef", "1,5").marge), "33,33 %");
});

test("marge négative acceptée : vente sous le prix d'achat", () => {
  const r = calc("100", "marge", "-25");
  assert.equal(r.pvC, 80);
  assert.equal(r.gain, -20);
});

test("marge de 100 % ou plus : impossible, avec son message dédié", () => {
  const r = calc("100", "marge", "100");
  assert.equal(r.pvC, null);
  assert.equal(r.margeImpossible, true);
  assert.equal(r.manque, null);
});

test("fiche SOMECO : achat 433,50 € / tarif 510 € → coef 1,1765, marge 15 %, remise 0 %, gain 76,50 €", () => {
  const r = calc("433,50", "pv", "510", "510");
  assert.equal(C.ecrire(r.coef, 4), "1,1765");
  assert.equal(C.ecrire(r.marge * 100, 2), "15");
  assert.equal(r.remiseEq, 0);
  assert.equal(r.gain, 76.5);
});

test("remise sur tarif : 20 % de remise sur 100 € → 80 € ; achat 60 € → marge 25 %", () => {
  const r = calc("60", "remise", "20", "100");
  assert.equal(r.pvC, 80);
  assert.equal(r.marge, 0.25);
  assert.ok(Math.abs(r.remiseEq - 0.2) < 1e-12);
});

test("remise de 0 % permise (le prix de vente est le tarif)", () => {
  assert.equal(calc("60", "remise", "0", "100").pvC, 100);
});

test("remise : majoration quand le prix dépasse le tarif", () => {
  const r = calc("60", "pv", "120", "100");
  assert.ok(r.remiseEq < 0);
});

test("remise sans tarif : message, pas de résultat", () => {
  const r = calc("60", "remise", "20", "");
  assert.equal(r.pvC, null);
  assert.match(r.manque, /tarif/i);
});

test("remise de 100 % : impossible", () => {
  const r = calc("60", "remise", "100", "100");
  assert.equal(r.pvC, null);
  assert.match(r.manque, /100 %/);
});

test("sans prix d'achat : le prix de vente se lit, pas la marge", () => {
  const r = calc("", "pv", "50");
  assert.equal(r.pvC, 50);
  assert.equal(r.coef, null);
  assert.equal(r.marge, null);
});

test("sans prix d'achat : un coefficient ne donne pas de prix, et le dit", () => {
  const r = calc("", "coef", "1,5");
  assert.equal(r.pvC, null);
  assert.match(r.manque, /prix d'achat/);
});

test("champ vide : on demande de remplir une ligne", () => {
  assert.match(calc("10", "coef", "").manque, /Remplissez/);
});

test("aller-retour : marge → prix → marge", () => {
  for (const m of [5, 12.5, 33.3, 40, 75]) {
    const a = calc("123,45", "marge", String(m));
    const b = calc("123,45", "pv", C.ecrirePrix(a.pvC));
    assert.ok(Math.abs(b.marge * 100 - m) < 0.05, `marge ${m} → ${b.marge * 100}`);
  }
});

test("sur une quantité", () => {
  const r = calc("7,71", "coef", "1,5");
  const s = C.simuler("500", r.pvC, r.paN);
  assert.equal(Math.round(s.ca * 100) / 100, 5785);
  assert.equal(Math.round(s.cout * 100) / 100, 3855);
  assert.equal(Math.round(s.marge * 100) / 100, 1930);
  assert.equal(C.simuler("", r.pvC, r.paN), null);
});

test("change : 100 € → 117,00 $ et 87,00 £", () => {
  const t = C.tauxDepuisTextes("1,17", "0,87");
  assert.equal(C.euros(C.convertir(100, "EUR", "USD", t)), "117,00");
  assert.equal(C.euros(C.convertir(100, "EUR", "GBP", t)), "87,00");
});

test("change : 21,4 £ → 24,60 € et 28,78 $", () => {
  const t = C.tauxDepuisTextes("1,17", "0,87");
  assert.equal(C.euros(C.convertir(21.4, "GBP", "EUR", t)), "24,60");
  assert.equal(C.euros(C.convertir(21.4, "GBP", "USD", t)), "28,78");
});

test("change : 117 $ → 100,00 € ; 50 £ → 57,47 € et 67,24 $", () => {
  const t = C.tauxDepuisTextes("1,17", "0,87");
  assert.equal(C.euros(C.convertir(117, "USD", "EUR", t)), "100,00");
  assert.equal(C.euros(C.convertir(50, "GBP", "EUR", t)), "57,47");
  assert.equal(C.euros(C.convertir(50, "GBP", "USD", t)), "67,24");
});

test("change : taux manquant ou nul → conversion impossible", () => {
  assert.equal(C.convertir(100, "EUR", "USD", C.tauxDepuisTextes("", "0,87")), null);
  assert.equal(C.convertir(100, "EUR", "GBP", C.tauxDepuisTextes("1,17", "0")), null);
  assert.equal(C.convertir(100, "EUR", "EUR", C.tauxDepuisTextes("", "")), 100);
  assert.equal(C.convertir(null, "EUR", "USD", C.tauxDepuisTextes("1,17", "0,87")), null);
});

test("table coefficient ↔ marge", () => {
  const t = C.tableCoefMarge();
  assert.equal(t.length, 43);
  assert.deepEqual(t[0], { marge: 0.1, coef: 1.11 });
  assert.deepEqual(t[20], { marge: 0.3, coef: 1.43 });
  assert.equal(t[40].coef, 2);
  assert.equal(t[41].coef, 3);
  assert.equal(C.pct(t[42].marge), "75,0 %");
});
