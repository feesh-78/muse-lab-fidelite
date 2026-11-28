# Winter Season et cartes cadeaux de Noël : site, 28/11/2026

Sauvegardes d'avant les modifications dans la session Claude (bk/winter_20261128).

## Accueil (/) : publié après validation de la page de test

- Hero Noël, d'après la maquette de Maryse, refait dans Elementor :
  - Montigny : fond crème, pastille « ❄ the winter season » ;
  - Boulogne : fond rouge, pastille « mom, i still dance in december. » ;
  - points colorés sur les titres ;
  - flocons animés (effet de la LP Winter Season), sticker « winter intensive » qui tourne.
- Styles écrits directement dans la page (`ml-winter-hero`), pour ne pas dépendre de la feuille CSS en cache chez les visiteurs.
- Le bouton « Découvre The Winter Season » n'est pas mis : la page /winter-season n'existe pas encore.
- Bloc carte cadeau remonté sous le hero et passé en version Noël :
  - photo du sapin, titre « offrez-lui un cours de danse. », texte avec les 4 offres ;
  - bouton « Je découvre les cartes cadeaux » vers /cartes-cadeaux/.

## Page /cartes-cadeaux/ (id 5204)

- Maquette de Maryse (mail du 28/11) refaite dans Elementor :
  - en-tête avec le sapin, bandeau qui défile ;
  - 4 cartes (18 €, montant libre, 50 €, 70 €), 3 étapes ;
  - compte à rebours jusqu'au 24/12, FAQ.
- Bloc « CODE BSPORT CARTE CADEAU » (widget HTML, ancre #acheter) à la place du bouton sous les cartes. En attendant le widget Bsport, il contient un bouton vers le lien carte cadeau 16554. Les boutons de l'en-tête et du compte à rebours mènent à #acheter.
- SEO Rank Math, page ouverte à Google le 28/11.

## Menu (header 2434)

- « Cartes cadeaux » ajouté après « Les tarifs », dans le menu ordinateur et dans le menu mobile.
- Ajustement du header (widget `ml-nav-fit`) :
  - 1461 à 1560 px : menu resserré ;
  - 1025 à 1460 px : bouton « Menu ☰ ».
  Le menu débordait déjà à 1280 px avant l'ajout.

## À faire

- Coller le code du widget Bsport carte cadeau dans le bloc #acheter.
- Liens carte cadeau en mode aperçu (`isPreview=true`) sur l'accueil 92 et sur Tarifs : à corriger après accord.
- Ads cartes cadeaux : gérées dans la conversation Ads (aucune dépense lancée ici).

## 28/11 : widget Bsport carte cadeau intégré (page 5204, bloc 55b2caa, #acheter)

- Code officiel transmis par Philippe, inséré sans modification : `giftcard`, `giftcards: [16554]`, `dialogMode: 3`, conteneur `bsport-widget-105791`. D'après Bsport, une seule carte active, au montant libre.
- Encadré aux couleurs de la page autour du widget. Les offres de Maryse (18 €, 50 €, 70 €) y sont présentées comme des montants suggérés sur une seule carte.
- La FAQ de la page indique « durée de validité indiquée au moment de l'achat » (au lieu de fin février 2027). Le texte du bloc de l'accueil et la description SEO de la page sont alignés.
- Isolation des styles : la règle du kit `.elementor-kit-6 button` (fond bordeaux, arrondi 28 px) et celles du thème Hello (`width:auto`, `nowrap`) déformaient la carte du widget. Elles sont neutralisées uniquement sur les boutons à image dans `#bsport-widget-105791`.
- Vérifié avec une carte simulée (le script Bsport est bloqué dans la session) : la carte fait 420 px sur ordinateur et prend toute la largeur sur mobile, image en grand, titre sur une ligne. Les boutons de la page ne changent pas.
- 28/11, suite : les conteneurs de la carte dans le widget (grille ou rangée prévue pour plusieurs cartes) passent sur une seule colonne pleine largeur. Carte centrée, 360 px max, image proportionnée. Vérifié avec des structures simulées en grille auto-fill et en rangée flex à 1/6. Aucun !important, boutons de la page inchangés.

## Menu mobile (burger) — 28/11
- À gauche : visuel des cartes cadeaux, avec le lien « Cartes cadeaux → » et « idée cadeau de Noël » en dessous (widget HTML `68341e0`, dans le panneau `2ba2603`).
- L'ancienne ligne « Cartes cadeaux » de la liste (`580acff6`) est masquée dans le burger. Le menu desktop est inchangé.
- Nouveau titre gris non cliquable « Ressources » (`e9288f1`, même classe que « Plannings ») après « Location de salle ».
- Flocons animés en fond du panneau (même effet que le hero de l'accueil, désactivés si « réduire les animations »).
- Contrôlé en 375, 390, 430 et 1280 px : pas de chevauchement ni de débordement.

## Accueil 92 (28/11)
- Espace sous le menu : padding haut du bloc 477e5426 porté à 200 px (ordinateur), 196 px (tablette) et 172 px (téléphone), via le style critique `ml-hero92-offset` ; le titre ne colle plus au menu.
- Flocons dans le hero rouge, même effet que sur l accueil 78 (widget `ml-snow-92`).

## Winter Season en ligne + blocs accueil (28/11)
- `/winter-season/` (5272) est publiée et indexée. La page de test 5275 est à la corbeille.
- Accueil 78 (4315) : hero → bloc Winter (`613b6fe`) → bloc carte cadeau (`42dedb1e`) → suite (planning…).
- Accueil 92 (4316) : hero → bloc Winter (`208ed5a`) → bloc carte cadeau (`b6412ce`) → suite.
- Les blocs sont des clones du bloc carte cadeau existant (nouveaux id), avec un CSS critique inline par id, insensible au cache. Le bloc Winter est rouge, avec la photo de la maquette et un bouton vers /winter-season/.
- Le bandeau défilant « Winter Intensive » pointe vers /winter-season/.

- 28/11 soir : flocons du 92 rendus bien visibles (3 tailles, vitesses différentes, opacité 0.8). Menu burger : carte cadeau resserrée en haut à gauche, puis vignette « Winter Season → » (photo de la saison, lien /winter-season/) en dessous.
