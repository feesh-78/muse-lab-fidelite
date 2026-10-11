# pilotage. — mise en route

Application web personnelle (projets, calendrier, social media, budget, bien-être…).
Adresse une fois publiée : **https://menage.themuselab.fr/pilotage/**

## Technologies (sans outil à installer)
- **HTML / CSS / JavaScript** simples : aucun « build », les fichiers sont publiés tels quels.
- **Supabase** : connexion par mot de passe, base de données et stockage des images/documents.
- **GitHub Pages** : publication automatique à chaque mise à jour de `main`.

## 1. Préparer Supabase (une seule fois, 5 minutes)
1. Ouvrir le projet Supabase > **SQL Editor** > **New query**.
2. Coller tout le contenu de `supabase-setup.sql` et cliquer **Run**.
3. **Authentication > Users > Add user > Create new user** : ton email + un mot de passe,
   cocher « Auto Confirm User ».
4. **Authentication > Sign In / Providers > Email** : désactiver « Allow new users to sign up »
   (personne d'autre ne pourra créer de compte).

## 2. Se connecter
Ouvrir l'adresse, entrer l'email et le mot de passe. À la première connexion, l'outil se remplit
avec le contenu des maquettes (projets, tâches) : tout est modifiable et supprimable.

## 3. Installer sur iPhone
Safari > bouton **Partager** > **Sur l'écran d'accueil**.

## Mode démo
Le lien « découvrir en mode démo » permet d'essayer l'outil sans compte : les données restent
uniquement sur l'appareil utilisé.
