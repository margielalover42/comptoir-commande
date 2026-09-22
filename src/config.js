/**
 * La configuration, en un seul endroit.
 *
 * Tout se regle par variable d'environnement, avec une valeur par defaut qui
 * fonctionne en developpement. Rien de secret n'est ecrit en dur ici.
 */

/** Lit une variable d'environnement entiere, avec garde-fou. */
function entier(nom, defaut) {
  const brut = process.env[nom];
  if (brut === undefined) return defaut;
  const valeur = Number.parseInt(brut, 10);
  if (!Number.isFinite(valeur)) {
    throw new Error(`${nom} doit etre un nombre entier, recu : ${brut}`);
  }
  return valeur;
}

export const config = {
  port: entier('PORT', 3000),

  /**
   * En production, les pages sont lues une fois et gardees en memoire.
   * Ailleurs, elles sont relues a chaque requete : retoucher le HTML et
   * rafraichir suffit, sans redemarrer le serveur.
   */
  production: process.env.NODE_ENV === 'production',

  /** Le fichier SQLite. ':memory:' pour les tests. */
  cheminBase: process.env.DB_PATH ?? 'commandes.db',

  /**
   * Le segment secret des URLs de l'imprimante et du comptoir.
   *
   * En production, mettre une valeur longue et imprevisible : c'est la seule
   * chose qui protege l'ecran du comptoir. La valeur par defaut n'est la que
   * pour pouvoir lancer le projet sans rien configurer.
   */
  secretImprimante: process.env.PRINTER_SECRET ?? 'imprimante-dev',
  secretComptoir: process.env.STAFF_SECRET ?? 'comptoir-dev',

  /**
   * L'intervalle d'interrogation configure DANS l'imprimante, en secondes.
   * Le serveur ne le controle pas ; il a juste besoin de le connaitre pour
   * decider a partir de quand un silence signifie « hors ligne ».
   */
  intervalleImprimanteSec: entier('PRINTER_POLL_SECONDS', 3),

  /** Delai au-dela duquel un ticket parti sans reponse est declare echoue. */
  delaiReponseMs: entier('PRINT_ACK_TIMEOUT_MS', 60_000),

  /**
   * Replie les accents sur de l'ASCII (é -> e) avant d'imprimer.
   *
   * Les accents sur une imprimante thermique dependent de la page de codes
   * choisie par le micrologiciel. Si le premier essai sur papier sort des
   * « ? », passer ceci a true : un ticket lisible vaut mieux qu'un ticket
   * exact illisible.
   */
  ticketAscii: process.env.TICKET_ASCII === 'true',

  /**
   * Nombre de caracteres par ligne du ticket.
   * 48 = papier 80 mm en font_a ; 32 = papier 58 mm.
   */
  colonnes: entier('TICKET_COLUMNS', 48),

  /** Fuseau du commerce — sert a decider de quelle journee releve une commande. */
  fuseau: process.env.TIMEZONE ?? 'America/Toronto',

  /**
   * L'origine autorisee a appeler l'API depuis une autre adresse.
   *
   * Vide = aucune : la page et l'API vivent sur le meme hote, et le
   * navigateur n'a rien a autoriser. A remplir seulement si la page est
   * hebergee ailleurs que l'API — par exemple la page sur Netlify et l'API
   * sur un hebergeur Node. Exemple : 'https://sushi36.netlify.app'.
   */
  origineAutorisee: process.env.ALLOWED_ORIGIN ?? '',

  /** Limite anti-abus : nombre de commandes par adresse IP et par fenetre. */
  limiteCommandes: entier('RATE_LIMIT_COUNT', 5),
  limiteFenetreMs: entier('RATE_LIMIT_WINDOW_MS', 10 * 60_000),

  /** Une commande raisonnable : bornes au-dela desquelles c'est une erreur. */
  quantiteMax: 20,
  /* Assez pour « Marie-Christine », trop court pour un paragraphe sur le
     ticket de cuisine. */
  nomMax: 30,
  articlesMax: 40,
  tailleCorpsMax: 32 * 1024,
};
