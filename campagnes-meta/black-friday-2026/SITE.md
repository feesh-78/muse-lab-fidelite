# Black Friday 2026 (12 au 17 novembre) : mise à jour du site, faite le 12 novembre

Les sauvegardes d'avant les modifications sont dans la session Claude (bk/bf_20261112 et bk/4344_before_P0_20261112.json).

- P0, page Tarifs : le widget pass est remplacé par le conteneur bsport-widget-602104 (catégories 31338, 24141, 21012, 14914, hidePrivatePass et hideFilters activés). Le widget abonnements est conservé.
- Accueil 78 (/) : visuel 1 (média 5180) avant le planning, ancre #black-friday.
- Accueil 92 (/accueil-boulogne/) : visuel 2 (média 5181) avant le planning.
- Tarifs : visuel 1 placé après l'en-tête. L'ancre #offres est sur la section « nos formules ».
- Pop-up 3509 : visuel 1 et bouton « J'en profite », centrée, 440 px sur desktop et 86vw sur mobile, croix de 28 px sur une bande sombre. Déclencheurs inchangés.
- Bandeau du header : « Black Friday jusqu'au 17 nov. · Carte 10 cours 125 € au lieu de 140 € · Carte 3 cours +1 offert », lien /les-tarifs/#offres. Les workshops de novembre restent dans le bandeau, avec un lien vers la page Events. Vitesse : 22 → 32 px/s sur desktop et 20 → 29 px/s sur mobile (environ +45 %, durée de 40 s conservée).
- Tous les boutons Black Friday mènent à /les-tarifs/#offres.
- Bug de l'accueil 92 (titre sous le header fixe) : la marge haute du bloc texte de l'en-tête passe de 72 à 128 px sur mobile, et de 80 à 156 px sur tablette. L'accueil 78 n'était pas touché.
- À signaler : dans Bsport, la carte 10 cours Black Friday est valable 3 mois (du 12/11/2026 au 11/02/2027), alors que le visuel annonce 4 mois. Rien n'a été modifié, en attente du propriétaire.
- Après le 17/11 : retirer les sections Black Friday, la pop-up et le message du bandeau.

## Correctif du 12/11 après retour visiteur (iPhone Safari, non connecté)

- Cause : Elementor sert ses feuilles CSS de page (`/wp-content/uploads/elementor/css/local-<page>-frontend-*.css`) sans numéro de version dans l'URL, avec `Cache-Control: max-age=2592000` (30 jours). Un visiteur venu avant les modifications garde l'ancienne feuille. Il ne voit donc ni les styles de la section Black Friday (flyer et bouton côte à côte, fond blanc), ni la nouvelle marge du titre de l'accueil 92. Le serveur sert bien les bons fichiers et le cache LiteSpeed des pages est purgé à chaque mise à jour : c'est pour ça que les tests admin étaient corrects.
- Correctif : les styles critiques sont maintenant posés directement dans le HTML (widget HTML `bf-css-critique`, `<style id="ml-bf-critical">`) sur l'accueil 78, l'accueil 92 et Tarifs. Ils couvrent la section Black Friday (colonne centrée, fond noir, flyer entier, bouton dessous) et la marge du titre de l'accueil 92 (136 px sur mobile, 156 px sur tablette, 80 px sur desktop). Le HTML est rechargé à chaque visite, donc indépendant de la feuille en cache.
- Vérifié sur les URL publiques sans paramètre, non connecté, en 390, 430, 768 et 1440 px. Également vérifié en simulant une feuille CSS périmée.
- Preuves : preuves-correctifs-12-11.png.
