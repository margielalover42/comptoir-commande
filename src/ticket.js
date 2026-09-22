/**
 * Le ticket de cuisine, au format ePOS-Print XML.
 *
 * Fonction pure : une commande entre, du XML sort. Aucune impression reelle
 * n'a lieu ici, ce qui permet de verifier la mise en page sans papier.
 *
 * TROIS CHOIX DELIBERES :
 *
 * 1. Le ticket est TOUJOURS en francais, meme si le client a navigue en
 *    anglais. Il est lu par la cuisine, et les noms doivent correspondre au
 *    vocabulaire du comptoir.
 *
 * 2. « NON PAYE » figure sur chaque ticket. Le paiement est manuel, au
 *    comptoir : un ticket imprime ne doit jamais pouvoir passer pour une
 *    commande deja reglee.
 *
 * 3. Une reimpression porte « REIMPRESSION » en tete, pour qu'un ticket
 *    ressorti ne devienne pas une deuxieme portion.
 */

import { config } from './config.js';
import { horodatageLisible } from './day.js';
import { compterArticles } from './order.js';

const NAMESPACE = 'http://www.epson-pos.com/schemas/2011/03/epos-print';

/**
 * Construit le XML d'un ticket.
 *
 * @param {object} commande  { numero, articles, creeeA }
 * @param {{reimpression?: boolean}} options
 * @returns {string} le contenu `<epos-print>`
 */
export function construireTicket(commande, options = {}) {
  const l = [];
  const ecrire = (texte) => l.push(ligne(texte));

  l.push('<text lang="en"/>', '<text smooth="true"/>');

  if (options.reimpression) {
    l.push('<text align="center"/>', '<text em="true"/>');
    ecrire('*** REIMPRESSION ***');
    ecrire('(ne pas refaire si deja servi)');
    l.push('<text em="false"/>', '<feed line="1"/>');
  }

  // L'en-tete
  l.push('<text align="center"/>');
  ecrire('COMPTOIR SUSHI 36');
  ecrire('C U I S I N E');
  l.push('<feed line="1"/>');

  // Le numero, en tres gros : c'est ce que le client dira au comptoir.
  l.push('<text width="3" height="3"/>', '<text em="true"/>');
  ecrire(`#${commande.numero}`);
  l.push('<text em="false"/>', '<text width="1" height="1"/>');
  ecrire(horodatageLisible(commande.creeeA, config.fuseau));

  // Les plats
  l.push('<text align="left"/>', '<feed line="1"/>');
  ecrire(separateur());

  for (const article of commande.articles) {
    for (const texte of lignesArticle(article)) ecrire(texte);
    l.push('<feed line="1"/>');
  }

  ecrire(separateur());

  // Le pied
  l.push('<text align="center"/>');
  const total = compterArticles(commande.articles);
  ecrire(`${total} ${total > 1 ? 'articles' : 'article'}`);
  l.push('<feed line="1"/>', '<text em="true"/>');
  ecrire('** NON PAYE - ENCAISSER **');
  l.push('<text em="false"/>');

  l.push('<feed line="3"/>', '<cut type="feed"/>');

  return `<epos-print xmlns="${NAMESPACE}">${l.join('')}</epos-print>`;
}

/**
 * Les lignes d'un article : la quantite et le nom, puis la section en
 * dessous. La section compte — « Saumon » existe en poke, en pizza et en
 * nigiri, et la cuisine doit savoir lequel preparer.
 */
function lignesArticle(article) {
  const prefixe = `${article.quantite}x `;
  const retrait = ' '.repeat(prefixe.length);

  const nom = couper(article.nomFr.toUpperCase(), config.colonnes - prefixe.length);
  const section = couper(article.sectionFr, config.colonnes - prefixe.length);

  return [
    ...nom.map((texte, i) => (i === 0 ? prefixe : retrait) + texte),
    ...section.map((texte) => retrait + texte),
  ];
}

/**
 * Coupe un texte a la largeur du papier, sans couper un mot en deux.
 * Un mot plus long que la ligne est coupe net : mieux vaut tronquer que
 * deborder et perdre la fin.
 */
function couper(texte, largeur) {
  const lignes = [];
  let courante = '';

  for (const mot of texte.split(' ')) {
    if (courante === '') {
      courante = mot;
    } else if (courante.length + 1 + mot.length <= largeur) {
      courante += ' ' + mot;
    } else {
      lignes.push(courante);
      courante = mot;
    }

    while (courante.length > largeur) {
      lignes.push(courante.slice(0, largeur));
      courante = courante.slice(largeur);
    }
  }

  if (courante !== '') lignes.push(courante);
  return lignes.length > 0 ? lignes : [''];
}

function separateur() {
  return '-'.repeat(config.colonnes);
}

/** Une ligne de texte suivie d'un retour a la ligne. */
function ligne(texte) {
  return `<text>${echapper(preparer(texte))}&#10;</text>`;
}

/**
 * Prepare un texte pour l'imprimante : repli ASCII si demande.
 *
 * Les accents sur une imprimante thermique dependent de la page de codes que
 * choisit le micrologiciel. Si le premier essai sur papier sort des « ? »,
 * TICKET_ASCII=true rend le ticket lisible, ce qui vaut mieux qu'exact.
 */
function preparer(texte) {
  if (!config.ticketAscii) return texte;

  return texte
    .replace(/Œ/g, 'OE').replace(/œ/g, 'oe')
    .replace(/[’‘]/g, "'").replace(/[—–]/g, '-')
    .normalize('NFD').replace(/\p{Diacritic}/gu, '');
}

/** Echappement XML. Sans lui, un nom contenant « & » casserait le ticket. */
function echapper(texte) {
  return texte
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}
