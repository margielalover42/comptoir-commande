/** Le ticket de cuisine : la sortie la plus importante du systeme. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { construireTicket } from '../src/ticket.js';
import { config } from '../src/config.js';

const COMMANDE = {
  numero: 482,
  nom: 'Thomas',
  creeeA: new Date('2026-09-22T16:41:00Z'), // 12h41 a Montreal
  articles: [
    { quantite: 2, nomFr: 'Saumon Fumé', sectionFr: 'Sushi Pizza' },
    { quantite: 1, nomFr: 'Homard', sectionFr: 'Poké Bol' },
  ],
};

/** Le texte tel qu'il sortira sur le papier, sans le balisage. */
function surPapier(xml) {
  return [...xml.matchAll(/<text>([^<]*)<\/text>/g)]
    .map((m) => m[1])
    .join('')
    .replace(/&#10;/g, '\n')
    .replace(/&amp;/g, '&').replace(/&apos;/g, "'").replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>');
}

test('porte le numero, les plats et leur section', () => {
  const papier = surPapier(construireTicket(COMMANDE));

  assert.match(papier, /#482/);
  assert.match(papier, /2x SAUMON FUMÉ/);
  assert.match(papier, /Sushi Pizza/);
  assert.match(papier, /1x HOMARD/);
  assert.match(papier, /Poké Bol/);
});

test('la section accompagne chaque plat', () => {
  // « Saumon » existe en poke, en pizza et en nigiri : sans la section, la
  // cuisine ne sait pas lequel preparer.
  const papier = surPapier(construireTicket(COMMANDE));
  const lignes = papier.split('\n');

  const i = lignes.findIndex((l) => l.includes('HOMARD'));
  assert.match(lignes[i + 1], /Poké Bol/);
});

test('affiche l’heure locale du commerce', () => {
  assert.match(surPapier(construireTicket(COMMANDE)), /12h41/);
});

test('compte les articles', () => {
  assert.match(surPapier(construireTicket(COMMANDE)), /3 articles/);
});

test('accorde le singulier', () => {
  const seul = { ...COMMANDE, articles: [COMMANDE.articles[1]] };
  const papier = surPapier(construireTicket(seul));

  assert.match(papier, /1 article\n/);
  assert.doesNotMatch(papier, /1 articles/);
});

test('porte toujours NON PAYE', () => {
  // Le paiement est manuel : un ticket ne doit jamais passer pour regle.
  assert.match(surPapier(construireTicket(COMMANDE)), /NON PAYE - ENCAISSER/);
});

test('une reimpression est annoncee, une impression normale ne l’est pas', () => {
  assert.match(surPapier(construireTicket(COMMANDE, { reimpression: true })), /REIMPRESSION/);
  assert.doesNotMatch(surPapier(construireTicket(COMMANDE)), /REIMPRESSION/);
});

test('la reimpression est en tete, avant le numero', () => {
  const papier = surPapier(construireTicket(COMMANDE, { reimpression: true }));
  assert.ok(papier.indexOf('REIMPRESSION') < papier.indexOf('#482'));
});

test('coupe le papier a la fin', () => {
  assert.match(construireTicket(COMMANDE), /<cut type="feed"\/>/);
});

test('le XML est bien forme et dans le bon espace de noms', () => {
  const xml = construireTicket(COMMANDE);

  assert.ok(xml.startsWith('<epos-print xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print">'));
  assert.ok(xml.endsWith('</epos-print>'));

  // Aucune balise ouverte laissee derriere.
  const ouvrants = (xml.match(/<text>/g) ?? []).length;
  const fermants = (xml.match(/<\/text>/g) ?? []).length;
  assert.equal(ouvrants, fermants);
});

test('echappe les caracteres qui casseraient le XML', () => {
  const piege = {
    ...COMMANDE,
    articles: [{ quantite: 1, nomFr: 'Fish & <Chips>', sectionFr: '"Extras"' }],
  };
  const xml = construireTicket(piege);

  assert.match(xml, /&amp;/);
  assert.doesNotMatch(xml, /<Chips>/, 'le nom ne doit pas devenir une balise');
  assert.match(surPapier(xml), /FISH & <CHIPS>/);
});

test('coupe un nom trop long sans deborder de la largeur du papier', () => {
  const long = {
    ...COMMANDE,
    articles: [{
      quantite: 1,
      nomFr: 'Crevettes tempura sucrées avec goberge, salade mixte et sauce épicée maison',
      sectionFr: 'Futomakis',
    }],
  };

  for (const ligne of surPapier(construireTicket(long)).split('\n')) {
    assert.ok(ligne.length <= config.colonnes, `ligne trop longue (${ligne.length}) : ${ligne}`);
  }
});

test('coupe net un mot plus long qu’une ligne', () => {
  const impossible = {
    ...COMMANDE,
    articles: [{ quantite: 1, nomFr: 'A'.repeat(120), sectionFr: 'Extras' }],
  };

  const lignes = surPapier(construireTicket(impossible)).split('\n');
  for (const ligne of lignes) assert.ok(ligne.length <= config.colonnes);
  assert.ok(lignes.some((l) => l.includes('AAAA')));
});

test('le repli ASCII enleve les accents quand il est actif', () => {
  const normal = config.ticketAscii;
  try {
    config.ticketAscii = true;
    const papier = surPapier(construireTicket(COMMANDE));

    assert.match(papier, /SAUMON FUME/);
    assert.match(papier, /Poke Bol/);
    assert.doesNotMatch(papier, /É|é/);
  } finally {
    config.ticketAscii = normal;
  }
});

test('le repli ASCII traite aussi Œ et les tirets longs', () => {
  const normal = config.ticketAscii;
  try {
    config.ticketAscii = true;
    const papier = surPapier(construireTicket({
      ...COMMANDE,
      articles: [{ quantite: 1, nomFr: 'Œil de Dragon', sectionFr: 'Maguro — Nigiri' }],
    }));

    assert.match(papier, /OEIL DE DRAGON/);
    assert.match(papier, /Maguro - Nigiri/);
  } finally {
    config.ticketAscii = normal;
  }
});

test('sans repli, les accents sont conserves tels quels', () => {
  assert.match(surPapier(construireTicket(COMMANDE)), /SAUMON FUMÉ/);
});
