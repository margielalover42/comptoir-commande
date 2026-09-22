/**
 * Une fausse TM-m30.
 *
 * Elle parle exactement comme la vraie — meme URL, meme formulaire, memes
 * deux messages — mais imprime dans le terminal. On peut donc verifier toute
 * la chaine, y compris les pannes, sans toucher au materiel ni gaspiller de
 * papier.
 *
 *   node scripts/fake-printer.js
 *   node scripts/fake-printer.js --panne            # signale une erreur
 *   node scripts/fake-printer.js --panne --code=EPTR_REC_EMPTY
 *   node scripts/fake-printer.js --muette           # imprime, ne repond jamais
 */

const args = new Set(process.argv.slice(2));
const lire = (nom, defaut) =>
  process.argv.slice(2).find((a) => a.startsWith(`--${nom}=`))?.split('=')[1] ?? defaut;

const URL_SERVEUR = lire('url', 'http://localhost:3000/imprimante/imprimante-dev');
const INTERVALLE = Number(lire('intervalle', 3)) * 1000;
const EN_PANNE = args.has('--panne');
const MUETTE = args.has('--muette');
const CODE = lire('code', 'EPTR_COVER_OPEN');

console.log(`Fausse TM-m30 -> ${URL_SERVEUR}`);
console.log(`   intervalle ${INTERVALLE / 1000}s`
  + (EN_PANNE ? `, en panne (${CODE})` : '')
  + (MUETTE ? ', muette (aucun accuse)' : ''));
console.log('   Ctrl+C pour arreter\n');

/** Un echange complet : demander, imprimer, accuser reception. */
async function tour() {
  const xml = await poster({ ConnectionType: 'GetRequest', ID: 'comptoir36' });
  if (!xml.trim()) return; // rien a imprimer : la reponse vide attendue

  const travailId = xml.match(/<printjobid>([^<]+)<\/printjobid>/)?.[1] ?? '';
  imprimer(xml);

  if (MUETTE) {
    console.log(`   (muette : aucun accuse envoye pour ${travailId})\n`);
    return;
  }

  await poster({
    ConnectionType: 'SetResponse',
    ID: 'comptoir36',
    ResponseFile: accuse(travailId, !EN_PANNE),
  });

  console.log(EN_PANNE ? `   -> echec signale (${CODE})\n` : '   -> imprime\n');
}

function accuse(travailId, reussi) {
  return '<?xml version="1.0" encoding="utf-8"?>'
    + '<PrintResponseInfo Version="2.00"><ePOSPrint><Parameter>'
    + '<devid>local_printer</devid>'
    + `<printjobid>${travailId}</printjobid>`
    + '</Parameter><PrintResponse>'
    + '<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" '
    + `success="${reussi}" code="${reussi ? '' : CODE}" status="251854870" battery="0"/>`
    + '</PrintResponse></ePOSPrint></PrintResponseInfo>';
}

/** Rend le XML ePOS-Print comme le papier le montrerait. */
function imprimer(xml) {
  const lignes = [...xml.matchAll(/<text>([^<]*)<\/text>/g)]
    .map((m) => decoder(m[1]))
    .join('')
    .split('\n');

  console.log('  .' + '-'.repeat(50) + '.');
  for (const ligne of lignes) {
    if (ligne === '' && lignes.indexOf(ligne) === lignes.length - 1) continue;
    console.log('  | ' + ligne.padEnd(48) + ' |');
  }
  console.log("  '" + '-'.repeat(50) + "'");
}

function decoder(texte) {
  return texte
    .replace(/&#10;/g, '\n')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

async function poster(champs) {
  const reponse = await fetch(URL_SERVEUR, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(champs).toString(),
  });
  return reponse.text();
}

/**
 * On enchaine les tours avec setTimeout plutot que setInterval : l'intervalle
 * doit separer la FIN d'un echange du debut du suivant, comme le fait la vraie
 * imprimante. Sinon deux tours peuvent se chevaucher et fausser les essais.
 */
async function boucle() {
  try {
    await tour();
  } catch (erreur) {
    console.error('  serveur injoignable :', erreur.message);
  }
  setTimeout(boucle, INTERVALLE);
}

boucle();
