/**
 * La base de donnees : commandes, travaux d'impression, reglages.
 *
 * SQLite sur disque, via le module `node:sqlite` livre avec Node 24. Aucune
 * dependance a installer, et les commandes survivent a un redemarrage du
 * serveur — ce qui compte un midi de rush.
 *
 * Un TRAVAIL D'IMPRESSION est une tentative d'imprimer une commande. Une
 * commande en a au moins un, et en gagne un nouveau a chaque reessai ou
 * reimpression. L'etat d'impression d'une commande est celui de son travail
 * le plus recent.
 */

import { DatabaseSync } from 'node:sqlite';
import { randomUUID, randomInt } from 'node:crypto';

import { numeroPourRang, decalageAleatoire } from './numero.js';

/** Les etats possibles d'un travail d'impression. */
export const ETAT = {
  EN_ATTENTE: 'en_attente', // en file, pas encore reclame par l'imprimante
  ENVOYEE: 'envoyee',       // remis a l'imprimante, on attend son verdict
  IMPRIMEE: 'imprimee',     // l'imprimante a confirme
  ECHEC: 'echec',           // l'imprimante a signale une erreur, ou n'a rien dit
};

/** Nombre total de tentatives automatiques avant d'attendre un humain. */
const TENTATIVES_MAX = 2;

export function ouvrirBase(chemin) {
  const db = new DatabaseSync(chemin);

  // WAL : les lectures de l'ecran du comptoir ne bloquent pas l'ecriture
  // d'une nouvelle commande. Sans effet en memoire, sans danger non plus.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');

  db.exec(`
    CREATE TABLE IF NOT EXISTS commandes (
      id              TEXT PRIMARY KEY,
      cle_client      TEXT NOT NULL UNIQUE,
      journee         TEXT NOT NULL,
      rang            INTEGER NOT NULL,
      numero          INTEGER NOT NULL,
      nom             TEXT NOT NULL,
      articles_json   TEXT NOT NULL,
      langue          TEXT NOT NULL,
      creee_a         INTEGER NOT NULL,
      -- rang est la position dans la journee, numero ce qu'on affiche.
      -- Les deux contraintes disent la meme chose si le melange est correct :
      -- la seconde est le garde-fou qui hurlerait s'il cessait de l'etre.
      UNIQUE (journee, rang),
      UNIQUE (journee, numero)
    );

    CREATE TABLE IF NOT EXISTS travaux (
      id            TEXT PRIMARY KEY,
      commande_id   TEXT NOT NULL REFERENCES commandes(id),
      tentative     INTEGER NOT NULL,
      reimpression  INTEGER NOT NULL DEFAULT 0,
      etat          TEXT NOT NULL,
      code_erreur   TEXT,
      creee_a       INTEGER NOT NULL,
      reclamee_a    INTEGER,
      terminee_a    INTEGER
    );

    CREATE INDEX IF NOT EXISTS idx_travaux_etat ON travaux(etat, creee_a);
    CREATE INDEX IF NOT EXISTS idx_commandes_journee ON commandes(journee, numero);

    CREATE TABLE IF NOT EXISTS reglages (
      cle     TEXT PRIMARY KEY,
      valeur  TEXT NOT NULL
    );
  `);

  return new Store(db);
}

class Store {
  #db;

  constructor(db) {
    this.#db = db;
  }

  close() {
    this.#db.close();
  }

  // ---------------------------------------------------------------- commandes

  /**
   * Enregistre une commande et met son ticket en file.
   *
   * Idempotent : rappele avec la meme `cleClient`, il rend la commande deja
   * enregistree sans en creer une seconde ni remettre un ticket en file.
   * C'est ce qui fait qu'un double tap, ou un reessai apres une coupure
   * reseau, ne produit jamais deux plats.
   *
   * @returns {{commande: object, nouvelle: boolean}}
   */
  creerCommande({ cleClient, journee, nom, articles, langue, creeeA }) {
    const existante = this.commandeParCleClient(cleClient);
    if (existante) return { commande: existante, nouvelle: false };

    const id = randomUUID();

    // BEGIN IMMEDIATE prend le verrou d'ecriture tout de suite : le calcul du
    // rang et l'insertion forment un seul bloc, et deux commandes simultanees
    // ne peuvent pas obtenir le meme numero.
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      const rang = this.#db
        .prepare('SELECT COALESCE(MAX(rang), -1) + 1 AS suivant FROM commandes WHERE journee = ?')
        .get(journee).suivant;

      const numero = numeroPourRang(rang, this.#decalageDuJour(journee));

      this.#db.prepare(`
        INSERT INTO commandes (id, cle_client, journee, rang, numero, nom, articles_json, langue, creee_a)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(id, cleClient, journee, rang, numero, nom,
             JSON.stringify(articles), langue, creeeA.getTime());

      this.#creerTravail(id, 1, false, creeeA);
      this.#db.exec('COMMIT');
    } catch (erreur) {
      this.#db.exec('ROLLBACK');

      // Course perdue : un autre appel avec la meme cle est passe entre le
      // test et l'insertion. La bonne reponse est sa commande, pas une erreur.
      const concurrente = this.commandeParCleClient(cleClient);
      if (concurrente) return { commande: concurrente, nouvelle: false };
      throw erreur;
    }

    return { commande: this.commandeParId(id), nouvelle: true };
  }

  commandeParId(id) {
    return this.#enrichir(
      this.#db.prepare('SELECT * FROM commandes WHERE id = ?').get(id),
    );
  }

  commandeParCleClient(cleClient) {
    return this.#enrichir(
      this.#db.prepare('SELECT * FROM commandes WHERE cle_client = ?').get(cleClient),
    );
  }

  /**
   * Les commandes d'une journee de service, la plus recente en premier.
   *
   * On trie sur `rang`, pas sur `numero` : les numeros sont melanges, et
   * trier dessus donnerait au comptoir une liste dans le desordre.
   */
  commandesDuJour(journee) {
    return this.#db
      .prepare('SELECT * FROM commandes WHERE journee = ? ORDER BY rang DESC')
      .all(journee)
      .map((ligne) => this.#enrichir(ligne));
  }

  /** Supprime les commandes anterieures a `journee`. Rien de personnel n'y est garde. */
  purger(journee) {
    this.#db.exec('BEGIN IMMEDIATE');
    try {
      this.#db.prepare(`
        DELETE FROM travaux WHERE commande_id IN (SELECT id FROM commandes WHERE journee < ?)
      `).run(journee);
      const { changes } = this.#db.prepare('DELETE FROM commandes WHERE journee < ?').run(journee);

      // Les decalages des journees effacees ne servent plus a rien.
      this.#db.prepare(`
        DELETE FROM reglages WHERE cle LIKE 'numero.decalage.%' AND substr(cle, 17) < ?
      `).run(journee);

      this.#db.exec('COMMIT');
      return Number(changes);
    } catch (erreur) {
      this.#db.exec('ROLLBACK');
      throw erreur;
    }
  }

  // ------------------------------------------------------------- impression

  /**
   * Reclame le prochain ticket a imprimer, et le marque comme parti.
   *
   * On n'en rend qu'UN a la fois. Pas pour menager l'imprimante, mais pour
   * que son verdict soit toujours attribuable : les micrologiciels anciens
   * repondent sans rappeler l'identifiant du travail.
   */
  reclamerProchainTravail(maintenant) {
    const travail = this.#db.prepare(`
      SELECT * FROM travaux WHERE etat = ? ORDER BY creee_a, rowid LIMIT 1
    `).get(ETAT.EN_ATTENTE);

    if (!travail) return null;

    this.#db.prepare('UPDATE travaux SET etat = ?, reclamee_a = ? WHERE id = ?')
      .run(ETAT.ENVOYEE, maintenant.getTime(), travail.id);

    return { ...travail, commande: this.commandeParId(travail.commande_id) };
  }

  travailParId(id) {
    return this.#db.prepare('SELECT * FROM travaux WHERE id = ?').get(id) ?? null;
  }

  /** Le dernier travail parti sans reponse — pour les imprimantes qui ne renvoient pas l'identifiant. */
  dernierTravailEnvoye() {
    return this.#db.prepare(`
      SELECT * FROM travaux WHERE etat = ? ORDER BY reclamee_a DESC LIMIT 1
    `).get(ETAT.ENVOYEE) ?? null;
  }

  /**
   * Enregistre le verdict de l'imprimante.
   *
   * Un echec donne droit a un reessai automatique, une seule fois. Au-dela,
   * le travail reste en echec et attend un humain : reessayer en boucle sur
   * un bac a papier vide ne fait qu'ajouter du bruit.
   */
  enregistrerResultat(travailId, reussi, codeErreur, maintenant) {
    const travail = this.travailParId(travailId);
    if (!travail || travail.etat !== ETAT.ENVOYEE) return null;

    this.#db.prepare('UPDATE travaux SET etat = ?, code_erreur = ?, terminee_a = ? WHERE id = ?')
      .run(reussi ? ETAT.IMPRIMEE : ETAT.ECHEC, codeErreur ?? null, maintenant.getTime(), travailId);

    if (!reussi && travail.tentative < TENTATIVES_MAX) {
      this.#creerTravail(travail.commande_id, travail.tentative + 1, Boolean(travail.reimpression), maintenant);
    }

    return this.travailParId(travailId);
  }

  /**
   * Declare echoues les tickets partis depuis trop longtemps sans reponse.
   *
   * Sans ce balayage, une imprimante debranchee en plein envoi laisserait la
   * commande « en cours » pour toujours, et l'ecran du comptoir mentirait.
   */
  expirerTravaux(maintenant, delaiMs) {
    const limite = maintenant.getTime() - delaiMs;
    const expires = this.#db.prepare(`
      SELECT * FROM travaux WHERE etat = ? AND reclamee_a < ?
    `).all(ETAT.ENVOYEE, limite);

    for (const travail of expires) {
      this.enregistrerResultat(travail.id, false, 'DELAI_DEPASSE', maintenant);
    }
    return expires.length;
  }

  /** Remet une commande en file, marquee comme reimpression. */
  reimprimer(commandeId, maintenant) {
    const commande = this.commandeParId(commandeId);
    if (!commande) return null;

    const tentative = this.#db
      .prepare('SELECT COALESCE(MAX(tentative), 0) AS max FROM travaux WHERE commande_id = ?')
      .get(commandeId).max;

    return this.#creerTravail(commandeId, tentative + 1, true, maintenant);
  }

  /**
   * Le decalage de depart de la journee, tire au premier usage.
   *
   * Il est conserve : toutes les commandes d'une meme journee doivent
   * parcourir le MEME melange, sinon deux d'entre elles pourraient tomber
   * sur le meme numero. Le redemarrage du serveur en plein service ne doit
   * donc pas le perdre — d'ou la base plutot que la memoire.
   */
  #decalageDuJour(journee) {
    const cle = `numero.decalage.${journee}`;
    const connu = this.lireReglage(cle);
    if (connu !== null) return Number(connu);

    const decalage = decalageAleatoire((max) => randomInt(max));
    this.ecrireReglage(cle, decalage);
    return decalage;
  }

  #creerTravail(commandeId, tentative, reimpression, maintenant) {
    // L'identifiant part dans le XML vers l'imprimante, qui n'accepte que
    // 1 a 30 caracteres alphanumeriques : pas de tirets, donc pas d'UUID brut.
    const id = randomUUID().replace(/-/g, '').slice(0, 30);

    this.#db.prepare(`
      INSERT INTO travaux (id, commande_id, tentative, reimpression, etat, creee_a)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(id, commandeId, tentative, reimpression ? 1 : 0, ETAT.EN_ATTENTE, maintenant.getTime());

    return this.travailParId(id);
  }

  // --------------------------------------------------------------- reglages

  lireReglage(cle, defaut = null) {
    return this.#db.prepare('SELECT valeur FROM reglages WHERE cle = ?').get(cle)?.valeur ?? defaut;
  }

  ecrireReglage(cle, valeur) {
    this.#db.prepare(`
      INSERT INTO reglages (cle, valeur) VALUES (?, ?)
      ON CONFLICT(cle) DO UPDATE SET valeur = excluded.valeur
    `).run(cle, String(valeur));
  }

  // ----------------------------------------------------------------- interne

  /**
   * Complete une ligne de la table par ce qui n'y est pas stocke : les
   * articles decodes et l'etat d'impression courant.
   */
  #enrichir(rang) {
    if (!rang) return null;

    const dernier = this.#db.prepare(`
      SELECT * FROM travaux WHERE commande_id = ? ORDER BY creee_a DESC, rowid DESC LIMIT 1
    `).get(rang.id);

    return {
      id: rang.id,
      cleClient: rang.cle_client,
      journee: rang.journee,
      numero: rang.numero,
      nom: rang.nom,
      articles: JSON.parse(rang.articles_json),
      langue: rang.langue,
      creeeA: new Date(rang.creee_a),
      etatImpression: dernier?.etat ?? ETAT.ECHEC,
      codeErreur: dernier?.code_erreur ?? null,
    };
  }
}
