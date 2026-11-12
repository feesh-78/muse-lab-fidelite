-- =============================================================
-- pilotage. — espace personnel de Maryse
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New query > coller > Run
-- Tout est privé : chaque ligne et chaque fichier n'est lisible que par son propriétaire connecté.
-- =============================================================

-- Toutes les données (projets, tâches, rendez-vous, budget, bien-être…) dans une seule table
CREATE TABLE IF NOT EXISTS pilotage_items (
    owner UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    id TEXT NOT NULL,
    kind TEXT NOT NULL,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (owner, id)
);
CREATE INDEX IF NOT EXISTS pilotage_items_kind ON pilotage_items (owner, kind);

ALTER TABLE pilotage_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "pilotage : lecture par la propriétaire" ON pilotage_items;
DROP POLICY IF EXISTS "pilotage : ajout par la propriétaire" ON pilotage_items;
DROP POLICY IF EXISTS "pilotage : modification par la propriétaire" ON pilotage_items;
DROP POLICY IF EXISTS "pilotage : suppression par la propriétaire" ON pilotage_items;

CREATE POLICY "pilotage : lecture par la propriétaire" ON pilotage_items
    FOR SELECT TO authenticated USING (owner = auth.uid());
CREATE POLICY "pilotage : ajout par la propriétaire" ON pilotage_items
    FOR INSERT TO authenticated WITH CHECK (owner = auth.uid());
CREATE POLICY "pilotage : modification par la propriétaire" ON pilotage_items
    FOR UPDATE TO authenticated USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());
CREATE POLICY "pilotage : suppression par la propriétaire" ON pilotage_items
    FOR DELETE TO authenticated USING (owner = auth.uid());

-- Images et documents : espace de stockage privé (50 Mo max par fichier)
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('pilotage', 'pilotage', false, 52428800)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Chaque fichier est rangé dans un dossier au nom de sa propriétaire
DROP POLICY IF EXISTS "pilotage fichiers : lecture" ON storage.objects;
DROP POLICY IF EXISTS "pilotage fichiers : ajout" ON storage.objects;
DROP POLICY IF EXISTS "pilotage fichiers : modification" ON storage.objects;
DROP POLICY IF EXISTS "pilotage fichiers : suppression" ON storage.objects;

CREATE POLICY "pilotage fichiers : lecture" ON storage.objects
    FOR SELECT TO authenticated USING (bucket_id = 'pilotage' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pilotage fichiers : ajout" ON storage.objects
    FOR INSERT TO authenticated WITH CHECK (bucket_id = 'pilotage' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pilotage fichiers : modification" ON storage.objects
    FOR UPDATE TO authenticated USING (bucket_id = 'pilotage' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "pilotage fichiers : suppression" ON storage.objects
    FOR DELETE TO authenticated USING (bucket_id = 'pilotage' AND (storage.foldername(name))[1] = auth.uid()::text);
