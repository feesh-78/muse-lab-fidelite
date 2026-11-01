# Workshops novembre 2026 : plan de mise à jour du site

Source de vérité : Bsport (relevé du 1er novembre 2026). Les affiches de ce dossier ont été contrôlées une à une contre ce relevé.

## 1. Les 8 workshops (ordre chronologique)

| Date | Workshop | Prof | Horaire | Studio | Tarif affiche | URL prévue | Visuel |
|---|---|---|---|---|---|---|---|
| sam. 7/11 | Sensual Jazz | Maria K | 17h30-19h30 | Montigny (78) | 25 € | `/workshop-sensual-jazz-montigny-78/` | `sensual-jazz-montigny-07-11-2026.jpg` (corrigé) |
| sam. 14/11 | Commercial Girly | Catalina | 14h-16h | Montigny (78) | 25 € | `/workshop-commercial-girly-montigny-78/` | `commercial-girly-montigny-14-11-2026.jpg` |
| dim. 15/11 | Commercial | Kalie T | 17h30-19h30 | Boulogne (92) | 25 € | `/workshop-commercial-boulogne-92/` | `commercial-boulogne-15-11-2026.jpg` |
| sam. 21/11 | Clip Performance (vidéaste @maisonkonta) | Maryse Norah | 13h-18h | Boulogne (92) | 35 € | `/workshop-clip-performance-boulogne-92/` | `clip-performance-boulogne-21-11-2026.jpg` |
| dim. 22/11 | Heels Intensive Initiation | Laura L | 14h-16h | Boulogne (92) | 25 € | `/workshop-heels-initiation-boulogne-92/` | `heels-initiation-boulogne-22-11-2026.jpg` |
| dim. 22/11 | Afro Dancehall | Kalie T | 14h-16h | Montigny (78) | 25 € | `/workshop-afro-dancehall-montigny-78/` | `afro-dancehall-montigny-22-11-2026.jpg` (corrigé) |
| dim. 22/11 | Street Jazz | Tiara Hamdan | 16h30-18h30 | Boulogne (92) | 25 € | `/workshop-street-jazz-boulogne-92/` | `street-jazz-boulogne-22-11-2026.jpg` |
| sam. 28/11 | Lady Fusion | Lory | 14h-16h | Boulogne (92) | **à confirmer** | `/workshop-lady-fusion-boulogne-92/` | **manquant** |

Ces 8 événements sont tous niveaux et accessibles aux débutantes (à confirmer pour Lady Fusion). Couvertures studio : `workshops-novembre-2026-boulogne.jpg` et `workshops-novembre-2026-montigny.jpg`.

Corrections faites sur les affiches (design et photo conservés) :
- Sensual Jazz : « 21 rue Diaz, 92100 Boulogne-Billancourt » remplacé par « 2 Av. des Bosquets, 78180 Montigny-le-Bretonneux ».
- Afro Dancehall : « 17H30 19H30 » remplacé par « 14H 16H ».

À ne pas ajouter : R&B Street Jazz et Street Girly On Set, qui ne sont pas confirmés.

Lady Fusion : aucun prix, aucun niveau, aucun programme et aucune indication de places restantes tant que ce n'est pas confirmé. La page se prépare avec la mention « Tarif et inscription : bientôt disponibles ».

## 2. Pages

- On crée une nouvelle page par workshop, en copiant le `_elementor_data` du modèle workshop (4608 / 4666) par l'API REST.
- On ne réutilise pas 4666 (workshop-sensual-dance) : c'est l'archive d'un autre événement, utile au SEO, qui reste dans les événements passés.
- On retire de chaque copie l'ancien widget HTML Bsport et on le remplace par un encart « Réservation en ligne bientôt disponible » avec un lien vers le planning du bon studio. Le widget exact sera branché dans un 3e temps.
- Boutons :
  - « Je réserve » mène à `#planning` (l'emplacement du widget) ;
  - studio Montigny : planning `/le-planning/` ;
  - studio Boulogne : planning `/le-planning-boulogne-92/`.

### SEO Rank Math (proposition)

| Page | Titre SEO | Meta description | Mot-clé |
|---|---|---|---|
| Sensual Jazz 78 | Workshop Sensual Jazz à Montigny (78), 7 novembre \| The Muse Lab | Workshop Sensual Jazz entre femmes avec Maria K, samedi 7 novembre 2026 de 17h30 à 19h30 à Montigny-le-Bretonneux. Tous niveaux, 25 €. | workshop sensual jazz montigny |
| Commercial Girly 78 | Workshop Commercial Girly à Montigny (78), 14 novembre \| The Muse Lab | Workshop Commercial Girly girls only avec Catalina, samedi 14 novembre 2026 de 14h à 16h à Montigny-le-Bretonneux. Accessible aux débutantes, 25 €. | workshop commercial girly montigny |
| Commercial 92 | Workshop Commercial à Boulogne (92), 15 novembre \| The Muse Lab | Workshop Commercial entre femmes avec Kalie T, dimanche 15 novembre 2026 de 17h30 à 19h30 à Boulogne-Billancourt. Tous niveaux, 25 €. | workshop commercial boulogne |
| Clip Performance 92 | Workshop Clip Performance à Boulogne (92), 21 novembre \| The Muse Lab | Tourne ta perf' avec Maryse Norah et le vidéaste @maisonkonta, samedi 21 novembre 2026 de 13h à 18h à Boulogne-Billancourt. Tous niveaux, 35 €. | workshop clip danse boulogne |
| Heels Initiation 92 | Workshop Heels Initiation à Boulogne (92), 22 novembre \| The Muse Lab | Initiation heels entre femmes avec Laura L, dimanche 22 novembre 2026 de 14h à 16h à Boulogne-Billancourt. Accessible aux débutantes, 25 €. | workshop heels boulogne |
| Afro Dancehall 78 | Workshop Afro Dancehall à Montigny (78), 22 novembre \| The Muse Lab | Workshop Afro Dancehall girls only avec Kalie T, dimanche 22 novembre 2026 de 14h à 16h à Montigny-le-Bretonneux. Tous niveaux, 25 €. | workshop afro dancehall montigny |
| Street Jazz 92 | Workshop Street Jazz à Boulogne (92), 22 novembre \| The Muse Lab | Workshop Street Jazz entre femmes avec Tiara Hamdan, dimanche 22 novembre 2026 de 16h30 à 18h30 à Boulogne-Billancourt. Tous niveaux, 25 €. | workshop street jazz boulogne |
| Lady Fusion 92 | Workshop Lady Fusion à Boulogne (92), 28 novembre \| The Muse Lab | Workshop Lady Fusion entre femmes avec Lory, samedi 28 novembre 2026 de 14h à 16h à Boulogne-Billancourt. Infos et réservation bientôt en ligne. | workshop lady fusion boulogne |

## 3. Tri des événements (complément de Philippe)

Halloween Boulogne (31/10) et Halloween Montigny (1/11) passent en « Terminé ».

| Où | Action |
|---|---|
| Page Halloween 4989 | Conserver en ligne. Pastilles `2a6f0bb7` et `2ff4d39` → « Terminé ». Boutons de réservation, dont `90a3525`, → « Voir les prochains events », vers `/les-workshops-the-muse-lab/#workshops`. Retirer le widget Bsport Halloween (conteneur `32279de7`). |
| Page Events 4671 | Carte Halloween `16c7b9f5` déplacée de la grille events `f06dabf` vers la grille des événements passés `5801f632`, en première position, pastille « Terminé ». Grille « à venir » `6fc607c4` : les 8 cartes par date. Retirer la note « up-soon » `7b528c41`. |
| Composant « nos events » 4370 | Retirer la carte Halloween `78de7b1e`. Grille `26d8da1a` : les prochains workshops par date. |
| Bandeau header 2434 | Retirer les éléments Halloween `1e7dd9cf` et `3aa817bd`. Nouveau texte : « Workshops de novembre à Boulogne et Montigny ». Bouton « Découvrir » `1064369` / `9863ce1` → `/les-workshops-the-muse-lab/#workshops`. |
| Pop-up 3509 | Arrêter la promo Halloween : restaurer le contenu d'origine (« COURS SAMEDIS (92) », « Viens avec une proche ! », « J'en profite ! », « JE M'INSCRIS ! ») à partir de la révision Elementor du 29/10, puisque la sauvegarde locale a été perdue au redémarrage du conteneur. Sinon, dépublier la pop-up. Ne jamais laisser Halloween en ligne. |
| Plannings 4679 (78) / 4680 (92), accueil, pages studios | Vérifier qu'aucune mention Halloween ne reste active, et que chaque studio ne renvoie qu'à ses propres workshops. |

Ce qu'on ne touche pas : les campagnes Meta (ni arrêt, ni suppression, ni dépense) et les séances Bsport.

## 4. Widgets Bsport à récupérer (3e temps)

Il faut le widget exact de chacun des 8 événements, en vérifiant l'événement, le studio et la date. Aucun ancien widget ne doit être réutilisé.

## 5. Vérifications finales

- Captures desktop (1440 px) et mobile (390 px), cache purgé, de :
  - l'accueil ;
  - la page Events ;
  - les 8 pages workshop ;
  - Halloween ;
  - les 2 plannings ;
  - les pages studios.
- Contrôle de tous les liens : statut 200 et ancres existantes.
