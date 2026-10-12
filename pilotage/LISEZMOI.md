# pilotage. — mise en route

Application web personnelle (projets, calendrier, social media, budget, bien-être…).
Adresses :
- **Vercel : https://maryse-pilotage.vercel.app** (projet Vercel « maryse-pilotage », dossier racine `pilotage`)
- GitHub Pages (secours) : https://menage.themuselab.fr/pilotage/

### Publier sur Vercel (une seule fois)
1. vercel.com > Add New > Project > importer le dépôt GitHub `feesh-78/muse-lab-fidelite`.
2. Project Name : `maryse-pilotage` · Framework Preset : Other · Root Directory : `pilotage`.
3. Deploy. Ensuite chaque mise à jour de `main` se publie toute seule.

## Technologies (sans outil à installer)
- **HTML / CSS / JavaScript** simples : aucun « build », les fichiers sont publiés tels quels.
- **Supabase** : connexion par mot de passe, base de données et stockage des images/documents.
- **GitHub Pages** : publication automatique à chaque mise à jour de `main`.

## État
- Script `supabase-setup.sql` exécuté (table `pilotage_items`, espace privé `pilotage`, règles par propriétaire).
- Inscriptions publiques désactivées. Le compte de Maryse a été créé par Philippe : **aucun autre compte à créer**.
- À vérifier : première connexion réelle de Maryse (ordinateur puis téléphone) et synchronisation entre les deux.

## Connexion
- **Utilisateur : maryse · Mot de passe : 250566** (majuscules indifférentes pour l'utilisateur).
- Une seule connexion par appareil : la session est ensuite mémorisée et renouvelée automatiquement.
  Sur iPhone, Safari et l'app installée sur l'écran d'accueil comptent comme deux appareils.
- Mise en place (une fois) : exécuter `acces-maryse.sql` dans Supabase > SQL Editor. Le script donne ce mot
  de passe au compte déjà créé par Philippe (plus de lien par email) et ne crée aucun compte.
- Les fichiers `.sql` et `.md` ne sont pas publiés sur le site.

## Pages
01 accueil · 02 projets et fiches projet · 03 calendrier · 04 social media · 05 budget perso ·
06 objectif new york · 07 bien-être · 08 bucket list.

## 1. Préparer Supabase (déjà fait, pour mémoire)
1. Ouvrir le projet Supabase > **SQL Editor** > **New query**.
2. Coller tout le contenu de `supabase-setup.sql` et cliquer **Run**.
3. **Authentication > Users > Add user > Create new user** : ton email + un mot de passe,
   cocher « Auto Confirm User ».
4. **Authentication > Sign In / Providers > Email** : désactiver « Allow new users to sign up »
   (personne d'autre ne pourra créer de compte).

## 2. Se connecter
Ouvrir l'adresse, entrer l'utilisateur et le mot de passe. À la première connexion, l'outil se remplit
avec le contenu des maquettes (projets, tâches) : tout est modifiable et supprimable.

## 3. Installer sur iPhone
Safari > bouton **Partager** > **Sur l'écran d'accueil**.

## Mode démo (facultatif)
Le lien « essayer en mode démo » permet d'essayer l'outil sans compte. Un bandeau le rappelle sur
chaque page : les données restent uniquement sur l'appareil utilisé, sans sauvegarde en ligne ni
synchronisation. Elles ne sont jamais mélangées avec celles du compte.
