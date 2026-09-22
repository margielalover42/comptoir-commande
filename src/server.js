/**
 * Le serveur : la page du client, l'API de commande, l'imprimante, le comptoir.
 *
 * `node:http` sans cadriciel. Le routage tient en une fonction parce qu'il y a
 * huit routes ; y ajouter une bibliotheque couterait plus de lecture qu'il
 * n'en ferait economiser.
 *
 * `creerApp` rend un gestionnaire de requetes et prend son horloge en
 * parametre : les tests peuvent ainsi avancer le temps sans attendre.
 */

import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

import { config } from './config.js';
import { CARTE } from './menu.js';
import { ouvrirBase, ETAT } from './store.js';
import { validerCommande, ErreurCommande, compterArticles } from './order.js';
import { construireTicket } from './ticket.js';
import { journeeDeService, heureLisible } from './day.js';
import {
  RIEN_A_IMPRIMER,
  construireRequeteImpression,
  analyserResultat,
  imprimanteEnLigne,
} from './epson-sdp.js';

const RACINE = join(dirname(fileURLToPath(import.meta.url)), '..');
const CLE_DERNIER_APPEL = 'imprimante.dernier_appel';
const CLE_PAUSE = 'commandes.en_pause';

export function creerApp({ store, maintenant = () => new Date() }) {
  const pages = chargerPages();
  const limiteur = new Limiteur(config.limiteCommandes, config.limiteFenetreMs);

  return async function traiter(req, res) {
    try {
      await router(req, res, { store, maintenant, pages, limiteur });
    } catch (erreur) {
      // Un plantage ne doit jamais faire tomber le serveur : la cuisine
      // depend de sa disponibilite plus que de cette requete-ci.
      console.error('Erreur non rattrapee :', erreur);
      if (!res.headersSent) envoyerJson(res, 500, { erreur: 'Erreur du serveur.' });
    }
  };
}

async function router(req, res, ctx) {
  const url = new URL(req.url, 'http://localhost');
  const chemin = url.pathname;
  const { store, maintenant, pages } = ctx;

  // Necessaire uniquement si la page est hebergee ailleurs que l'API.
  if (config.origineAutorisee) {
    res.setHeader('Access-Control-Allow-Origin', config.origineAutorisee);
    res.setHeader('Vary', 'Origin');

    if (req.method === 'OPTIONS') {
      res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
      res.setHeader('Access-Control-Max-Age', '86400');
      res.writeHead(204);
      return res.end();
    }
  }

  // --- la page du client
  if (req.method === 'GET' && (chemin === '/' || chemin === '/index.html')) {
    return envoyerHtml(res, pages.client);
  }

  if (req.method === 'GET' && chemin === '/api/etat') {
    return envoyerJson(res, 200, etatDuService(store, maintenant()));
  }

  if (req.method === 'POST' && chemin === '/api/commandes') {
    return await posterCommande(req, res, ctx);
  }

  const commande = chemin.match(/^\/api\/commandes\/([\w-]+)$/);
  if (req.method === 'GET' && commande) {
    return suivreCommande(res, ctx, commande[1]);
  }

  // --- l'imprimante (une seule URL : SDP y poste ses deux sortes de messages)
  if (req.method === 'POST' && chemin === `/imprimante/${config.secretImprimante}`) {
    return await parlerAImprimante(req, res, ctx);
  }

  // --- le comptoir
  const prefixe = `/comptoir/${config.secretComptoir}`;
  if (chemin === prefixe || chemin.startsWith(prefixe + '/')) {
    return await routerComptoir(req, res, ctx, chemin.slice(prefixe.length));
  }

  return envoyerJson(res, 404, { erreur: 'Page introuvable.' });
}

// ---------------------------------------------------------------- le client

async function posterCommande(req, res, { store, maintenant, limiteur }) {
  const now = maintenant();

  if (estEnPause(store)) {
    return envoyerJson(res, 503, {
      erreur: 'Les commandes en ligne sont suspendues. Passez au comptoir.',
    });
  }

  if (!limiteur.autorise(adresse(req), now)) {
    return envoyerJson(res, 429, {
      erreur: 'Trop de commandes depuis cet appareil. Patientez quelques minutes.',
    });
  }

  let corps;
  try {
    corps = JSON.parse(await lireCorps(req, config.tailleCorpsMax));
  } catch (erreur) {
    const trop = erreur.code === 'CORPS_TROP_GRAND';
    return envoyerJson(res, trop ? 413 : 400, {
      erreur: trop ? 'Commande trop volumineuse.' : 'Commande illisible.',
    });
  }

  let valide;
  try {
    valide = validerCommande(corps);
  } catch (erreur) {
    if (erreur instanceof ErreurCommande) return envoyerJson(res, 400, { erreur: erreur.message });
    throw erreur;
  }

  const { commande, nouvelle } = store.creerCommande({
    cleClient: valide.clientOrderId,
    journee: journeeDeService(now, config.fuseau),
    articles: valide.articles,
    langue: valide.langue,
    creeeA: now,
  });

  // 201 pour une vraie creation, 200 pour un renvoi : un double tap recoit
  // le meme numero, et aucun second ticket n'est mis en file.
  return envoyerJson(res, nouvelle ? 201 : 200, {
    ...vueCommande(commande),
    imprimanteEnLigne: estEnLigne(store, now),
  });
}

function suivreCommande(res, { store, maintenant }, id) {
  const now = maintenant();
  store.expirerTravaux(now, config.delaiReponseMs);

  const commande = store.commandeParId(id);
  if (!commande) return envoyerJson(res, 404, { erreur: 'Commande introuvable.' });

  return envoyerJson(res, 200, {
    ...vueCommande(commande),
    imprimanteEnLigne: estEnLigne(store, now),
  });
}

// ------------------------------------------------------------ l'imprimante

async function parlerAImprimante(req, res, { store, maintenant }) {
  const now = maintenant();
  const form = new URLSearchParams(await lireCorps(req, config.tailleCorpsMax));

  // Toute prise de parole de l'imprimante vaut battement de coeur.
  store.ecrireReglage(CLE_DERNIER_APPEL, now.getTime());
  store.expirerTravaux(now, config.delaiReponseMs);

  const type = form.get('ConnectionType');

  if (type === 'GetRequest') {
    const travail = store.reclamerProchainTravail(now);
    if (!travail) return envoyerXml(res, RIEN_A_IMPRIMER);

    const ticket = construireTicket(travail.commande, {
      reimpression: Boolean(travail.reimpression),
    });
    return envoyerXml(res, construireRequeteImpression(travail.id, ticket));
  }

  if (type === 'SetResponse') {
    const resultat = analyserResultat(form.get('ResponseFile') ?? '');

    // Sans identifiant (protocole 1.00), le verdict revient au dernier ticket
    // parti. C'est sans ambiguite : on n'en envoie jamais plus d'un a la fois.
    const travailId = resultat.travailId ?? store.dernierTravailEnvoye()?.id;
    if (travailId) {
      store.enregistrerResultat(travailId, resultat.reussi, resultat.code, now);
    }
    return envoyerXml(res, RIEN_A_IMPRIMER);
  }

  // Message inconnu : on repond vide plutot que par une erreur, pour ne pas
  // declencher la boucle de reessai de l'imprimante.
  return envoyerXml(res, RIEN_A_IMPRIMER);
}

// --------------------------------------------------------------- le comptoir

async function routerComptoir(req, res, { store, maintenant, pages }, reste) {
  const now = maintenant();

  // L'adresse est le seul secret : qu'elle ne parte ni dans un moteur de
  // recherche, ni dans l'en-tete Referer d'un lien sortant.
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  res.setHeader('Referrer-Policy', 'no-referrer');

  if (req.method === 'GET' && (reste === '' || reste === '/')) {
    return envoyerHtml(res, pages.comptoir);
  }

  if (req.method === 'GET' && reste === '/commandes') {
    store.expirerTravaux(now, config.delaiReponseMs);
    const journee = journeeDeService(now, config.fuseau);

    return envoyerJson(res, 200, {
      journee,
      imprimanteEnLigne: estEnLigne(store, now),
      enPause: estEnPause(store),
      commandes: store.commandesDuJour(journee).map((c) => ({
        ...vueCommande(c),
        heure: heureLisible(c.creeeA, config.fuseau),
        articles: c.articles.map((a) => ({
          quantite: a.quantite, nom: a.nomFr, section: a.sectionFr,
        })),
      })),
    });
  }

  const reimpression = reste.match(/^\/commandes\/([\w-]+)\/reimprimer$/);
  if (req.method === 'POST' && reimpression) {
    const travail = store.reimprimer(reimpression[1], now);
    if (!travail) return envoyerJson(res, 404, { erreur: 'Commande introuvable.' });
    return envoyerJson(res, 200, { etatImpression: travail.etat });
  }

  if (req.method === 'POST' && reste === '/pause') {
    const enPause = !estEnPause(store);
    store.ecrireReglage(CLE_PAUSE, enPause);
    return envoyerJson(res, 200, { enPause });
  }

  return envoyerJson(res, 404, { erreur: 'Page introuvable.' });
}

// ------------------------------------------------------------------ communs

/** Ce que le telephone et le comptoir ont le droit de voir d'une commande. */
function vueCommande(commande) {
  return {
    id: commande.id,
    numero: commande.numero,
    etatImpression: commande.etatImpression,
    codeErreur: commande.codeErreur,
    total: compterArticles(commande.articles),
    articles: commande.articles.map((a) => ({
      quantite: a.quantite, nom: a.nomClient, section: a.sectionClient,
    })),
  };
}

function etatDuService(store, now) {
  return {
    ouvert: !estEnPause(store),
    imprimanteEnLigne: estEnLigne(store, now),
  };
}

function estEnLigne(store, now) {
  const dernier = store.lireReglage(CLE_DERNIER_APPEL);
  return imprimanteEnLigne(
    dernier ? new Date(Number(dernier)) : null,
    now,
    config.intervalleImprimanteSec,
  );
}

function estEnPause(store) {
  return store.lireReglage(CLE_PAUSE) === 'true';
}

/**
 * Les deux pages, lues une fois au demarrage.
 *
 * La carte est INJECTEE dans la page du client. C'est ce qui garantit qu'il
 * n'existe qu'une seule carte : la page ne peut pas proposer un plat que le
 * serveur refuserait, ni afficher un nom que le ticket n'aurait pas.
 */
function chargerPages() {
  const client = readFileSync(join(RACINE, 'public', 'index.html'), 'utf8');
  const marque = '<!--MENU_JSON-->';

  if (!client.includes(marque)) {
    throw new Error(`public/index.html ne contient pas ${marque} : la carte ne peut pas etre injectee.`);
  }

  return {
    client: client.replace(
      marque,
      `<script>window.COMPTOIR_MENU=${jsonSurEchappe(CARTE)};</script>`,
    ),
    comptoir: readFileSync(join(RACINE, 'public', 'comptoir.html'), 'utf8'),
  };
}

/**
 * JSON sur pour l'interieur d'une balise <script>.
 * Sans cela, un plat qui contiendrait « </script> » fermerait la balise.
 */
function jsonSurEchappe(valeur) {
  return JSON.stringify(valeur).replace(/</g, '\\u003c');
}

/** Lit le corps d'une requete, en refusant ce qui depasse la limite. */
function lireCorps(req, tailleMax) {
  return new Promise((resoudre, rejeter) => {
    let taille = 0;
    const morceaux = [];

    req.on('data', (morceau) => {
      taille += morceau.length;
      if (taille > tailleMax) {
        const erreur = new Error('Corps trop grand');
        erreur.code = 'CORPS_TROP_GRAND';
        req.destroy();
        return rejeter(erreur);
      }
      morceaux.push(morceau);
    });

    req.on('end', () => resoudre(Buffer.concat(morceaux).toString('utf8')));
    req.on('error', rejeter);
  });
}

/** L'adresse de l'appelant, en tenant compte d'un eventuel proxy. */
function adresse(req) {
  const transmis = req.headers['x-forwarded-for'];
  if (typeof transmis === 'string' && transmis.length > 0) return transmis.split(',')[0].trim();
  return req.socket.remoteAddress ?? 'inconnue';
}

/** Limite par adresse IP : une farce avec le lien ne doit pas vider un rouleau. */
class Limiteur {
  #passages = new Map();

  constructor(maximum, fenetreMs) {
    this.maximum = maximum;
    this.fenetreMs = fenetreMs;
  }

  autorise(cle, maintenant) {
    const depuis = maintenant.getTime() - this.fenetreMs;
    const recents = (this.#passages.get(cle) ?? []).filter((t) => t > depuis);

    if (recents.length >= this.maximum) {
      this.#passages.set(cle, recents);
      return false;
    }

    recents.push(maintenant.getTime());
    this.#passages.set(cle, recents);
    return true;
  }
}

function envoyerJson(res, code, corps) {
  const texte = JSON.stringify(corps);
  res.writeHead(code, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(texte),
    'Cache-Control': 'no-store',
  });
  res.end(texte);
}

function envoyerHtml(res, html) {
  res.writeHead(200, {
    'Content-Type': 'text/html; charset=utf-8',
    'Content-Length': Buffer.byteLength(html),
    'Cache-Control': 'no-store',
  });
  res.end(html);
}

/** L'imprimante attend du XML, y compris quand la reponse est vide. */
function envoyerXml(res, xml) {
  res.writeHead(200, {
    'Content-Type': 'text/xml; charset=utf-8',
    'Content-Length': Buffer.byteLength(xml),
  });
  res.end(xml);
}

// ------------------------------------------------------------- demarrage

// Ne demarre que si le fichier est lance directement : les tests importent
// `creerApp` sans ouvrir de port.
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const store = ouvrirBase(config.cheminBase);
  const serveur = createServer(creerApp({ store }));

  serveur.listen(config.port, () => {
    console.log(`\n  Le Comptoir Sushi 36 — prise de commande\n`);
    console.log(`  Client     http://localhost:${config.port}/`);
    console.log(`  Comptoir   http://localhost:${config.port}/comptoir/${config.secretComptoir}`);
    console.log(`  Imprimante http://localhost:${config.port}/imprimante/${config.secretImprimante}\n`);
  });

  for (const signal of ['SIGINT', 'SIGTERM']) {
    process.on(signal, () => {
      serveur.close(() => { store.close(); process.exit(0); });
    });
  }
}

export { ETAT };
