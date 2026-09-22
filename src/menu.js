/**
 * LA CARTE — la seule copie.
 *
 * Le serveur valide les commandes contre ce fichier, formate les tickets
 * depuis ce fichier, et l'injecte dans la page du client. Il n'existe donc
 * aucune seconde copie qui pourrait diverger.
 *
 * POUR MODIFIER LA CARTE :
 *   - changer un nom ou une description : editer le texte, c'est tout.
 *   - ajouter un plat : copier une ligne et lui donner un `id` UNIQUE.
 *   - retirer un plat : supprimer la ligne.
 *
 * LE CHAMP `id` NE DOIT JAMAIS CHANGER. C'est lui que le telephone du
 * client renvoie au serveur. Renommer un plat est sans danger ; changer son
 * `id` casse les commandes en cours de saisie sur les telephones ouverts.
 *
 * Les textes viennent mot pour mot des deux feuilles imprimees du client.
 */

/** La garniture commune des poke bols, ecrite une seule fois. */
const PK_FR = "Tempura, avocat, masago, concombre, edamame, mayo épicée, épices, sésame, nori, mangue, poivron, salade d'algue, carotte, patate douce";
const PK_EN = 'Tempura, avocado, masago, cucumber, edamame, spicy mayo, spices, sesame, nori, mango, bell pepper, seaweed salad, carrot, sweet potato';

export const CARTE = [
  {
    id: 'pizza', fr: 'Sushi Pizza', en: 'Sushi Pizza',
    noteFr: '6 Morceaux', noteEn: '6 Pieces',
    teinte: '#F4585E', img: 'pizza',
    plats: [
      { id: 'pizza.saumon-fume', fr: 'Saumon Fumé', en: 'Smoked Salmon',
        dFr: 'Saumon fumé, goberge, tobiko, sauce épicée',
        dEn: 'Smoked salmon, crab stick, tobiko, spicy dressing' },
      { id: 'pizza.thon', fr: 'Thon', en: 'Tuna',
        dFr: 'Thon, avocat, tobiko, sauce épicée',
        dEn: 'Tuna, avocado, tobiko, spicy dressing' },
      { id: 'pizza.duo', fr: 'Duo', en: 'Duo',
        dFr: 'Thon, saumon, avocat, salade, tobiko, sauce épicée',
        dEn: 'Tuna, salmon, avocado, salad, tobiko, spicy dressing' },
      { id: 'pizza.saumon', fr: 'Saumon', en: 'Salmon',
        dFr: 'Saumon, avocat, tobiko, sauce épicée',
        dEn: 'Salmon, avocado, tobiko, spicy dressing' },
    ],
  },

  {
    id: 'poke', fr: 'Poké Bol', en: 'Poké Bowl',
    teinte: '#ED1F27', img: 'poke',
    plats: [
      { id: 'poke.saumon', fr: 'Saumon', en: 'Salmon',
        dFr: 'Saumon, ' + PK_FR, dEn: 'Salmon, ' + PK_EN },
      { id: 'poke.thon', fr: 'Thon', en: 'Tuna',
        dFr: 'Thon, ' + PK_FR, dEn: 'Tuna, ' + PK_EN },
      { id: 'poke.duo', fr: 'Duo', en: 'Duo',
        dFr: 'Saumon, thon, ' + PK_FR, dEn: 'Salmon, tuna, ' + PK_EN },
      { id: 'poke.tataki', fr: 'Tataki', en: 'Tataki',
        dFr: 'Tataki de thon, ' + PK_FR, dEn: 'Tuna tataki, ' + PK_EN },
      { id: 'poke.homard', fr: 'Homard', en: 'Lobster',
        dFr: 'Chair de homard, ' + PK_FR, dEn: 'Lobster, ' + PK_EN },
      { id: 'poke.saumon-frit', fr: 'Saumon Frit', en: 'Fried Salmon',
        dFr: 'Saumon frit, ' + PK_FR, dEn: 'Fried salmon, ' + PK_EN },
      { id: 'poke.crevettes-cocktail', fr: 'Crevettes Cocktail', en: 'Cocktail Shrimp',
        dFr: 'Crevettes, ' + PK_FR, dEn: 'Shrimp, ' + PK_EN },
      { id: 'poke.crevettes-jalapeno', fr: 'Crevettes Jalapeño', en: 'Jalapeño Shrimp',
        dFr: 'Crevettes jalapeño, ' + PK_FR, dEn: 'Jalapeño shrimp, ' + PK_EN },
      { id: 'poke.crevettes-tempura', fr: 'Crevettes Tempura', en: 'Tempura Shrimp',
        dFr: 'Crevettes tempura, ' + PK_FR, dEn: 'Tempura shrimp, ' + PK_EN },
      { id: 'poke.poulet-pane', fr: 'Poulet Pané', en: 'Fried Chicken',
        dFr: 'Poulet pané, ' + PK_FR, dEn: 'Breaded chicken, ' + PK_EN },
      { id: 'poke.vegetarien', fr: 'Végétarien', en: 'Vegetarian',
        dFr: 'Avocat, edamame, patate douce, wakame, salade mixte, carotte, mangue, poivron, sauce sésame',
        dEn: 'Avocado, edamame, sweet potato, wakame, mixed salad, carrot, mango, bell pepper, sesame dressing' },
    ],
  },

  {
    id: 'printemps', fr: 'Makis de Printemps', en: 'Spring Makis',
    noteFr: '5 Morceaux', noteEn: '5 Pieces',
    teinte: '#7C8F6B', img: 'printemps',
    plats: [
      { id: 'printemps.saumon', fr: 'Printemps Saumon', en: 'Spring Salmon',
        dFr: 'Saumon, goberge, oshinko, avocat, crevettes tempura, sauce épicée',
        dEn: 'Salmon, crab stick, oshinko, avocado, tempura shrimp, spicy dressing' },
      { id: 'printemps.thon', fr: 'Printemps Thon', en: 'Spring Tuna',
        dFr: 'Thon, tempura, tobiko, sauce épicée',
        dEn: 'Tuna, tempura, tobiko, spicy dressing' },
      { id: 'printemps.crevette', fr: 'Printemps Crevette', en: 'Spring Shrimp',
        dFr: 'Crevettes tempura, crevettes sucrées, goberge, salade mixte, masago, sauce épicée',
        dEn: 'Tempura shrimp, sweet shrimp, crab stick, mixed salad, masago, spicy dressing' },
      { id: 'printemps.deluxe', fr: 'Printemps Deluxe', en: 'Spring Deluxe',
        dFr: 'Pétoncle, crevettes tempura, chair de homard, tobiko, concombre, avocat, sauce épicée',
        dEn: 'Scallop, tempura shrimp, lobster, tobiko, cucumber, avocado, spicy dressing' },
      { id: 'printemps.duo', fr: 'Printemps Duo', en: 'Spring Duo',
        dFr: 'Saumon, thon, mangue, avocat, tempura, sauce épicée',
        dEn: 'Salmon, tuna, mango, avocado, tempura, spicy dressing' },
    ],
  },

  {
    id: 'tartare', fr: 'Printanier Tartare', en: 'Spring Tartare',
    noteFr: '6 mcx / Feuille de riz', noteEn: '6 pcs / Rice wrapper',
    teinte: '#ED1F27', img: 'tartare',
    plats: [
      { id: 'tartare.homard', fr: 'Tartare de Homard', en: 'Lobster Tartare',
        dFr: 'Chair de homard, tobiko, mangue, fraise, salade mixte, sauce épicée',
        dEn: 'Lobster, tobiko, mango, strawberry, mixed salad, spicy dressing' },
      { id: 'tartare.saumon', fr: 'Tartare de Saumon', en: 'Salmon Tartare',
        dFr: 'Saumon, tempura, tobiko, sauce épicée',
        dEn: 'Salmon, tempura, tobiko, spicy dressing' },
      { id: 'tartare.thon', fr: 'Tartare de Thon', en: 'Tuna Tartare',
        dFr: 'Thon, tempura, avocat, concombre, tobiko, sauce épicée',
        dEn: 'Tuna, tempura, avocado, cucumber, tobiko, spicy dressing' },
      { id: 'tartare.duo', fr: 'Tartare Duo', en: 'Duo Tartare',
        dFr: 'Thon, saumon, avocat, tobiko, crevettes tempura, salade mixte, sauce épicée',
        dEn: 'Tuna, salmon, avocado, tobiko, tempura shrimp, mixed salad, spicy dressing' },
    ],
  },

  {
    id: 'hosomaki', fr: 'Hosomakis', en: 'Hosomakis',
    noteFr: '8 Morceaux', noteEn: '8 Pieces',
    teinte: '#9DB089', img: 'hosomaki',
    plats: [
      { id: 'hosomaki.avocat', fr: 'Avocat', en: 'Avocado', dFr: 'Avocat', dEn: 'Avocado' },
      { id: 'hosomaki.kappa', fr: 'Kappa', en: 'Kappa', dFr: 'Concombre', dEn: 'Cucumber' },
      { id: 'hosomaki.kanikama', fr: 'Kanikama', en: 'Kanikama', dFr: 'Goberge', dEn: 'Crab stick' },
      { id: 'hosomaki.sake', fr: 'Saké', en: 'Sake', dFr: 'Saumon', dEn: 'Salmon' },
      { id: 'hosomaki.tekka', fr: 'Tekka', en: 'Tekka', dFr: 'Thon rouge', dEn: 'Red tuna' },
    ],
  },

  {
    id: 'salade', fr: 'Soupe & Salade', en: 'Soup & Salad',
    teinte: '#9DB089', img: 'salade',
    plats: [
      { id: 'salade.miso', fr: 'Soupe Miso', en: 'Miso Soup',
        dFr: 'Tofu, algue, champignons, échalote',
        dEn: 'Tofu, seaweed, mushrooms, shallot' },
      { id: 'salade.miso-fruits-de-mer', fr: 'Soupe Miso Fruits de mer', en: 'Seafood Miso Soup',
        dFr: 'Crevettes, goberge, pétoncle, tofu, algues, champignons, échalote',
        dEn: 'Shrimp, crab stick, scallop, tofu, seaweed, mushrooms, shallot' },
      { id: 'salade.homard', fr: 'Salade Homard', en: 'Lobster Salad',
        dFr: 'Salade mixte, tobiko, chair de homard, carotte, vinaigrette au sésame',
        dEn: 'Mixed salad, tobiko, lobster, carrot, sesame dressing' },
      { id: 'salade.chef', fr: 'Salade du Chef', en: "Chief's Salad",
        dFr: 'Salade mixte, tobiko, crabe, carotte, oshinko, wakame, vinaigrette au sésame',
        dEn: 'Mixed salad, tobiko, crab, carrot, oshinko, wakame, sesame dressing' },
      { id: 'salade.jardin', fr: 'Salade du Jardin', en: 'Garden Salad',
        dFr: 'Salade mixte, concombre, avocat, carotte, oshinko, wakame, vinaigrette au sésame',
        dEn: 'Mixed salad, cucumber, avocado, carrot, oshinko, wakame, sesame dressing' },
      { id: 'salade.wakame', fr: 'Salade Wakame', en: 'Wakame Salad',
        dFr: 'Wakame, carotte, avocat, concombre, oshinko, vinaigrette au sésame',
        dEn: 'Wakame, carrot, avocado, cucumber, oshinko, sesame dressing' },
    ],
  },

  {
    id: 'futomaki', fr: 'Futomakis', en: 'Futomakis',
    noteFr: '5 Morceaux', noteEn: '5 Pieces',
    teinte: '#F4585E', img: 'futomaki',
    plats: [
      { id: 'futomaki.vegetarien', fr: 'Végétarien', en: 'Vegetarian',
        dFr: 'Salade mixte, patate douce, wakame, oshinko, carotte, avocat, mangue, poivron, edamame',
        dEn: 'Mixed salad, sweet potato, wakame, oshinko, carrot, avocado, mango, bell pepper, edamame' },
      { id: 'futomaki.california', fr: 'California', en: 'California',
        dFr: 'Goberge, concombre, avocat, omelette, masago',
        dEn: 'Crab stick, cucumber, avocado, omelet, masago' },
      { id: 'futomaki.boston', fr: 'Boston', en: 'Boston',
        dFr: 'Crevette tempura, goberge, salade mixte, concombre, tobiko',
        dEn: 'Tempura shrimp, crab stick, mixed salad, cucumber, tobiko' },
      { id: 'futomaki.boston-deluxe', fr: 'Boston Deluxe', en: 'Boston Deluxe',
        dFr: 'Crevette tempura, crevettes sucrées, goberge, salade mixte, concombre, tobiko',
        dEn: 'Tempura shrimp, sweet shrimp, crab stick, mixed salad, cucumber, tobiko' },
      { id: 'futomaki.duo-saumon', fr: 'Duo Saumon', en: 'Duo Salmon',
        dFr: 'Saumon fumé, saumon cuit, goberge, masago, avocat, concombre, sauce épicée',
        dEn: 'Smoked salmon, cooked salmon, crab stick, masago, avocado, cucumber, spicy dressing' },
      { id: 'futomaki.dynamite', fr: 'Dynamite', en: 'Dynamite',
        dFr: 'Crevette tempura, goberge, avocat, concombre, salade mixte, tobiko, sauce épicée',
        dEn: 'Tempura shrimp, crab stick, avocado, cucumber, mixed salad, tobiko, spicy dressing' },
      { id: 'futomaki.spider-man', fr: 'Spider Man', en: 'Spider Man',
        dFr: 'Crabe à carapace molle, crabe, masago, concombre, sauce épicée',
        dEn: 'Soft-shell crab, crab, masago, cucumber, spicy dressing' },
      { id: 'futomaki.spider-woman', fr: 'Spider Woman', en: 'Spider Woman',
        dFr: 'Crabe à carapace molle, crevettes, goberge, masago, avocat, sauce épicée',
        dEn: 'Soft-shell crab, shrimp, crab stick, masago, avocado, spicy dressing' },
      { id: 'futomaki.homard', fr: 'Homard', en: 'Lobster',
        dFr: 'Chair de homard, fraise, mangue, avocat, tempura, tobiko, sauce épicée',
        dEn: 'Lobster, strawberry, mango, avocado, tempura, tobiko, spicy dressing' },
      { id: 'futomaki.kamikaze-thon', fr: 'Kamikaze Thon', en: 'Kamikaze Tuna',
        dFr: 'Thon, goberge, avocat, concombre, tempura, omelette, oshinko, sauce épicée',
        dEn: 'Tuna, crab stick, avocado, cucumber, tempura, omelet, oshinko, spicy dressing' },
      { id: 'futomaki.kamikaze-saumon', fr: 'Kamikaze Saumon', en: 'Kamikaze Salmon',
        dFr: 'Saumon, goberge, avocat, concombre, tempura, omelette, oshinko, sauce épicée',
        dEn: 'Salmon, crab stick, avocado, cucumber, tempura, omelet, oshinko, spicy dressing' },
      { id: 'futomaki.thon-epice', fr: 'Thon Épicé', en: 'Spicy Tuna',
        dFr: 'Thon, concombre, tempura, avocat, sauce épicée',
        dEn: 'Tuna, cucumber, tempura, avocado, spicy dressing' },
      { id: 'futomaki.saumon-epice', fr: 'Saumon Épicé', en: 'Spicy Salmon',
        dFr: 'Saumon, concombre, tempura, avocat, sauce épicée',
        dEn: 'Salmon, cucumber, tempura, avocado, spicy dressing' },
      { id: 'futomaki.petoncle', fr: 'Pétoncle', en: 'Scallop',
        dFr: 'Pétoncle, avocat, concombre, tobiko, sauce épicée',
        dEn: 'Scallop, avocado, cucumber, tobiko, spicy dressing' },
      { id: 'futomaki.rainbow', fr: 'Rainbow', en: 'Rainbow',
        dFr: 'Thon, saumon, crevette tempura, goberge, avocat, masago, sauce épicée',
        dEn: 'Tuna, salmon, tempura shrimp, crab stick, avocado, masago, spicy dressing' },
    ],
  },

  {
    id: 'frit', fr: 'Futomakis Frits', en: 'Fried Futomakis',
    noteFr: '6 Morceaux', noteEn: '6 Pieces',
    teinte: '#C0161C', img: 'frit',
    plats: [
      { id: 'frit.dragon', fr: 'Œil de Dragon', en: "Dragon's Eye",
        dFr: 'Saumon, carotte, tobiko, échalotte', dEn: 'Salmon, carrot, tobiko, shallot' },
      { id: 'frit.tigre', fr: 'Œil de Tigre', en: "Tiger's Eye",
        dFr: 'Saumon, crevette, tobiko, échalotte', dEn: 'Salmon, shrimp, tobiko, shallot' },
      { id: 'frit.ebi', fr: "Œil d'Ebi", en: "Ebi's Eye",
        dFr: 'Crevette, tobiko, échalotte', dEn: 'Shrimp, tobiko, shallot' },
    ],
  },

  /* Les deux sections ci-dessous sont vendues « 2 mcx / Sashimi 1 mcx ».
     Chaque poisson donne donc DEUX lignes commandables. Un ticket qui dirait
     seulement « Maguro » n'indiquerait pas a la cuisine s'il faut faire
     2 nigiris ou 1 sashimi : le ticket manquerait son seul et unique role. */
  {
    id: 'nigiri', fr: 'Nigiris Sushi', en: 'Nigiris Sushi',
    teinte: '#ED1F27', img: 'nigiri',
    plats: [
      { id: 'nigiri.maguro', fr: 'Maguro — Nigiri (2 mcx)', en: 'Maguro — Nigiri (2 pcs)', dFr: 'Thon rouge', dEn: 'Red tuna' },
      { id: 'nigiri.maguro-sashimi', fr: 'Maguro — Sashimi (1 mcx)', en: 'Maguro — Sashimi (1 pc)', dFr: 'Thon rouge', dEn: 'Red tuna' },
      { id: 'nigiri.sake', fr: 'Saké — Nigiri (2 mcx)', en: 'Sake — Nigiri (2 pcs)', dFr: 'Saumon', dEn: 'Salmon' },
      { id: 'nigiri.sake-sashimi', fr: 'Saké — Sashimi (1 mcx)', en: 'Sake — Sashimi (1 pc)', dFr: 'Saumon', dEn: 'Salmon' },
      { id: 'nigiri.kunsei', fr: 'Kunsei Saké — Nigiri (2 mcx)', en: 'Kunsei Sake — Nigiri (2 pcs)', dFr: 'Saumon fumé', dEn: 'Smoked salmon' },
      { id: 'nigiri.kunsei-sashimi', fr: 'Kunsei Saké — Sashimi (1 mcx)', en: 'Kunsei Sake — Sashimi (1 pc)', dFr: 'Saumon fumé', dEn: 'Smoked salmon' },
      { id: 'nigiri.ebi', fr: 'Ebi — Nigiri (2 mcx)', en: 'Ebi — Nigiri (2 pcs)', dFr: 'Crevette', dEn: 'Shrimp' },
      { id: 'nigiri.ebi-sashimi', fr: 'Ebi — Sashimi (1 mcx)', en: 'Ebi — Sashimi (1 pc)', dFr: 'Crevette', dEn: 'Shrimp' },
      { id: 'nigiri.kanikama', fr: 'Kanikama — Nigiri (2 mcx)', en: 'Kanikama — Nigiri (2 pcs)', dFr: 'Goberge', dEn: 'Crab stick' },
      { id: 'nigiri.kanikama-sashimi', fr: 'Kanikama — Sashimi (1 mcx)', en: 'Kanikama — Sashimi (1 pc)', dFr: 'Goberge', dEn: 'Crab stick' },
    ],
  },

  {
    id: 'gunkan', fr: 'Gunkan Nigiris', en: 'Gunkan Nigiris',
    teinte: '#C0161C', img: 'gunkan',
    plats: [
      { id: 'gunkan.maguro', fr: 'Maguro Épicé — Nigiri (2 mcx)', en: 'Spicy Maguro — Nigiri (2 pcs)', dFr: 'Thon rouge', dEn: 'Red tuna' },
      { id: 'gunkan.maguro-sashimi', fr: 'Maguro Épicé — Sashimi (1 mcx)', en: 'Spicy Maguro — Sashimi (1 pc)', dFr: 'Thon rouge', dEn: 'Red tuna' },
      { id: 'gunkan.sake', fr: 'Saké Épicé — Nigiri (2 mcx)', en: 'Spicy Sake — Nigiri (2 pcs)', dFr: 'Saumon', dEn: 'Salmon' },
      { id: 'gunkan.sake-sashimi', fr: 'Saké Épicé — Sashimi (1 mcx)', en: 'Spicy Sake — Sashimi (1 pc)', dFr: 'Saumon', dEn: 'Salmon' },
      { id: 'gunkan.hotate', fr: 'Hotate Épicé — Nigiri (2 mcx)', en: 'Spicy Hotate — Nigiri (2 pcs)', dFr: 'Pétoncle', dEn: 'Scallop' },
      { id: 'gunkan.hotate-sashimi', fr: 'Hotate Épicé — Sashimi (1 mcx)', en: 'Spicy Hotate — Sashimi (1 pc)', dFr: 'Pétoncle', dEn: 'Scallop' },
      { id: 'gunkan.homard', fr: 'Homard Épicé — Nigiri (2 mcx)', en: 'Spicy Lobster — Nigiri (2 pcs)', dFr: 'Homard', dEn: 'Lobster' },
      { id: 'gunkan.homard-sashimi', fr: 'Homard Épicé — Sashimi (1 mcx)', en: 'Spicy Lobster — Sashimi (1 pc)', dFr: 'Homard', dEn: 'Lobster' },
    ],
  },

  {
    id: 'chef', fr: 'Spécialité du Chef', en: "Chief's Special",
    noteFr: '5 Morceaux', noteEn: '5 Pieces',
    teinte: '#F4585E', img: 'chef',
    plats: [
      { id: 'chef.sashimi-roll', fr: 'Sashimi Roll', en: 'Sashimi Roll',
        dFr: 'Saumon, tempura, tobiko, feuille de concombre, sauce épicée',
        dEn: 'Salmon, tempura, tobiko, cucumber wrapper, spicy dressing' },
      { id: 'chef.soleil', fr: 'Le Soleil', en: 'The Sun',
        dFr: 'Feuille de soya, goberge, crevettes, pétoncle, saumon fumé, avocat, sauce épicée',
        dEn: 'Soy wrapper, crab stick, shrimp, scallop, smoked salmon, avocado, spicy dressing' },
      { id: 'chef.douce', fr: 'La Douce', en: 'Sweety',
        dFr: 'Feuille de soya, crevettes tempura, pétoncle, patate douce, avocat, tobiko, sauce épicée',
        dEn: 'Soy wrapper, tempura shrimp, scallop, sweet potato, avocado, tobiko, spicy dressing' },
      { id: 'chef.neptune', fr: 'Neptune', en: 'Neptune',
        dFr: 'Pétoncle grillé, crevettes tempura, chair de homard, crabe, avocat, concombre, masago',
        dEn: 'Grilled scallop, tempura shrimp, lobster, crab, avocado, cucumber, masago' },
      { id: 'chef.duo', fr: 'Le Duo', en: 'The Duo',
        dFr: "Saumon, thon, avocat, tempura, salade d'algue, sauce épicée",
        dEn: 'Salmon, tuna, avocado, tempura, seaweed salad, spicy dressing' },
      { id: 'chef.paradis', fr: 'Le Paradis', en: 'Paradise',
        dFr: 'Saumon, thon, tobiko, masago, crevettes tempura, sauce épicée',
        dEn: 'Salmon, tuna, tobiko, masago, tempura shrimp, spicy dressing' },
      { id: 'chef.comptoir', fr: 'Le Comptoir', en: 'Le Comptoir',
        dFr: 'Pétoncle, crevettes tempura, saumon fumé, goberge, masago, avocat, sauce épicée',
        dEn: 'Scallop, tempura shrimp, smoked salmon, crab stick, masago, avocado, spicy dressing' },
    ],
  },

  {
    id: 'plateau', fr: 'Plateaux', en: 'Platters',
    teinte: '#7C8F6B',
    plats: [
      { id: 'plateau.15', fr: '15 Morceaux', en: '15 Pieces',
        dFr: '3 nigiris, 2 gunkans, 4 hosomakis, 6 makis',
        dEn: '3 nigiris, 2 gunkans, 4 hosomakis, 6 makis' },
      { id: 'plateau.30', fr: '30 Morceaux', en: '30 Pieces',
        dFr: '6 nigiris, 4 gunkans, 8 hosomakis, 12 makis',
        dEn: '6 nigiris, 4 gunkans, 8 hosomakis, 12 makis' },
      { id: 'plateau.60', fr: '60 Morceaux', en: '60 Pieces',
        dFr: '8 nigiris, 6 gunkans, 16 hosomakis, 30 makis',
        dEn: '8 nigiris, 6 gunkans, 16 hosomakis, 30 makis' },
      { id: 'plateau.120', fr: '120 Morceaux', en: '120 Pieces',
        dFr: '16 nigiris, 12 gunkans, 32 hosomakis, 60 makis',
        dEn: '16 nigiris, 12 gunkans, 32 hosomakis, 60 makis' },
    ],
  },

  {
    id: 'extra', fr: 'Les Extras', en: 'Extras',
    teinte: '#7C8F6B',
    plats: [
      { id: 'extra.gingembre', fr: 'Gingembre', en: 'Ginger' },
      { id: 'extra.wasabi', fr: 'Wasabi', en: 'Wasabi' },
      { id: 'extra.sauce-epicee', fr: 'Sauce Épicée', en: 'Spicy Dressing' },
      { id: 'extra.feuille-soya', fr: 'Feuille de Soya', en: 'Soy Wrapper' },
      { id: 'extra.feuille-riz', fr: 'Feuille de Riz', en: 'Rice Wrapper' },
    ],
  },
];

/**
 * Index plat -> { plat, section }, construit une fois au demarrage.
 *
 * La validation d'une commande touche chaque ligne du panier ; parcourir les
 * 13 sections a chaque fois serait du travail refait a chaque commande.
 */
export const PLATS_PAR_ID = new Map(
  CARTE.flatMap((section) =>
    section.plats.map((plat) => [plat.id, { plat, section }]),
  ),
);

/** Le nom d'un plat dans la langue demandee. */
export function nomPlat(plat, langue) {
  return langue === 'en' ? plat.en : plat.fr;
}

/** Le nom d'une section dans la langue demandee. */
export function nomSection(section, langue) {
  return langue === 'en' ? section.en : section.fr;
}
