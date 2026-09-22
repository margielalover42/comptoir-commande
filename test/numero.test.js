/**
 * Les numeros de commande : melanges, mais jamais deux fois le meme.
 *
 * C'est la propriete qui compte, et elle se verifie exhaustivement : il n'y
 * a que 900 numeros, donc on peut les parcourir tous plutot que d'esperer.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { numeroPourRang, decalageAleatoire, PLAGE_NUMEROS } from '../src/numero.js';

test('une journee entiere ne repete jamais un numero', () => {
  for (const decalage of [0, 1, 7, 137, 449, 899]) {
    const vus = new Set();

    for (let rang = 0; rang < PLAGE_NUMEROS; rang++) {
      const numero = numeroPourRang(rang, decalage);
      assert.ok(!vus.has(numero), `numero ${numero} en double (decalage ${decalage}, rang ${rang})`);
      vus.add(numero);
    }

    assert.equal(vus.size, PLAGE_NUMEROS, 'les 900 numeros sont couverts');
  }
});

test('tous les numeros tiennent sur trois chiffres', () => {
  for (let rang = 0; rang < PLAGE_NUMEROS; rang++) {
    const numero = numeroPourRang(rang, 42);
    assert.ok(numero >= 100 && numero <= 999, `hors plage : ${numero}`);
  }
});

test('la suite n’a pas l’air sequentielle', () => {
  // Sinon autant garder 1, 2, 3 : c'est precisement ce qu'on voulait eviter.
  const dix = Array.from({ length: 10 }, (_, rang) => numeroPourRang(rang, 300));

  for (let i = 1; i < dix.length; i++) {
    assert.notEqual(dix[i] - dix[i - 1], 1, `${dix[i - 1]} puis ${dix[i]} : trop previsible`);
  }
});

test('deux journees ne donnent pas la meme suite', () => {
  const lundi = Array.from({ length: 5 }, (_, r) => numeroPourRang(r, 12));
  const mardi = Array.from({ length: 5 }, (_, r) => numeroPourRang(r, 613));

  assert.notDeepEqual(lundi, mardi);
});

test('la meme journee redonne toujours la meme suite', () => {
  // Le decalage est conserve en base : un redemarrage du serveur en plein
  // service ne doit pas faire repartir le melange ailleurs.
  assert.equal(numeroPourRang(17, 250), numeroPourRang(17, 250));
});

test('au-dela de 900 commandes, on passe a quatre chiffres sans repetition', () => {
  // Le commerce n'ira jamais jusque-la, mais « jamais deux fois le meme »
  // doit rester vrai meme ce jour-la.
  const vus = new Set();
  for (let rang = 0; rang < PLAGE_NUMEROS + 50; rang++) {
    const numero = numeroPourRang(rang, 77);
    assert.ok(!vus.has(numero), `numero ${numero} en double au rang ${rang}`);
    vus.add(numero);
  }

  assert.equal(numeroPourRang(PLAGE_NUMEROS, 77), 1000);
  assert.equal(numeroPourRang(PLAGE_NUMEROS + 49, 77), 1049);
});

test('un rang invalide est refuse plutot que silencieusement faux', () => {
  for (const mauvais of [-1, 1.5, NaN, '3', null]) {
    assert.throws(() => numeroPourRang(mauvais, 0), RangeError);
  }
});

test('le decalage tire reste dans la plage', () => {
  const tirage = (max) => { assert.equal(max, PLAGE_NUMEROS); return max - 1; };
  assert.equal(decalageAleatoire(tirage), PLAGE_NUMEROS - 1);
});
