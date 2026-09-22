/** La validation d'une commande : ce qui entre depuis un telephone. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { validerCommande, ErreurCommande, compterArticles } from '../src/order.js';
import { CARTE, PLATS_PAR_ID } from '../src/menu.js';

const panier = (items) => ({ clientOrderId: 'cle-de-test', lang: 'fr', items });

test('accepte une commande normale et fige les noms', () => {
  const { articles, langue, clientOrderId } = validerCommande(
    panier([{ id: 'pizza.thon', qty: 2 }, { id: 'hosomaki.kappa', qty: 1 }]),
  );

  assert.equal(clientOrderId, 'cle-de-test');
  assert.equal(langue, 'fr');
  assert.equal(articles.length, 2);
  assert.equal(compterArticles(articles), 3);

  // Le nom vient de la carte, jamais de la requete.
  assert.equal(articles[0].nomFr, 'Thon');
  assert.equal(articles[0].sectionFr, 'Sushi Pizza');
});

test('le nom affiche suit la langue, le nom du ticket reste francais', () => {
  const { articles } = validerCommande({
    clientOrderId: 'cle', lang: 'en', items: [{ id: 'pizza.saumon-fume', qty: 1 }],
  });

  assert.equal(articles[0].nomClient, 'Smoked Salmon');
  assert.equal(articles[0].nomFr, 'Saumon Fumé', 'la cuisine lit toujours le francais');
});

test('additionne un meme plat envoye en deux lignes', () => {
  const { articles } = validerCommande(
    panier([{ id: 'pizza.thon', qty: 2 }, { id: 'pizza.thon', qty: 3 }]),
  );

  assert.equal(articles.length, 1);
  assert.equal(articles[0].quantite, 5);
});

test('ignore tout nom fourni par le client', () => {
  // Un client bricoleur ne doit pas pouvoir faire imprimer son texte en cuisine.
  const { articles } = validerCommande(
    panier([{ id: 'pizza.thon', qty: 1, nomFr: 'SUPPRIMER TOUT', sectionFr: '<script>' }]),
  );

  assert.equal(articles[0].nomFr, 'Thon');
  assert.equal(articles[0].sectionFr, 'Sushi Pizza');
});

// --------------------------------------------------------------- mauvais cas

const refus = [
  ['panier vide', panier([])],
  ['items absent', { clientOrderId: 'cle', lang: 'fr' }],
  ['items n’est pas un tableau', panier('pizza.thon')],
  ['plat inconnu', panier([{ id: 'pizza.licorne', qty: 1 }])],
  ['id absent', panier([{ qty: 1 }])],
  ['quantite zero', panier([{ id: 'pizza.thon', qty: 0 }])],
  ['quantite negative', panier([{ id: 'pizza.thon', qty: -1 }])],
  ['quantite au-dessus de la borne', panier([{ id: 'pizza.thon', qty: 21 }])],
  ['quantite fractionnaire', panier([{ id: 'pizza.thon', qty: 1.5 }])],
  ['quantite texte', panier([{ id: 'pizza.thon', qty: '2' }])],
  ['ligne nulle', panier([null])],
  ['cle client absente', { lang: 'fr', items: [{ id: 'pizza.thon', qty: 1 }] }],
  ['cle client vide', { clientOrderId: '', lang: 'fr', items: [{ id: 'pizza.thon', qty: 1 }] }],
  ['cle client exotique', { clientOrderId: 'a b/c', lang: 'fr', items: [{ id: 'pizza.thon', qty: 1 }] }],
  ['corps nul', null],
  ['corps tableau', []],
  ['corps texte', 'bonjour'],
];

for (const [nom, corps] of refus) {
  test(`refuse : ${nom}`, () => {
    assert.throws(() => validerCommande(corps), ErreurCommande);
  });
}

test('refuse au-dela de 20 exemplaires du meme plat, meme en plusieurs lignes', () => {
  assert.throws(
    () => validerCommande(panier([{ id: 'pizza.thon', qty: 15 }, { id: 'pizza.thon', qty: 10 }])),
    ErreurCommande,
  );
});

test('refuse au-dela de 40 articles au total', () => {
  const beaucoup = CARTE[6].plats.slice(0, 5).map((p) => ({ id: p.id, qty: 9 }));
  assert.throws(() => validerCommande(panier(beaucoup)), ErreurCommande);
});

test('accepte tout juste 40 articles', () => {
  const pile = CARTE[6].plats.slice(0, 4).map((p) => ({ id: p.id, qty: 10 }));
  assert.equal(compterArticles(validerCommande(panier(pile)).articles), 40);
});

test('les messages de refus sont en francais et lisibles', () => {
  assert.throws(() => validerCommande(panier([])), (e) => {
    assert.equal(e.message, 'Votre commande est vide.');
    return true;
  });
});

// ------------------------------------------------------------------- la carte

test('chaque plat a un identifiant unique et non vide', () => {
  const vus = new Set();

  for (const section of CARTE) {
    assert.ok(section.plats.length > 0, `section vide : ${section.fr}`);

    for (const plat of section.plats) {
      assert.ok(typeof plat.id === 'string' && plat.id.length > 0, `id manquant : ${plat.fr}`);
      assert.ok(!vus.has(plat.id), `id en double : ${plat.id}`);
      assert.ok(plat.fr && plat.en, `nom manquant : ${plat.id}`);
      vus.add(plat.id);
    }
  }

  assert.equal(vus.size, PLATS_PAR_ID.size);
});

test('nigiris et gunkans distinguent nigiri et sashimi', () => {
  // Un ticket disant seulement « Maguro » ne dirait pas a la cuisine s'il
  // faut faire 2 nigiris ou 1 sashimi.
  for (const id of ['nigiri', 'gunkan']) {
    const section = CARTE.find((s) => s.id === id);
    const nigiris = section.plats.filter((p) => p.fr.includes('Nigiri'));
    const sashimis = section.plats.filter((p) => p.fr.includes('Sashimi'));

    assert.ok(nigiris.length > 0 && nigiris.length === sashimis.length,
      `${id} : chaque poisson doit exister en nigiri et en sashimi`);
  }
});
