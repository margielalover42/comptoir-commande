/**
 * La « journee de service ».
 *
 * Les numeros de commande repartent a 1 chaque jour. Le probleme : un service
 * du soir deborde apres minuit, et une remise a zero a minuit donnerait deux
 * commandes « #3 » pendant le meme coup de feu. La journee de service bascule
 * donc a 04h00, quand le commerce est ferme et que personne n'attend.
 */

const HEURE_BASCULE = 4;

/**
 * La journee de service d'un instant donne, au format 'AAAA-MM-JJ'.
 *
 * @param {Date} instant
 * @param {string} fuseau  ex. 'America/Toronto'
 */
export function journeeDeService(instant, fuseau) {
  const { annee, mois, jour, heure } = partsLocales(instant, fuseau);

  // Avant 04h00, on est encore sur le service de la veille.
  if (heure < HEURE_BASCULE) {
    const veille = new Date(Date.UTC(annee, mois - 1, jour));
    veille.setUTCDate(veille.getUTCDate() - 1);
    return veille.toISOString().slice(0, 10);
  }

  return `${annee}-${pad(mois)}-${pad(jour)}`;
}

/**
 * L'heure locale du commerce, pour le ticket et l'ecran du comptoir.
 * Rend par exemple « mar. 22 sept. - 12h41 ».
 */
export function horodatageLisible(instant, fuseau) {
  const date = new Intl.DateTimeFormat('fr-CA', {
    timeZone: fuseau, weekday: 'short', day: 'numeric', month: 'short',
  }).format(instant);

  const { heure, minute } = partsLocales(instant, fuseau);
  return `${date} - ${pad(heure)}h${pad(minute)}`;
}

/** Juste l'heure locale, « 12h41 », pour l'ecran du comptoir. */
export function heureLisible(instant, fuseau) {
  const { heure, minute } = partsLocales(instant, fuseau);
  return `${pad(heure)}h${pad(minute)}`;
}

/**
 * Decompose un instant dans le fuseau du commerce.
 *
 * On passe par Intl plutot que par les getters de Date parce que le serveur
 * peut tourner en UTC alors que le commerce vit a Montreal : `getHours()`
 * donnerait l'heure du serveur, pas celle du comptoir.
 */
function partsLocales(instant, fuseau) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: fuseau,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
  }).formatToParts(instant);

  const valeur = (type) => Number(parts.find((p) => p.type === type).value);

  return {
    annee: valeur('year'), mois: valeur('month'), jour: valeur('day'),
    heure: valeur('hour'), minute: valeur('minute'),
  };
}

function pad(n) {
  return String(n).padStart(2, '0');
}
