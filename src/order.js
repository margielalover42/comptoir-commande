/**
 * La validation d'une commande recue d'un telephone.
 *
 * Fonction pure : elle prend ce qu'a envoye le client et rend soit une
 * commande propre, soit une erreur lisible. Elle ne touche ni la base, ni le
 * reseau, ni l'horloge — c'est ce qui la rend simple a tester.
 *
 * REGLE : rien de ce qui vient du telephone n'est cru sur parole. Le nom des
 * plats n'est JAMAIS repris de la requete ; il est relu dans la carte a
 * partir de l'identifiant. Un client qui bricole sa requete ne peut donc pas
 * faire imprimer du texte de son choix en cuisine.
 */

import { PLATS_PAR_ID, nomPlat, nomSection } from './menu.js';
import { config } from './config.js';

export class ErreurCommande extends Error {
  constructor(message) {
    super(message);
    this.name = 'ErreurCommande';
  }
}

/**
 * Valide le corps d'une requete de commande.
 *
 * @param {unknown} corps  l'objet JSON envoye par le telephone
 * @returns {{clientOrderId: string, langue: 'fr'|'en', articles: Array}}
 * @throws {ErreurCommande} avec un message en francais, destine a l'ecran
 */
export function validerCommande(corps) {
  if (corps === null || typeof corps !== 'object' || Array.isArray(corps)) {
    throw new ErreurCommande('Commande illisible.');
  }

  const clientOrderId = validerCleClient(corps.clientOrderId);
  const langue = corps.lang === 'en' ? 'en' : 'fr';
  const articles = validerArticles(corps.items, langue);

  return { clientOrderId, langue, articles };
}

/**
 * La cle d'idempotence : c'est elle qui empeche un double envoi de devenir
 * deux commandes. Le telephone la genere une fois et la renvoie a chaque
 * tentative.
 */
function validerCleClient(valeur) {
  if (typeof valeur !== 'string' || valeur.length === 0) {
    throw new ErreurCommande('Commande incomplete.');
  }
  // Assez long pour ne pas se croiser par hasard, assez court pour une cle.
  if (valeur.length > 100 || !/^[A-Za-z0-9_-]+$/.test(valeur)) {
    throw new ErreurCommande('Commande incomplete.');
  }
  return valeur;
}

function validerArticles(items, langue) {
  if (!Array.isArray(items) || items.length === 0) {
    throw new ErreurCommande('Votre commande est vide.');
  }

  const quantiteParId = new Map();

  for (const ligne of items) {
    if (ligne === null || typeof ligne !== 'object') {
      throw new ErreurCommande('Commande illisible.');
    }

    const entree = PLATS_PAR_ID.get(ligne.id);
    if (!entree) {
      throw new ErreurCommande('Un plat de votre commande n’est plus au menu.');
    }

    const quantite = validerQuantite(ligne.qty);

    // Deux lignes pour le meme plat : on additionne plutot que de refuser.
    // C'est ce qu'attend quelqu'un qui a ajoute le meme plat en deux fois.
    const total = (quantiteParId.get(ligne.id) ?? 0) + quantite;
    if (total > config.quantiteMax) {
      throw new ErreurCommande(
        `Maximum ${config.quantiteMax} par plat. Voyez avec le comptoir pour une grosse commande.`,
      );
    }
    quantiteParId.set(ligne.id, total);
  }

  const articles = [...quantiteParId].map(([id, quantite]) => {
    const { plat, section } = PLATS_PAR_ID.get(id);
    return {
      id,
      quantite,
      // Les noms sont FIGES ici. Modifier la carte demain ne doit pas
      // reecrire une commande deja passee.
      nomFr: plat.fr,
      sectionFr: section.fr,
      nomClient: nomPlat(plat, langue),
      sectionClient: nomSection(section, langue),
    };
  });

  const total = articles.reduce((somme, a) => somme + a.quantite, 0);
  if (total > config.articlesMax) {
    throw new ErreurCommande(
      `Maximum ${config.articlesMax} articles. Voyez avec le comptoir pour une grosse commande.`,
    );
  }

  return articles;
}

function validerQuantite(valeur) {
  if (!Number.isInteger(valeur) || valeur < 1 || valeur > config.quantiteMax) {
    throw new ErreurCommande('Quantité invalide.');
  }
  return valeur;
}

/** Le nombre total d'articles d'une commande. */
export function compterArticles(articles) {
  return articles.reduce((somme, a) => somme + a.quantite, 0);
}
