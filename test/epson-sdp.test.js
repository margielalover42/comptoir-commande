/**
 * Le protocole Epson Server Direct Print.
 *
 * Les exemples de XML viennent du manuel Epson (M00062910 Rev. K) : ce sont
 * les messages que la vraie imprimante envoie, pas une invention.
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  construireRequeteImpression,
  analyserResultat,
  imprimanteEnLigne,
  RIEN_A_IMPRIMER,
} from '../src/epson-sdp.js';

// ------------------------------------------------------- ce qu'on lui envoie

test('la requete d’impression porte la version 2.00 et l’identifiant du travail', () => {
  const xml = construireRequeteImpression('J7K2M9', '<epos-print/>');

  assert.match(xml, /<PrintRequestInfo Version="2\.00">/);
  assert.match(xml, /<printjobid>J7K2M9<\/printjobid>/);
  assert.match(xml, /<devid>local_printer<\/devid>/);
  assert.match(xml, /<PrintData><epos-print\/><\/PrintData>/);
});

test('la reponse « rien a imprimer » est vide, comme le prevoit le manuel', () => {
  assert.equal(RIEN_A_IMPRIMER, '');
});

test('l’identifiant respecte la limite Epson : 30 caracteres alphanumeriques', () => {
  // La limite est reelle : un UUID brut, avec ses tirets, serait rejete.
  const id = 'a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5';
  assert.ok(id.length <= 30 && /^[A-Za-z0-9]+$/.test(id));
  assert.match(construireRequeteImpression(id, '<epos-print/>'), new RegExp(id));
});

// ---------------------------------------------------- ce qu'elle nous repond

const SUCCES_2 = `<?xml version="1.0" encoding="utf-8"?>
<PrintResponseInfo Version="2.00"><ePOSPrint><Parameter>
<devid>local_printer</devid><printjobid>ABC123</printjobid>
</Parameter><PrintResponse>
<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="true" code="" status="251854870" battery="0"/>
</PrintResponse></ePOSPrint></PrintResponseInfo>`;

const ECHEC_2 = SUCCES_2.replace('success="true" code=""', 'success="false" code="EPTR_REC_EMPTY"');

const SUCCES_1 = `<?xml version="1.0" encoding="utf-8"?>
<PrintResponseInfo Version="1.00">
<response xmlns="http://www.epson-pos.com/schemas/2011/03/epos-print" success="true" code="" status="251854870" battery="0"/>
</PrintResponseInfo>`;

test('lit un succes en version 2.00', () => {
  assert.deepEqual(analyserResultat(SUCCES_2), { travailId: 'ABC123', reussi: true, code: null });
});

test('lit un echec et conserve le code de l’imprimante', () => {
  // « plus de papier » et « capot ouvert » appellent des gestes differents :
  // le code doit remonter tel quel jusqu'a l'ecran du comptoir.
  assert.deepEqual(analyserResultat(ECHEC_2),
    { travailId: 'ABC123', reussi: false, code: 'EPTR_REC_EMPTY' });
});

test('lit une reponse en version 1.00, qui ne renvoie pas l’identifiant', () => {
  const resultat = analyserResultat(SUCCES_1);

  assert.equal(resultat.reussi, true);
  assert.equal(resultat.travailId, null, 'a l’appelant de l’attribuer au dernier ticket parti');
});

test('un echec sans code reste un echec', () => {
  const xml = '<PrintResponseInfo><response success="false"/></PrintResponseInfo>';
  assert.deepEqual(analyserResultat(xml), { travailId: null, reussi: false, code: 'ERREUR_INCONNUE' });
});

test('une reponse vide ou illisible n’est jamais prise pour un succes', () => {
  // Le defaut, en cas de doute, doit toujours etre « pas imprime ».
  for (const mauvais of ['', '   ', null, undefined, 42, '<PrintResponseInfo/>', 'bonjour']) {
    assert.equal(analyserResultat(mauvais).reussi, false, `pris pour un succes : ${mauvais}`);
  }
});

test('ne confond pas success="false" avec success="true"', () => {
  assert.equal(analyserResultat('<response success="false" code="X"/>').reussi, false);
  assert.equal(analyserResultat('<response success="FALSE"/>').reussi, false);
});

test('ignore un identifiant qui ne respecte pas le format Epson', () => {
  const xml = '<printjobid>pas-valide-avec-tirets</printjobid><response success="true"/>';
  assert.equal(analyserResultat(xml).travailId, null);
});

// ------------------------------------------------------------ le battement

test('l’imprimante est en ligne tant qu’elle a parle recemment', () => {
  const maintenant = new Date('2026-09-22T16:00:00Z');
  const ilY = (s) => new Date(maintenant.getTime() - s * 1000);

  assert.equal(imprimanteEnLigne(ilY(1), maintenant, 3), true);
  assert.equal(imprimanteEnLigne(ilY(8), maintenant, 3), true, 'moins de trois intervalles');
  assert.equal(imprimanteEnLigne(ilY(10), maintenant, 3), false, 'trois intervalles manques');
});

test('une imprimante qui n’a jamais parle est hors ligne', () => {
  assert.equal(imprimanteEnLigne(null, new Date(), 3), false);
});
