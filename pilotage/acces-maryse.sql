-- =============================================================
-- pilotage. — connexion de Maryse par « utilisateur + mot de passe »
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New query > coller > Run
--
-- Utilisateur : maryse      Mot de passe : 250566
-- Ce script ne crée AUCUN compte : il donne un mot de passe au compte de Maryse déjà créé
-- (au lieu du lien reçu par email) et lui associe le nom d'utilisateur « maryse ».
-- =============================================================

-- Petite table (invisible depuis le site) qui relie le nom d'utilisateur au compte
CREATE TABLE IF NOT EXISTS public.pilotage_logins (
    username TEXT PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE
);
ALTER TABLE public.pilotage_logins ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    -- Si le script n'arrive pas à trouver le compte tout seul, écrire l'email de Maryse entre les apostrophes :
    email_maryse TEXT := '';
    uid UUID;
    nb INT;
BEGIN
    IF email_maryse <> '' THEN
        SELECT id INTO uid FROM auth.users WHERE lower(email) = lower(email_maryse);
    END IF;
    -- Sinon : le compte qui possède déjà des données pilotage, ou l'unique compte du projet
    IF uid IS NULL THEN
        SELECT owner INTO uid FROM public.pilotage_items LIMIT 1;
    END IF;
    IF uid IS NULL THEN
        SELECT count(*) INTO nb FROM auth.users;
        IF nb = 1 THEN SELECT id INTO uid FROM auth.users; END IF;
    END IF;
    IF uid IS NULL THEN
        RAISE EXCEPTION 'Compte de Maryse introuvable : écrire son email dans email_maryse (ligne 20) puis relancer.';
    END IF;

    UPDATE auth.users
    SET encrypted_password = extensions.crypt('250566', extensions.gen_salt('bf')),
        email_confirmed_at = COALESCE(email_confirmed_at, now()),
        updated_at = now()
    WHERE id = uid;

    INSERT INTO public.pilotage_logins (username, user_id) VALUES ('maryse', uid)
    ON CONFLICT (username) DO UPDATE SET user_id = EXCLUDED.user_id;
END $$;

-- Traduit « maryse » en adresse email pour la connexion (ne donne accès à aucune donnée)
CREATE OR REPLACE FUNCTION public.pilotage_login_email(p_username TEXT)
RETURNS TEXT
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, auth
AS $$
    SELECT u.email FROM public.pilotage_logins l JOIN auth.users u ON u.id = l.user_id
    WHERE l.username = lower(trim(p_username));
$$;
REVOKE ALL ON FUNCTION public.pilotage_login_email(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pilotage_login_email(TEXT) TO anon, authenticated;
