-- =============================================================
-- pilotage. — accès SANS mot de passe (temporaire)
-- À exécuter dans Supabase : SQL Editor > New query > coller > Run
--
-- Ouvrir maryse-pilotage.vercel.app donne directement accès à l'espace de Maryse, sur tous les appareils.
-- Contrepartie : toute personne qui connaît l'adresse peut voir et modifier ces données.
-- L'agenda iCloud et les rappels demandent une vraie connexion : ils restent en pause dans ce mode.
--
-- POUR REMETTRE LE MOT DE PASSE, exécuter :
--   DROP POLICY IF EXISTS "pilotage_items_acces_libre" ON public.pilotage_items;
--   DROP POLICY IF EXISTS "pilotage_fichiers_acces_libre" ON storage.objects;
--   DROP FUNCTION IF EXISTS public.pilotage_open_owner();
-- L'outil réaffiche alors l'écran de connexion tout seul.
-- =============================================================

-- Compte dont les données sont ouvertes (celui de Maryse)
CREATE OR REPLACE FUNCTION public.pilotage_open_owner()
RETURNS UUID
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT user_id FROM public.pilotage_logins WHERE username = 'maryse';
$$;
REVOKE ALL ON FUNCTION public.pilotage_open_owner() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pilotage_open_owner() TO anon, authenticated;

-- Projets, tâches, rendez-vous… : lecture et écriture sans connexion, uniquement les données de Maryse
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pilotage_items TO anon;
DROP POLICY IF EXISTS "pilotage_items_acces_libre" ON public.pilotage_items;
CREATE POLICY "pilotage_items_acces_libre" ON public.pilotage_items
    FOR ALL TO anon
    USING (owner = public.pilotage_open_owner())
    WITH CHECK (owner = public.pilotage_open_owner());

-- Images et documents de Maryse (espace « pilotage », dossier à son nom)
DROP POLICY IF EXISTS "pilotage_fichiers_acces_libre" ON storage.objects;
CREATE POLICY "pilotage_fichiers_acces_libre" ON storage.objects
    FOR ALL TO anon
    USING (bucket_id = 'pilotage' AND (storage.foldername(name))[1] = public.pilotage_open_owner()::text)
    WITH CHECK (bucket_id = 'pilotage' AND (storage.foldername(name))[1] = public.pilotage_open_owner()::text);
