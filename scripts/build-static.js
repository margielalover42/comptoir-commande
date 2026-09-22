/**
 * Produit une page autonome, a deposer sur un hebergeur statique.
 *
 * A QUOI CELA SERT
 * Le serveur de commandes doit tourner quelque part : il tient les commandes
 * et c'est lui que l'imprimante interroge. Un hebergeur statique comme
 * Netlify ne peut pas le faire tourner. Il peut en revanche tres bien servir
 * la PAGE, l'API vivant ailleurs.
 *
 *   node scripts/build-static.js                      # carte consultable seule
 *   node scripts/build-static.js --api=https://…      # commande active
 *
 * Sans --api, la page reste une belle carte consultable : les compteurs
 * fonctionnent, l'envoi echoue proprement. Pratique pour montrer le rendu
 * a quelqu'un sans rien deployer d'autre.
 *
 * Avec --api, renseigner ALLOWED_ORIGIN cote serveur avec l'adresse
 * publique de cette page, sans quoi le navigateur bloquera les appels.
 */

import { readFileSync, writeFileSync, mkdirSync, cpSync, rmSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { CARTE } from '../src/menu.js';
import { listerPhotos } from '../src/galerie.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');

const api = process.argv.slice(2)
  .find((a) => a.startsWith('--api='))?.split('=')[1]
  ?? '';

// Sans barre finale : la page ajoute « /api/... » derriere.
const base = api.replace(/\/$/, '');

const photos = listerPhotos();

/* La galerie doit etre injectee ici AUSSI. Le serveur le fait a chaque
   requete ; une page statique n'a personne pour le faire a sa place, et la
   galerie disparaitrait sans bruit. */
const page = readFileSync(join(RACINE, 'public', 'index.html'), 'utf8').replace(
  '<!--MENU_JSON-->',
  '<script>'
  + `window.COMPTOIR_MENU=${json(CARTE)};`
  + `window.COMPTOIR_GALERIE=${json(photos)};`
  + `window.COMPTOIR_API=${json(base)};`
  + '</script>',
);

const dist = join(RACINE, 'dist');
mkdirSync(dist, { recursive: true });
writeFileSync(join(dist, 'index.html'), page);

/* Les photos sont servies par une route du serveur, qui n'existe pas sur un
   hebergeur statique. On les copie donc telles quelles : `/galerie/x.jpg` et
   `/galerie/vignettes/x.jpg` deviennent de simples fichiers. */
const sourcePhotos = join(RACINE, 'public', 'galerie');
if (existsSync(sourcePhotos)) {
  rmSync(join(dist, 'galerie'), { recursive: true, force: true });
  cpSync(sourcePhotos, join(dist, 'galerie'), { recursive: true });
}

console.log(`dist/index.html ecrit (${Math.round(page.length / 1024)} Ko)`);
console.log(`  ${photos.length} photo(s) de galerie copiee(s)`);
console.log(base
  ? `  commandes envoyees a ${base}\n  pensez a ALLOWED_ORIGIN sur le serveur`
  : '  carte consultable seule — relancer avec --api=https://... pour activer la commande');

/** Sur a l'interieur d'une balise <script> : « </script> » ne doit rien fermer. */
function json(valeur) {
  return JSON.stringify(valeur).replace(/</g, '\\u003c');
}
