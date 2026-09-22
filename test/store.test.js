/** Numeros de commande, idempotence, file d'impression. */

import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

import { ouvrirBase, ETAT } from '../src/store.js';

let store;
const T0 = new Date('2026-09-22T16:00:00Z');
const plus = (secondes) => new Date(T0.getTime() + secondes * 1000);

const ARTICLES = [
  { id: 'pizza.thon', quantite: 2, nomFr: 'Thon', sectionFr: 'Sushi Pizza',
    nomClient: 'Thon', sectionClient: 'Sushi Pizza' },
];

function poser(cleClient, journee = '2026-09-22', creeeA = T0) {
  return store.creerCommande({ cleClient, journee, articles: ARTICLES, langue: 'fr', creeeA });
}

beforeEach(() => { store = ouvrirBase(':memory:'); });

// ------------------------------------------------------------- les numeros

test('les numeros se suivent a partir de 1', () => {
  assert.equal(poser('a').commande.numero, 1);
  assert.equal(poser('b').commande.numero, 2);
  assert.equal(poser('c').commande.numero, 3);
});

test('chaque journee repart a 1', () => {
  poser('a', '2026-09-22');
  poser('b', '2026-09-22');
  assert.equal(poser('c', '2026-09-23').commande.numero, 1);
});

test('les numeros d’une meme journee ne se repetent jamais', () => {
  const vus = new Set();
  for (let i = 0; i < 40; i++) vus.add(poser('cle-' + i).commande.numero);

  assert.equal(vus.size, 40);
  assert.equal(Math.max(...vus), 40);
});

// ----------------------------------------------------------- l'idempotence

test('la meme cle client rend la meme commande, sans en creer une seconde', () => {
  const premier = poser('meme-cle');
  const second = poser('meme-cle');

  assert.equal(premier.nouvelle, true);
  assert.equal(second.nouvelle, false);
  assert.equal(second.commande.id, premier.commande.id);
  assert.equal(second.commande.numero, premier.commande.numero);
});

test('un renvoi ne remet pas de ticket en file', () => {
  poser('meme-cle');
  poser('meme-cle');
  poser('meme-cle');

  assert.ok(store.reclamerProchainTravail(T0), 'un ticket attendait');
  assert.equal(store.reclamerProchainTravail(T0), null, 'et un seul');
});

test('deux cles differentes donnent deux commandes', () => {
  assert.notEqual(poser('a').commande.id, poser('b').commande.id);
});

// ------------------------------------------------------------ l'impression

test('une commande met un ticket en file', () => {
  const { commande } = poser('a');
  assert.equal(commande.etatImpression, ETAT.EN_ATTENTE);
});

test('reclamer un ticket le marque comme parti', () => {
  const { commande } = poser('a');
  const travail = store.reclamerProchainTravail(T0);

  assert.equal(travail.commande.id, commande.id);
  assert.equal(store.commandeParId(commande.id).etatImpression, ETAT.ENVOYEE);
});

test('on ne remet jamais deux tickets a la fois', () => {
  poser('a');
  poser('b');

  assert.ok(store.reclamerProchainTravail(T0));
  assert.ok(store.reclamerProchainTravail(T0));
  assert.equal(store.reclamerProchainTravail(T0), null);
});

test('les tickets partent dans l’ordre d’arrivee', () => {
  const premier = poser('a').commande;
  const second = poser('b').commande;

  assert.equal(store.reclamerProchainTravail(T0).commande.id, premier.id);
  assert.equal(store.reclamerProchainTravail(T0).commande.id, second.id);
});

test('un accuse positif marque la commande imprimee', () => {
  const { commande } = poser('a');
  const travail = store.reclamerProchainTravail(T0);
  store.enregistrerResultat(travail.id, true, null, plus(1));

  assert.equal(store.commandeParId(commande.id).etatImpression, ETAT.IMPRIMEE);
});

test('un echec garde le code de l’imprimante et redonne une chance', () => {
  const { commande } = poser('a');
  const premier = store.reclamerProchainTravail(T0);
  store.enregistrerResultat(premier.id, false, 'EPTR_REC_EMPTY', plus(1));

  // Un reessai automatique est en file : l'etat courant repart a l'attente.
  assert.equal(store.commandeParId(commande.id).etatImpression, ETAT.EN_ATTENTE);
  assert.equal(store.travailParId(premier.id).code_erreur, 'EPTR_REC_EMPTY');

  const second = store.reclamerProchainTravail(plus(2));
  store.enregistrerResultat(second.id, false, 'EPTR_REC_EMPTY', plus(3));

  // Deuxieme echec : on arrete et on attend un humain.
  const finale = store.commandeParId(commande.id);
  assert.equal(finale.etatImpression, ETAT.ECHEC);
  assert.equal(finale.codeErreur, 'EPTR_REC_EMPTY');
  assert.equal(store.reclamerProchainTravail(plus(4)), null, 'pas de troisieme tentative');
});

test('un ticket parti sans reponse finit par etre declare echoue', () => {
  const { commande } = poser('a');
  store.reclamerProchainTravail(T0);

  assert.equal(store.expirerTravaux(plus(30), 60_000), 0, 'pas encore');
  assert.equal(store.commandeParId(commande.id).etatImpression, ETAT.ENVOYEE);

  assert.equal(store.expirerTravaux(plus(61), 60_000), 1);
  // Premiere tentative : un reessai est mis en file.
  assert.equal(store.commandeParId(commande.id).etatImpression, ETAT.EN_ATTENTE);
});

test('un accuse en retard sur un ticket deja expire est ignore', () => {
  poser('a');
  const travail = store.reclamerProchainTravail(T0);
  store.expirerTravaux(plus(61), 60_000);

  assert.equal(store.enregistrerResultat(travail.id, true, null, plus(62)), null);
  assert.equal(store.travailParId(travail.id).etat, ETAT.ECHEC);
});

test('un accuse pour un ticket inconnu ne fait rien', () => {
  assert.equal(store.enregistrerResultat('inexistant', true, null, T0), null);
});

test('la reimpression remet un ticket en file, marque comme tel', () => {
  const { commande } = poser('a');
  const travail = store.reclamerProchainTravail(T0);
  store.enregistrerResultat(travail.id, true, null, plus(1));

  store.reimprimer(commande.id, plus(10));
  const reprise = store.reclamerProchainTravail(plus(11));

  assert.equal(reprise.commande.id, commande.id);
  assert.equal(reprise.reimpression, 1);
});

test('reimprimer une commande inconnue ne fait rien', () => {
  assert.equal(store.reimprimer('inexistante', T0), null);
});

// ------------------------------------------------------------------ lecture

test('les commandes du jour sortent de la plus recente a la plus ancienne', () => {
  poser('a');
  poser('b');
  poser('c');

  assert.deepEqual(
    store.commandesDuJour('2026-09-22').map((c) => c.numero),
    [3, 2, 1],
  );
});

test('une autre journee n’apparait pas', () => {
  poser('a', '2026-09-21');
  poser('b', '2026-09-22');

  assert.equal(store.commandesDuJour('2026-09-22').length, 1);
});

test('la purge efface les journees passees et garde la courante', () => {
  poser('vieille', '2026-09-10');
  poser('recente', '2026-09-22');

  assert.equal(store.purger('2026-09-22'), 1);
  assert.equal(store.commandeParCleClient('vieille'), null);
  assert.ok(store.commandeParCleClient('recente'));
});

test('les articles sont figes : modifier la carte ne reecrit pas le passe', () => {
  const { commande } = poser('a');
  assert.deepEqual(store.commandeParId(commande.id).articles, ARTICLES);
});

// ----------------------------------------------------------------- reglages

test('un reglage se relit, avec une valeur par defaut si absent', () => {
  assert.equal(store.lireReglage('inconnu', 'defaut'), 'defaut');
  store.ecrireReglage('pause', true);
  assert.equal(store.lireReglage('pause'), 'true');
  store.ecrireReglage('pause', false);
  assert.equal(store.lireReglage('pause'), 'false');
});
