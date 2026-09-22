/** La journee de service : elle bascule a 04h00, pas a minuit. */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { journeeDeService, horodatageLisible, heureLisible } from '../src/day.js';

const TZ = 'America/Toronto';

/** Un instant donne en heure de Montreal (l'ete, UTC-4). */
const montreal = (iso) => new Date(`${iso}-04:00`);

test('un midi appartient a sa propre journee', () => {
  assert.equal(journeeDeService(montreal('2026-09-22T12:30:00'), TZ), '2026-09-22');
});

test('23h59 appartient encore a sa journee', () => {
  assert.equal(journeeDeService(montreal('2026-09-22T23:59:00'), TZ), '2026-09-22');
});

test('00h30 appartient encore au service de la veille', () => {
  // Sinon deux clients du meme coup de feu recoivent tous deux le numero 3.
  assert.equal(journeeDeService(montreal('2026-09-23T00:30:00'), TZ), '2026-09-22');
});

test('03h59 appartient encore a la veille, 04h00 ouvre la journee', () => {
  assert.equal(journeeDeService(montreal('2026-09-23T03:59:00'), TZ), '2026-09-22');
  assert.equal(journeeDeService(montreal('2026-09-23T04:00:00'), TZ), '2026-09-23');
});

test('bascule correctement un debut de mois', () => {
  assert.equal(journeeDeService(montreal('2026-10-01T02:00:00'), TZ), '2026-09-30');
});

test('bascule correctement un debut d’annee', () => {
  assert.equal(journeeDeService(new Date('2027-01-01T02:00:00-05:00'), TZ), '2026-12-31');
});

test('suit le fuseau du commerce, pas celui du serveur', () => {
  // 02h00 a Montreal = 06h00 UTC. Un serveur en UTC se tromperait de journee.
  const instant = new Date('2026-09-23T06:00:00Z');
  assert.equal(journeeDeService(instant, TZ), '2026-09-22');
  assert.equal(journeeDeService(instant, 'UTC'), '2026-09-23');
});

test('l’horodatage du ticket est lisible et en heure locale', () => {
  const texte = horodatageLisible(montreal('2026-09-22T12:41:00'), TZ);
  assert.match(texte, /12h41$/);
  assert.match(texte, /sept/);
});

test('l’heure du comptoir est zero-remplie', () => {
  assert.equal(heureLisible(montreal('2026-09-22T09:05:00'), TZ), '09h05');
});
