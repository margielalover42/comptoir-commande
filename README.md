# Commande au comptoir — Le Comptoir Sushi 36

Le client compose sa commande sur son téléphone, l'envoie, et le ticket sort
en cuisine immédiatement. Il garde un numéro à l'écran, le dit au comptoir, et
paie comme d'habitude. Aucun compte, aucun paiement en ligne, aucun SMS.

Zéro dépendance à installer. Node 24 ou plus récent suffit.

---

## Démarrer

```bash
npm start
```

| | |
|---|---|
| Client | http://localhost:3000/ |
| Comptoir | http://localhost:3000/comptoir/comptoir-dev |
| Imprimante | http://localhost:3000/imprimante/imprimante-dev |

Dans un second terminal, une fausse imprimante qui imprime dans la console :

```bash
npm run fake-printer
```

Elle parle exactement comme une vraie TM-m30. On peut donc essayer toute la
chaîne, pannes comprises, sans matériel et sans gaspiller de papier :

```bash
node scripts/fake-printer.js --panne --code=EPTR_REC_EMPTY   # plus de papier
node scripts/fake-printer.js --muette                        # imprime, ne répond jamais
```

## Les tests

```bash
npm test
```

114 tests, sans dépendance. Ils couvrent le parcours normal, les mauvaises
entrées, l'imprimante en panne, muette ou débranchée, et les doubles envois.

---

## Modifier la carte

Tout est dans [`src/menu.js`](src/menu.js). C'est la **seule** copie de la
carte : le serveur la valide, l'imprime sur le ticket, et l'injecte dans la
page du client. Il ne peut donc pas y avoir de désaccord entre ce que le
client voit et ce que la cuisine reçoit.

```js
{ id: 'pizza.thon', fr: 'Thon', en: 'Tuna',
  dFr: 'Thon, avocat, tobiko, sauce épicée',
  dEn: 'Tuna, avocado, tobiko, spicy dressing' },
```

Renommer un plat est sans danger. **Ne jamais changer un `id`** : c'est lui
que les téléphones déjà ouverts renverront.

---

## Brancher la vraie imprimante

La TM-m30 vient chercher ses tickets toute seule. Il n'y a donc ni
redirection de port, ni adresse IP fixe, ni VPN à mettre en place.

Dans les réglages de l'imprimante (*TM Utility* ou sa page web) :

| Réglage | Valeur |
|---|---|
| Server Direct Print | Activé |
| URL | `https://VOTRE-SERVEUR/imprimante/VOTRE-SECRET` |
| Intervalle | 3 secondes |
| ID | `comptoir36` (libre) |

L'intervalle fixe le délai maximum entre l'envoi et la sortie du ticket. Il
sert aussi à détecter la panne : trois intervalles sans nouvelles et le
comptoir affiche **IMPRIMANTE HORS LIGNE**.

### Le premier essai sur papier

Vérifier les accents. S'ils sortent en `?`, la page de codes du micrologiciel
ne les gère pas : relancer avec `TICKET_ASCII=true`, qui écrit `SAUMON FUME`.
Un ticket lisible vaut mieux qu'un ticket exact illisible.

Vérifier aussi la largeur. Par défaut 48 colonnes (papier 80 mm) ;
pour du 58 mm, `TICKET_COLUMNS=32`.

---

## Mettre en ligne

Le serveur doit tourner quelque part en permanence : il garde les commandes
et c'est lui que l'imprimante interroge.

### Le plus simple — tout au même endroit

N'importe quel hébergeur Node (Render, Railway, Fly) fait tourner ce dépôt
tel quel. Page, API, comptoir et imprimante sur une seule adresse, rien à
configurer de plus.

```bash
PRINTER_SECRET=… STAFF_SECRET=… npm start
```

### Avec Netlify

Netlify sert des fichiers ; il ne peut pas garder les commandes ni répondre à
l'imprimante. La page peut y vivre, l'API ailleurs :

```bash
node scripts/build-static.js --api=https://mon-serveur.onrender.com
```

Déposer `dist/` sur Netlify, puis, côté serveur,
`ALLOWED_ORIGIN=https://ma-page.netlify.app` — sans quoi le navigateur
bloquera les appels.

Sans `--api`, `dist/index.html` reste une carte consultable qui s'ouvre d'un
double-clic : pratique pour montrer le rendu sans rien déployer.

---

## Les réglages

Tous facultatifs — les valeurs par défaut fonctionnent en développement.

| Variable | Défaut | |
|---|---|---|
| `PORT` | `3000` | |
| `DB_PATH` | `commandes.db` | le fichier SQLite |
| `PRINTER_SECRET` | `imprimante-dev` | **à changer en production** |
| `STAFF_SECRET` | `comptoir-dev` | **à changer en production** |
| `PRINTER_POLL_SECONDS` | `3` | doit correspondre au réglage de l'imprimante |
| `PRINT_ACK_TIMEOUT_MS` | `60000` | au-delà, le ticket est déclaré échoué |
| `TICKET_ASCII` | `false` | `true` enlève les accents du ticket |
| `TICKET_COLUMNS` | `48` | `32` pour du papier 58 mm |
| `TIMEZONE` | `America/Toronto` | |
| `ALLOWED_ORIGIN` | vide | seulement si la page est hébergée ailleurs |
| `RATE_LIMIT_COUNT` | `5` | commandes par appareil et par fenêtre |

L'adresse du comptoir **est** son mot de passe : elle donne accès aux
commandes du jour et au bouton de réimpression. En production, mettre une
valeur longue et imprévisible.

```bash
node -e "console.log(require('crypto').randomBytes(24).toString('hex'))"
```

---

## Comment c'est fait

```
src/menu.js        la carte — la seule copie
src/order.js       valide un panier reçu d'un téléphone
src/day.js         la journée de service (bascule à 04h00)
src/ticket.js      une commande → le XML du ticket
src/store.js       SQLite : commandes, travaux d'impression
src/epson-sdp.js   le dialecte de l'imprimante
src/server.js      les routes HTTP
public/index.html  la page du client
public/comptoir.html  l'écran du comptoir
```

Trois règles tiennent l'ensemble :

**Le numéro vient du serveur.** La page n'en invente jamais. Si l'envoi
échoue, le client voit qu'il a échoué — pas un numéro que personne ne
retrouvera au comptoir.

**On ne déduit jamais qu'un ticket est sorti.** L'imprimante le dit, ou il
est marqué non imprimé. Un ticket parti sans réponse au bout d'une minute est
déclaré échoué et réessayé une fois.

**Rien de ce qui vient du téléphone n'est cru sur parole.** Les noms de plats
sont relus dans `src/menu.js` à partir de leur identifiant, jamais repris de
la requête : personne ne peut faire imprimer son propre texte en cuisine.

### Le ticket

```
       COMPTOIR SUSHI 36
          C U I S I N E
            #37
      mar. 22 sept. - 12h41
------------------------------------
2x  SAUMON FUMÉ
    Sushi Pizza

1x  HOMARD
    Poké Bol
------------------------------------
            3 articles
      ** NON PAYE - ENCAISSER **
```

Toujours en français, même si le client a commandé en anglais : c'est la
cuisine qui le lit. La section figure sous chaque plat parce que « Saumon »
existe en poké, en pizza et en nigiri. `NON PAYÉ` y est toujours, pour qu'un
ticket ne passe jamais pour une commande réglée. Une réimpression porte
`*** RÉIMPRESSION ***`, pour ne pas devenir une deuxième portion.
