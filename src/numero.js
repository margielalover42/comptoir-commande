/**
 * Les numeros de commande : tires au hasard, mais jamais deux fois le meme
 * dans une journee.
 *
 * LE PROBLEME
 * Un numero vraiment tire au sort se repete vite : sur 900 valeurs, deux
 * clients partagent le meme numero apres une quarantaine de commandes
 * environ. Un midi de rush suffit donc largement a produire deux « #482 »,
 * et le comptoir se retrouve avec deux commandes pour un seul numero.
 *
 * LA SOLUTION
 * On ne tire pas au sort : on PARCOURT les 900 numeros dans un ordre
 * melange. La n-ieme commande de la journee prend le n-ieme numero de ce
 * parcours. Comme le parcours passe une seule fois par chaque numero, une
 * repetition est impossible — tout en donnant une suite qui n'a rien de
 * previsible pour le client : 482, 137, 905, 260...
 *
 * COMMENT
 * `rang -> DEBUT + (PAS * rang + decalage) mod PLAGE` est une bijection des
 * qu'on choisit un PAS premier avec PLAGE : chaque rang donne un numero
 * different, et les 900 rangs couvrent exactement les 900 numeros. Le
 * decalage, tire une fois par journee, fait que deux journees ne se
 * ressemblent pas.
 */

const DEBUT = 100;   // on commence a 100 : « cent-trente-sept » se dit bien
const PLAGE = 900;   // 100 a 999

/**
 * Le pas du parcours. 631 est premier, donc premier avec 900 (= 2².3².5²) :
 * c'est la seule propriete qui compte. Sa valeur exacte n'a d'importance que
 * pour l'allure de la suite — assez grand pour que deux numeros consecutifs
 * n'aient pas l'air voisins.
 */
const PAS = 631;

/** Au-dela de 900 commandes dans la journee, on passe a quatre chiffres. */
const DEBUT_DEBORDEMENT = 1000;

/**
 * Le numero affiche pour la n-ieme commande d'une journee.
 *
 * @param {number} rang      0 pour la premiere commande de la journee
 * @param {number} decalage  0..899, tire une fois par journee
 */
export function numeroPourRang(rang, decalage) {
  if (!Number.isInteger(rang) || rang < 0) {
    throw new RangeError(`rang invalide : ${rang}`);
  }

  /* Plus de 900 commandes dans une journee : le parcours est epuise et
     reprendrait au depart. On continue en quatre chiffres plutot que de
     redonner un numero deja servi. Le commerce n'ira jamais jusque-la, mais
     « jamais » doit rester vrai meme le jour ou il s'y approche. */
  if (rang >= PLAGE) {
    return DEBUT_DEBORDEMENT + (rang - PLAGE);
  }

  return DEBUT + (PAS * rang + decalage) % PLAGE;
}

/** Un decalage de depart valable pour une journee. */
export function decalageAleatoire(tirage) {
  return tirage(PLAGE);
}

export const PLAGE_NUMEROS = PLAGE;
