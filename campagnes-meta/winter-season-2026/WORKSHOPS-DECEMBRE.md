# Workshops décembre 2026 — pages dédiées (28/11/2026)

**Sources :**
- email « Workshops décembre » de l'équipe (13 affiches) ;
- email de Maryse « Page The Winter Season » (descriptions, profs, horaire Modern Jazz Boulogne confirmé 14h-16h).

**Gabarit :** page ads des workshops de novembre (header masqué, barre de réservation propre), affiche officielle en image.
**Réservation :** en attendant le code Bsport dédié de chaque workshop, la page affiche le planning Bsport du studio (copie du widget existant, conteneur unique `bsport-widget-dec<clé>`). Elle invite à avancer jusqu'à la date du workshop.

| Workshop | Date / horaire | Prof | Tarif | Niveau | Page | Statut |
|---|---|---|---|---|---|---|
| Heels dance · Boulogne | sam. 5/12 · 16h-18h | Dorine | 25 € | Tous niveaux | /workshop-heels-boulogne-92/ (page existante 5194) | publiée |
| Commercial · Boulogne | dim. 6/12 · 16h30-18h30 | Luna | 25 € | Tous niveaux | /workshop-commercial-boulogne-92/ (page existante 5137) | publiée |
| Modern Jazz · Boulogne | sam. 12/12 · 14h-16h | Eva | 25 € | Tous niveaux | /workshop-modern-jazz-boulogne-92/ | publiée |
| Sensual Heels · Boulogne | sam. 19/12 · 14h-16h | Maryse Norah | 25 € | à venir (absent de l'affiche) | /workshop-sensual-heels-boulogne-92/ | publiée |
| Street Girly · Boulogne | sam. 19/12 · 16h-18h | Maryse Norah | 25 € | Tous niveaux | /workshop-street-girly-boulogne-92/ | publiée |
| Modern Jazz · Montigny | sam. 5/12 · 14h-16h | Eva | 25 € | Tous niveaux | /workshop-modern-jazz-montigny-78/ | publiée |
| Commercial · Montigny | **sam. 5/12** (affiche) vs **dim. 6/12** (page Winter) · 11h30-13h30 | Eva | 25 € | Tous niveaux | /workshop-commercial-montigny-78/ | **brouillon : date à confirmer** |
| Heels Intensive · Montigny | sam. 12/12 · 13h-16h | Maryse Norah | 35 € | Chorégraphie débutantes | /workshop-heels/ (page existante 4665, ex-Heels Intensive 17/10) | publiée |
| Street Jazz · Montigny | dim. 13/12 · 14h-16h | Maryse Norah | 25 € | Tous niveaux | /workshop-street-jazz-montigny-78/ | publiée |
| Sensual Afro · Montigny | dim. 20/12 · 14h-16h | Maryse Norah | 25 € | Tous niveaux | /workshop-sensual-afro-montigny-78/ | publiée |
| Heels · Montigny | dim. 20/12 · 16h-18h | Maryse Norah | 25 € | Tous niveaux | /workshop-heels-montigny-78/ | publiée |

Page IDs WordPress 5226 à 5236, affiches médias 5215 à 5225.

**Règle SEO (Philippe, 28/11) : une URL stable par style et par studio, sans date, réutilisée à chaque édition.**
- Les pages existantes ont été mises à jour avec le contenu de décembre : Heels 92 (5194), Commercial 92 (5137), Heels Intensive 78 (`/workshop-heels/`, 4665). Les doublons créés par erreur (5226, 5227, 5233) sont à la corbeille.
- Les nouvelles URL créées (Modern Jazz 92/78, Sensual Heels 92, Street Girly 92, Street Jazz 78, Sensual Afro 78, Heels 78, Commercial 78) n'ont pas de date : elles serviront aux prochaines éditions.
- Titres et descriptions Rank Math mis à jour (ils affichaient encore novembre).

**Lady Fusion et Heels du 28/11 annulés** (trop peu d'inscrites) :
- la page Lady Fusion est passée en brouillon ;
- l'URL Heels a été reprise pour le Heels du 5/12 ;
- les deux workshops ont été retirés du bloc « nos events », de la page Événements, du bandeau défilant et de la note du planning 92 ;
- ils sont remplacés par les 10 workshops de décembre et un bandeau « Winter Intensive ».

**À faire :**
- intégrer le code Bsport de chaque workshop (fourni par Philippe) ;
- confirmer la date du Commercial Montigny ;
- confirmer le niveau du Sensual Heels ;
- puis la page /winter-season.

## Mise à jour du 28/11 (soir), d'après Bsport (vérifié par Philippe)
- Profs selon Bsport : Vae (Modern Jazz 78 et 92, Commercial 78), Dorine R (Heels 92), Luna L (Commercial 92), Maryse (les autres).
- Commercial Montigny : **dimanche 6/12, 11h30-13h30**, page publiée. L'affiche reçue indique « samedi 5 » : elle n'est pas utilisée. La page et la carte affichent le visuel de couverture « workshops décembre Montigny » en attendant une affiche corrigée.
- Sensual Heels : tous niveaux.
- Nouvelle page Soirée Astro & Tirage : /soiree-astro-tirage-boulogne-92/ (dim. 13/12, 19h-21h, Boulogne, Maryse, 20 €, 10 places).
- Page Événements et bloc « nos events » : 12 dates, conformes au tableau Bsport.
- Lady Fusion : page mise à la corbeille, plus aucune mention en ligne.

## Cartes cadeaux
- Validité : « Valable 1 an à partir de la date d'achat » (FAQ, accueil, article de test).
- 4 widgets Bsport, un sous chaque carte : 24458 (1 cours), 16554 (montant libre), 24460 (cours privé), 24459 (cours privé à 2).
- Le script commun n'est chargé qu'une fois, en tête de la section. L'ancien bloc 105791 est retiré (plus de doublon).
- L'ancre #acheter est désormais sur la section des cartes.

## Calendriers Bsport dédiés (codes fournis par Philippe, 28/11)
Chaque page a son widget calendrier, filtré sur l'activité du workshop (avec le studio quand le code l'indique), à la place du planning générique du studio. Le script de chargement est placé une fois, juste avant le widget. Contrôle en 390 et 1440 px : 1 conteneur par page, aucune erreur JavaScript. Le rendu Bsport lui-même n'est pas visible depuis l'environnement de test (CDN bloqué).
