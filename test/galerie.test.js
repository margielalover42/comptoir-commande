/**
 * La galerie : ce qui est liste, et surtout ce qui ne doit jamais l'etre.
 *
 * Le dossier des photos est le seul endroit du systeme ou un nom venu du
 * navigateur sert a atteindre un fichier sur disque. C'est donc le seul
 * endroit ou une traversee de repertoire serait possible, et c'est ce que
 * ces tests verrouillent.
 */

import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, basename } from 'node:path';

import { listerPhotos, trouverPhoto } from '../src/galerie.js';

let dossier;

before(() => {
  dossier = mkdtempSync(join(tmpdir(), 'galerie-'));

  for (const nom of ['10-plateau.jpg', '2-nigiri.PNG', '1-poke.webp', 'photo.avif']) {
    writeFileSync(join(dossier, nom), 'image');
  }
  // Des intrus : ni images, ni fichiers.
  writeFileSync(join(dossier, 'notes.txt'), 'texte');
  writeFileSync(join(dossier, 'script.js'), 'alert(1)');
  writeFileSync(join(dossier, '.DS_Store'), 'bruit');
  mkdirSync(join(dossier, 'sous-dossier'));
});

after(() => rmSync(dossier, { recursive: true, force: true }));

// ------------------------------------------------------------- ce qu'on liste

test('ne garde que les images', () => {
  const photos = listerPhotos(dossier);

  assert.equal(photos.length, 4);
  for (const interdit of ['notes.txt', 'script.js', '.DS_Store', 'sous-dossier']) {
    assert.ok(!photos.includes(interdit), `${interdit} n’aurait pas du etre liste`);
  }
});

test('trie par numero, pas par texte', () => {
  // Un tri alphabetique brut mettrait « 10 » avant « 2 », et la vitrine
  // sortirait dans le desordre des qu'il y a plus de neuf photos.
  assert.deepEqual(listerPhotos(dossier),
    ['1-poke.webp', '2-nigiri.PNG', '10-plateau.jpg', 'photo.avif']);
});

test('accepte les extensions en majuscules', () => {
  assert.ok(listerPhotos(dossier).includes('2-nigiri.PNG'));
});

test('un dossier absent donne une galerie vide, pas une erreur', () => {
  // La galerie se cache alors d'elle-meme : mieux qu'une page en erreur
  // parce que personne n'a encore depose de photo.
  assert.deepEqual(listerPhotos(join(dossier, 'nexiste-pas')), []);
});

// ------------------------------------------------------- ce qu'on refuse

test('rend le chemin et le type d’une photo connue', () => {
  const photo = trouverPhoto('1-poke.webp', dossier);

  assert.equal(basename(photo.chemin), '1-poke.webp');
  assert.equal(photo.type, 'image/webp');
});

test('chaque extension a le bon type MIME', () => {
  assert.equal(trouverPhoto('10-plateau.jpg', dossier).type, 'image/jpeg');
  assert.equal(trouverPhoto('2-nigiri.PNG', dossier).type, 'image/png');
  assert.equal(trouverPhoto('photo.avif', dossier).type, 'image/avif');
});

const tentatives = [
  ['traversee simple', '../secret.txt'],
  ['traversee profonde', '../../../../etc/passwd'],
  ['traversee windows', '..\\..\\windows\\win.ini'],
  ['chemin absolu', '/etc/passwd'],
  ['chemin absolu windows', 'C:\\Windows\\win.ini'],
  ['fichier non image du dossier', 'notes.txt'],
  ['script du dossier', 'script.js'],
  ['sous-dossier', 'sous-dossier'],
  ['nom inconnu', 'inexistante.jpg'],
  ['chaine vide', ''],
  ['octet nul', '1-poke.webp\u0000.txt'],
  ['pas une chaine', 42],
  ['nul', null],
  ['objet', {}],
];

for (const [libelle, demande] of tentatives) {
  test(`refuse : ${libelle}`, () => {
    assert.equal(trouverPhoto(demande, dossier), null);
  });
}

test('un nom qui ressemble a une photo connue ne suffit pas', () => {
  // La comparaison est exacte : pas de prefixe, pas de suffixe, pas de casse
  // approchante.
  for (const presque of ['1-poke.webp ', ' 1-poke.webp', '1-POKE.WEBP', '1-poke.web']) {
    assert.equal(trouverPhoto(presque, dossier), null, presque);
  }
});
