# Audit mobile — contenu masqué par le header fixe (28/11/2026)

**Périmètre :** 43 contenus publiés dans WordPress (39 pages + 4 articles). 42 sont dans le sitemap Rank Math. La page de test `/test-article-cadeau-danse/` (noindex, hors sitemap) n'a pas été auditée.
Chaque URL a été mesurée en 375, 390 et 430 px de large (iPhone UA, scroll 0), soit 126 mesures.

## Cause
- Le header fixe mesure 106 px sur mobile (bandeau 34 + nav 72).
- Le premier bloc des pages V4 (classe globale `ml-hero`, plus le hero de `/le-studio/`) n'avait que 96 px de padding haut sur mobile. Le badge ou le titre passait donc 10 px sous le menu.
- La page vide `/boutique/` faisait remonter le footer sous le header.

## Correctif (unique, centralisé)
- Le correctif est du CSS inline dans le widget HTML `ml-nav-fit` du header 2434. Il est chargé sur toutes les pages et insensible au cache CSS Elementor.
- Il est limité à `@media (max-width:767px)` :
  - premier `.e-con.ml-hero` des pages et articles, ainsi que le hero `ca60f5d` (/le-studio/) : `padding-top:136px` (30 px sous le header) ;
  - pages `elementor_header_footer` sans contenu (/boutique/) : footer décalé de 106 px.
- Pas de double espacement : les sections V3 déjà décalées par le header ne sont pas ciblées, et `/cartes-cadeaux/` (padding 150) n'est pas touchée.
- Desktop et tablette sont inchangés : padding hero mesuré à 120 px en 768 et 1024, 160 px en 1440.
- Sauvegarde préalable de toutes les pages, articles et du header (backup local de session). Cache Elementor purgé. Le cache page LiteSpeed s'est purgé seul : le correctif a été vérifié dans le HTML servi.

## Résultats
| | Masqué | Serré | OK | Non mesurable |
|---|---|---|---|---|
| Avant | 30 mesures (10 URLs) | 3 | 87 | 6 |
| Après | **0** | 3 | 117 | 6 |

**URLs corrigées (10) :**
- `/le-planning-boulogne-92/` (et la redirection `/le-planning-92/`)
- `/le-planning/`
- `/le-studio/`
- `/les-workshops-the-muse-lab/`
- `/location-de-salles/`
- `/application/`
- les 4 articles de blog

`/boutique/` a aussi été corrigée (footer).

**Exceptions (sans action) :**
- `/cartes-cadeaux/` « serré » : c'est la pastille décorative « idée cadeau de noël » à 5 px sous le header. Le contenu du hero est bien visible.
- `/mon-compte/` : la page n'a pas de texte, l'image démarre exactement sous le header.
- `/boutique/` : pas de contenu de page (footer seul), corrigée visuellement.
- `/halloween-entre-femmes-paris-92-78/`, `/location-montigny-infos-2/`, `/location-boulogne-infos/` : elles utilisent un autre header (non fixe) et n'étaient pas concernées.

## Contrôles complémentaires (après)
- **Ancres :** 77 liens d'ancre internes testés en 390 px, aucune cible sous le header. Les 2 liens `#programme` et `#infos` de la page Halloween (événement passé) sont masqués sur mobile. Testées en accès direct, ces ancres fonctionnent.
- **Ancre `#acheter` des cartes cadeaux :** le bloc arrive à 150 px, sous le header de 106 px, en 375, 390 et 430.
- **Menu mobile :** 10 liens visibles, y compris « Cartes cadeaux », aucun débordement horizontal (375, 390, 430).
- **Conteneurs des widgets Bsport présents :**
  - Cartes cadeaux : 105791
  - Tarifs : 602104 et 625574
  - Planning 92 : 667687
  - Planning 78 : 606100 et 890763
  - Heels : 338923
  - Accueils : 606100 et 765276

  Le CDN Bsport est bloqué dans l'environnement de test : le rendu des widgets est à vérifier sur un vrai téléphone.
