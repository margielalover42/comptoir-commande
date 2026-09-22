/**
 * Le dialecte de l'imprimante : Epson Server Direct Print.
 *
 * C'est l'IMPRIMANTE qui appelle le serveur, jamais l'inverse. Elle poste sur
 * une seule URL, a intervalle regulier, deux sortes de messages :
 *
 *   ConnectionType=GetRequest    « as-tu quelque chose a imprimer ? »
 *   ConnectionType=SetResponse   « voila le resultat de ce que tu m'as donne »
 *
 * C'est ce qui rend le systeme deployable n'importe ou : aucune redirection
 * de port, aucune adresse IP fixe, aucun VPN. Et c'est ce qui permet d'etre
 * honnete sur l'etat d'une commande : on ne DEDUIT pas qu'un ticket est
 * sorti, l'imprimante le dit.
 *
 * Conforme au manuel Epson « Server Direct Print » (M00062910 Rev. K).
 */

/** Ce que l'imprimante attend quand il n'y a rien a imprimer : une reponse vide. */
export const RIEN_A_IMPRIMER = '';

/**
 * La reponse qui porte un ticket.
 *
 * Version 2.00 parce qu'elle seule transporte le `printjobid` : c'est lui qui
 * permet d'attribuer le verdict au bon ticket.
 *
 * @param {string} travailId  1 a 30 caracteres alphanumeriques (limite Epson)
 * @param {string} ticketXml  le `<epos-print>` construit par ticket.js
 */
export function construireRequeteImpression(travailId, ticketXml) {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<PrintRequestInfo Version="2.00">'
    + '<ePOSPrint>'
    + '<Parameter>'
    + '<devid>local_printer</devid>'
    + '<timeout>10000</timeout>'
    + `<printjobid>${travailId}</printjobid>`
    + '</Parameter>'
    + `<PrintData>${ticketXml}</PrintData>`
    + '</ePOSPrint>'
    + '</PrintRequestInfo>';
}

/**
 * Lit le verdict renvoye par l'imprimante.
 *
 * @param {string} xml  le contenu du champ `ResponseFile`
 * @returns {{travailId: string|null, reussi: boolean, code: string|null}}
 *
 * `travailId` vaut null quand l'imprimante parle la version 1.00 du
 * protocole, qui ne renvoie pas l'identifiant. L'appelant l'attribue alors au
 * dernier ticket parti — ce qui est sans ambiguite parce qu'on n'en envoie
 * jamais plus d'un a la fois.
 *
 * On lit par expression reguliere plutot qu'avec un analyseur XML : le format
 * est fige, produit par une machine, et cela evite une dependance externe
 * dans le chemin le plus critique du systeme.
 */
export function analyserResultat(xml) {
  if (typeof xml !== 'string' || xml.trim() === '') {
    return { travailId: null, reussi: false, code: 'REPONSE_VIDE' };
  }

  const travailId = xml.match(/<printjobid>\s*([A-Za-z0-9]{1,30})\s*<\/printjobid>/)?.[1] ?? null;

  const balise = xml.match(/<response\b[^>]*>/i)?.[0];
  if (!balise) {
    return { travailId, reussi: false, code: 'REPONSE_ILLISIBLE' };
  }

  const reussi = /\bsuccess\s*=\s*"true"/i.test(balise);
  const code = balise.match(/\bcode\s*=\s*"([^"]*)"/i)?.[1] || null;

  return { travailId, reussi, code: reussi ? null : (code ?? 'ERREUR_INCONNUE') };
}

/**
 * Depuis quand l'imprimante n'a-t-elle plus donne signe de vie ?
 *
 * Son interrogation reguliere fait office de battement de coeur. Trois
 * intervalles manques valent panne : assez tolerant pour absorber un hoquet
 * de reseau, assez court pour que le comptoir l'apprenne avant le client.
 */
export function imprimanteEnLigne(dernierAppel, maintenant, intervalleSec) {
  if (!dernierAppel) return false;
  return maintenant.getTime() - dernierAppel.getTime() < intervalleSec * 3 * 1000;
}
