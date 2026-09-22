/**
 * Le systeme complet, par HTTP, avec une fausse imprimante.
 *
 * Ces tests parlent au serveur comme le feraient un telephone et une TM-m30 :
 * memes URLs, memes formats. C'est le filet qui protege l'exigence
 * principale — la cuisine recoit le ticket, et le comptoir sait s'il est
 * sorti.
 */

import { test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { once } from 'node:events';

import { creerApp } from '../src/server.js';
import { ouvrirBase, ETAT } from '../src/store.js';
import { config } from '../src/config.js';

const IMPRIMANTE = `/imprimante/${config.secretImprimante}`;
const COMPTOIR = `/comptoir/${config.secretComptoir}`;

let store, serveur, base, horloge;

const T0 = new Date('2026-09-22T16:00:00Z');
const avancer = (secondes) => { horloge = new Date(horloge.getTime() + secondes * 1000); };

beforeEach(async () => {
  store = ouvrirBase(':memory:');
  horloge = T0;

  serveur = createServer(creerApp({ store, maintenant: () => horloge }));
  serveur.listen(0);
  await once(serveur, 'listening');
  base = `http://127.0.0.1:${serveur.address().port}`;
});

afterEach(async () => {
  serveur.close();
  await once(serveur, 'close');
  store.close();
});

// ------------------------------------------------------------------- outils

function commander(items, cle = 'cle-test', lang = 'fr') {
  return fetch(base + '/api/commandes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientOrderId: cle, lang, items }),
  });
}

const PANIER = [{ id: 'pizza.thon', qty: 2 }, { id: 'hosomaki.kappa', qty: 1 }];

/** Ce que fait la vraie imprimante : « as-tu quelque chose pour moi ? » */
function interroger() {
  return fetch(base + IMPRIMANTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ConnectionType: 'GetRequest', ID: 'comptoir36' }).toString(),
  }).then((r) => r.text());
}

/** Ce que fait la vraie imprimante apres avoir imprime. */
function accuser(travailId, reussi = true, code = '') {
  const xml = '<?xml version="1.0" encoding="utf-8"?>'
    + '<PrintResponseInfo Version="2.00"><ePOSPrint><Parameter>'
    + `<devid>local_printer</devid><printjobid>${travailId}</printjobid>`
    + '</Parameter><PrintResponse>'
    + `<response success="${reussi}" code="${code}" status="251854870"/>`
    + '</PrintResponse></ePOSPrint></PrintResponseInfo>';

  return fetch(base + IMPRIMANTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ConnectionType: 'SetResponse', ID: 'comptoir36', ResponseFile: xml }).toString(),
  });
}

const idDuTravail = (xml) => xml.match(/<printjobid>([^<]+)<\/printjobid>/)?.[1];
const suivre = (id) => fetch(`${base}/api/commandes/${id}`).then((r) => r.json());
const auComptoir = () => fetch(base + COMPTOIR + '/commandes').then((r) => r.json());

// ======================================================== LE PARCOURS NORMAL

test('parcours complet : commander, imprimer, confirmer, voir au comptoir', async () => {
  // 1. Le client envoie sa commande.
  const reponse = await commander(PANIER);
  assert.equal(reponse.status, 201);

  const commande = await reponse.json();
  assert.equal(commande.numero, 1);
  assert.equal(commande.total, 3);
  assert.equal(commande.etatImpression, ETAT.EN_ATTENTE);

  // 2. L'imprimante vient chercher le ticket.
  const xml = await interroger();
  assert.match(xml, /<PrintRequestInfo Version="2\.00">/);
  assert.match(xml, /#1/);
  assert.match(xml, /2x THON/);
  assert.match(xml, /NON PAYE/);

  // 3. Entre-temps, le client voit « en cours ».
  assert.equal((await suivre(commande.id)).etatImpression, ETAT.ENVOYEE);

  // 4. L'imprimante confirme.
  await accuser(idDuTravail(xml));
  assert.equal((await suivre(commande.id)).etatImpression, ETAT.IMPRIMEE);

  // 5. Le comptoir la voit imprimee.
  const vue = await auComptoir();
  assert.equal(vue.commandes.length, 1);
  assert.equal(vue.commandes[0].numero, 1);
  assert.equal(vue.commandes[0].etatImpression, ETAT.IMPRIMEE);
  assert.equal(vue.imprimanteEnLigne, true);
});

test('le ticket de cuisine reste en francais meme si le client commande en anglais', async () => {
  await commander([{ id: 'pizza.saumon-fume', qty: 1 }], 'cle-en', 'en');
  const xml = await interroger();

  assert.match(xml, /SAUMON FUM/, 'la cuisine lit le francais');
  assert.doesNotMatch(xml, /SMOKED SALMON/);
});

test('le client, lui, voit sa langue', async () => {
  const commande = await (await commander([{ id: 'pizza.saumon-fume', qty: 1 }], 'cle-en', 'en')).json();
  assert.equal(commande.articles[0].nom, 'Smoked Salmon');
});

test('rien a imprimer : la reponse est vide', async () => {
  assert.equal(await interroger(), '');
});

test('les numeros se suivent', async () => {
  assert.equal((await (await commander(PANIER, 'a')).json()).numero, 1);
  assert.equal((await (await commander(PANIER, 'b')).json()).numero, 2);
  assert.equal((await (await commander(PANIER, 'c')).json()).numero, 3);
});

// ====================================================== LES DOUBLES ENVOIS

test('deux envois du meme panier ne font qu’une commande et qu’un ticket', async () => {
  const premier = await commander(PANIER, 'meme-cle');
  const second = await commander(PANIER, 'meme-cle');

  assert.equal(premier.status, 201, 'creation');
  assert.equal(second.status, 200, 'renvoi, pas creation');

  const a = await premier.json();
  const b = await second.json();
  assert.equal(b.numero, a.numero);
  assert.equal(b.id, a.id);

  assert.notEqual(await interroger(), '', 'un ticket');
  assert.equal(await interroger(), '', 'et un seul');
});

test('deux envois simultanes ne font qu’une commande', async () => {
  const [a, b] = await Promise.all([
    commander(PANIER, 'course').then((r) => r.json()),
    commander(PANIER, 'course').then((r) => r.json()),
  ]);

  assert.equal(a.numero, b.numero);
  assert.equal((await auComptoir()).commandes.length, 1);
});

test('un panier modifie obtient une nouvelle commande', async () => {
  const a = await (await commander(PANIER, 'cle-a')).json();
  const b = await (await commander([{ id: 'pizza.duo', qty: 1 }], 'cle-b')).json();

  assert.notEqual(a.numero, b.numero);
});

// ==================================================== L'IMPRIMANTE EN PANNE

test('l’imprimante signale une erreur : la commande existe, le comptoir voit le code', async () => {
  const commande = await (await commander(PANIER)).json();
  const premier = idDuTravail(await interroger());

  await accuser(premier, false, 'EPTR_REC_EMPTY');

  // Une seconde tentative part automatiquement.
  const second = idDuTravail(await interroger());
  assert.ok(second && second !== premier);
  await accuser(second, false, 'EPTR_REC_EMPTY');

  const apres = await suivre(commande.id);
  assert.equal(apres.etatImpression, ETAT.ECHEC);
  assert.equal(apres.numero, commande.numero, 'le numero reste valable');

  const vue = await auComptoir();
  assert.equal(vue.commandes[0].etatImpression, ETAT.ECHEC);
  assert.equal(vue.commandes[0].codeErreur, 'EPTR_REC_EMPTY');
});

test('l’imprimante ne repond jamais : le ticket finit par etre declare echoue', async () => {
  const commande = await (await commander(PANIER)).json();
  await interroger();

  avancer(120);
  assert.equal((await suivre(commande.id)).etatImpression, ETAT.EN_ATTENTE, 'un reessai est en file');

  await interroger();
  avancer(120);
  assert.equal((await suivre(commande.id)).etatImpression, ETAT.ECHEC);
});

test('l’imprimante debranchee est signalee hors ligne', async () => {
  await interroger();
  assert.equal((await auComptoir()).imprimanteEnLigne, true);

  avancer(60);
  assert.equal((await auComptoir()).imprimanteEnLigne, false);
});

test('une commande est acceptee meme imprimante hors ligne, et le client est prevenu', async () => {
  const reponse = await commander(PANIER);
  const commande = await reponse.json();

  // La commande existe : le comptoir pourra la servir depuis son ecran.
  assert.equal(reponse.status, 201);
  assert.ok(commande.numero);
  assert.equal(commande.imprimanteEnLigne, false, 'et on le dit');
});

test('le comptoir peut reimprimer un ticket rate', async () => {
  const commande = await (await commander(PANIER)).json();
  await accuser(idDuTravail(await interroger()), false, 'EPTR_COVER_OPEN');
  await accuser(idDuTravail(await interroger()), false, 'EPTR_COVER_OPEN');

  assert.equal((await suivre(commande.id)).etatImpression, ETAT.ECHEC);

  const reimp = await fetch(`${base}${COMPTOIR}/commandes/${commande.id}/reimprimer`, { method: 'POST' });
  assert.equal(reimp.status, 200);

  const xml = await interroger();
  assert.match(xml, /REIMPRESSION/, 'la cuisine doit savoir que c’est un doublon');
  assert.match(xml, new RegExp(`#${commande.numero}`));

  await accuser(idDuTravail(xml));
  assert.equal((await suivre(commande.id)).etatImpression, ETAT.IMPRIMEE);
});

test('reimprimer une commande inconnue rend 404', async () => {
  const r = await fetch(`${base}${COMPTOIR}/commandes/inexistante/reimprimer`, { method: 'POST' });
  assert.equal(r.status, 404);
});

test('une imprimante qui parle l’ancien protocole est comprise', async () => {
  // La version 1.00 ne renvoie pas l'identifiant du travail. Comme on n'en
  // envoie jamais plus d'un a la fois, le verdict reste attribuable.
  const commande = await (await commander(PANIER)).json();
  await interroger();

  await fetch(base + IMPRIMANTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      ConnectionType: 'SetResponse',
      ResponseFile: '<PrintResponseInfo Version="1.00"><response success="true" code=""/></PrintResponseInfo>',
    }).toString(),
  });

  assert.equal((await suivre(commande.id)).etatImpression, ETAT.IMPRIMEE);
});

test('un message inconnu de l’imprimante ne casse rien', async () => {
  const r = await fetch(base + IMPRIMANTE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'ConnectionType=QuelqueChose',
  });

  assert.equal(r.status, 200);
  assert.equal(await r.text(), '');
});

// ========================================================= MAUVAISES ENTREES

test('JSON illisible : 400, et le serveur tient debout', async () => {
  const r = await fetch(base + '/api/commandes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{ceci n’est pas du JSON',
  });

  assert.equal(r.status, 400);
  assert.match((await r.json()).erreur, /illisible/i);
  assert.equal((await fetch(base + '/api/etat')).status, 200, 'le serveur repond encore');
});

test('corps trop volumineux : 413', async () => {
  const r = await fetch(base + '/api/commandes', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ clientOrderId: 'x', items: [], bourrage: 'A'.repeat(40_000) }),
  }).catch(() => ({ status: 413 })); // la connexion peut etre coupee net

  assert.ok(r.status === 413 || r.status === 400);
});

test('paniers refuses avec un message utile', async () => {
  const cas = [
    [[], /vide/i],
    [[{ id: 'pizza.licorne', qty: 1 }], /menu/i],
    [[{ id: 'pizza.thon', qty: 0 }], /Quantité/i],
    [[{ id: 'pizza.thon', qty: 99 }], /Quantité|Maximum/i],
  ];

  for (const [items, attendu] of cas) {
    const r = await commander(items, 'cle-' + Math.random().toString(36).slice(2));
    assert.equal(r.status, 400, JSON.stringify(items));
    assert.match((await r.json()).erreur, attendu);
  }
});

test('aucune commande n’est enregistree quand la validation echoue', async () => {
  await commander([{ id: 'pizza.licorne', qty: 1 }], 'mauvaise');
  assert.equal((await auComptoir()).commandes.length, 0);
  assert.equal(await interroger(), '', 'aucun ticket en file');
});

test('commande inconnue : 404', async () => {
  assert.equal((await fetch(base + '/api/commandes/inexistante')).status, 404);
});

test('chemin inconnu : 404', async () => {
  assert.equal((await fetch(base + '/nimporte/quoi')).status, 404);
});

// ============================================================== LES ACCES

test('le mauvais secret ne donne acces ni au comptoir ni a l’imprimante', async () => {
  assert.equal((await fetch(base + '/comptoir/mauvais-secret/commandes')).status, 404);

  const r = await fetch(base + '/imprimante/mauvais-secret', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'ConnectionType=GetRequest',
  });
  assert.equal(r.status, 404);
});

test('l’ecran du comptoir demande a ne pas etre indexe', async () => {
  const r = await fetch(base + COMPTOIR);

  assert.equal(r.status, 200);
  assert.match(r.headers.get('x-robots-tag'), /noindex/);
  assert.equal(r.headers.get('referrer-policy'), 'no-referrer');
});

// ============================================================== LES LIMITES

test('trop de commandes depuis le meme appareil : refus temporaire', async () => {
  for (let i = 0; i < config.limiteCommandes; i++) {
    assert.equal((await commander(PANIER, 'cle-' + i)).status, 201);
  }

  const detrop = await commander(PANIER, 'cle-detrop');
  assert.equal(detrop.status, 429);
  assert.match((await detrop.json()).erreur, /Trop de commandes/);
});

test('suspendre les commandes ferme la porte, reprendre la rouvre', async () => {
  await fetch(base + COMPTOIR + '/pause', { method: 'POST' });

  assert.equal((await fetch(base + '/api/etat')).status, 200);
  assert.equal((await (await fetch(base + '/api/etat')).json()).ouvert, false);

  const refus = await commander(PANIER, 'pendant-pause');
  assert.equal(refus.status, 503);
  assert.match((await refus.json()).erreur, /comptoir/i);

  await fetch(base + COMPTOIR + '/pause', { method: 'POST' });
  assert.equal((await commander(PANIER, 'apres-pause')).status, 201);
});

// ================================================================= LA PAGE

test('la page du client est servie avec la carte injectee', async () => {
  const html = await (await fetch(base + '/')).text();

  assert.match(html, /window\.COMPTOIR_MENU=/);
  assert.match(html, /pizza\.saumon-fume/, 'les identifiants de plats sont dans la page');
  assert.doesNotMatch(html, /<!--MENU_JSON-->/, 'le marqueur a bien ete remplace');
});

test('la carte injectee est celle que le serveur valide', async () => {
  const html = await (await fetch(base + '/')).text();
  const json = html.match(/window\.COMPTOIR_MENU=(\[.*?\]);<\/script>/s)[1];
  const carte = JSON.parse(json.replace(/\\u003c/g, '<'));

  // Un plat pris au hasard dans la page doit etre accepte par le serveur.
  const unPlat = carte[0].plats[0].id;
  assert.equal((await commander([{ id: unPlat, qty: 1 }], 'depuis-la-page')).status, 201);
});
