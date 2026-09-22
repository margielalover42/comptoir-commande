/**
 * La galerie : les photos du commerce.
 *
 * Elle se remplit en DEPOSANT des fichiers dans `public/galerie/`. Aucun code
 * a modifier pour ajouter, retirer ou reordonner une photo — c'est le genre
 * de tache qu'on fait un mardi soir avant le service, pas en ouvrant un
 * editeur.
 *
 * L'ordre d'affichage est celui du nom de fichier : « 01-poke.jpg »,
 * « 02-nigiri.jpg »... Preferer des numeros en tete pour maitriser l'ordre.
 */

import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join, extname } from 'node:path';

const DOSSIER = join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'galerie');

/**
 * Les vignettes : les memes photos, en plus leger, pour la grille.
 *
 * Une photo de studio pese plusieurs Mo. En afficher neuf d'un coup dans une
 * grille ferait attendre une eternite sur un telephone — alors qu'a la
 * taille d'une tuile, personne ne verrait la difference. La pleine
 * resolution est reservee a l'agrandissement, ou elle se voit vraiment.
 */
const VIGNETTES = join(DOSSIER, 'vignettes');

/** Ce qu'un navigateur sait afficher, et rien d'autre. */
const TYPES = new Map([
  ['.jpg', 'image/jpeg'],
  ['.jpeg', 'image/jpeg'],
  ['.png', 'image/png'],
  ['.webp', 'image/webp'],
  ['.avif', 'image/avif'],
  ['.svg', 'image/svg+xml'],
]);

/**
 * Les photos presentes, dans l'ordre alphabetique des noms de fichiers.
 *
 * @param {string} [dossier]  autre dossier — sert aux tests
 * @returns {string[]} des noms de fichiers, jamais des chemins
 */
export function listerPhotos(dossier = DOSSIER) {
  let entrees;
  try {
    entrees = readdirSync(dossier, { withFileTypes: true });
  } catch {
    return []; // dossier absent : la galerie se cache d'elle-meme
  }

  return entrees
    .filter((e) => e.isFile() && TYPES.has(extname(e.name).toLowerCase()))
    .map((e) => e.name)
    .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));
}

/**
 * Le chemin sur disque d'une photo demandee par le navigateur.
 *
 * SECURITE — on ne construit JAMAIS un chemin a partir de ce que demande le
 * client. On relit le dossier et on ne sert que si le nom y figure
 * exactement. Un « ../../etc/passwd », un lien symbolique ou un nom encode
 * bizarrement ne peut donc pas sortir du dossier : il ne sera simplement
 * jamais dans la liste.
 *
 * @returns {{chemin: string, type: string} | null}
 */
export function trouverPhoto(nomDemande, dossier = DOSSIER) {
  if (typeof nomDemande !== 'string') return null;

  const nom = listerPhotos(dossier).find((p) => p === nomDemande);
  if (!nom) return null;

  return {
    chemin: join(dossier, nom),
    type: TYPES.get(extname(nom).toLowerCase()),
  };
}

/**
 * La vignette d'une photo, ou la photo elle-meme s'il n'y en a pas.
 *
 * Ce repli compte : une photo deposee a la main dans le dossier, sans passer
 * par le script de preparation, s'affiche quand meme. Elle sera seulement
 * plus lourde a charger.
 */
export function trouverVignette(nomDemande, dossier = DOSSIER) {
  return trouverPhoto(nomDemande, join(dossier, 'vignettes'))
      ?? trouverPhoto(nomDemande, dossier);
}
