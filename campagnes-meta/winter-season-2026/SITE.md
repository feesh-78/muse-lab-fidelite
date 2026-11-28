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
