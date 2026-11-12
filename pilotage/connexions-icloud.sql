-- =============================================================
-- pilotage. — connexions iPhone : agenda iCloud et rappels
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New query > coller > Run
-- (peut être relancé sans risque)
-- =============================================================

-- ---------- Agenda iCloud ----------
-- Une ligne par compte : l'identifiant Apple, le mot de passe d'application CHIFFRÉ par le serveur Vercel
-- (clé ICLOUD_KEY, jamais dans le navigateur), la liste des agendas iCloud et la correspondance avec les calendriers de l'outil.
CREATE TABLE IF NOT EXISTS public.pilotage_icloud (
    owner UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    apple_id TEXT NOT NULL,
    secret TEXT NOT NULL,
    home_url TEXT NOT NULL,
    calendars JSONB NOT NULL DEFAULT '[]',
    mapping JSONB NOT NULL DEFAULT '{}',
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.pilotage_icloud ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilotage_icloud_owner" ON public.pilotage_icloud;
CREATE POLICY "pilotage_icloud_owner" ON public.pilotage_icloud
    FOR ALL TO authenticated USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

-- ---------- Rappels (via un raccourci iPhone) ----------
-- Le raccourci envoie ses rappels à une adresse personnelle qui contient une clé secrète.
-- Seule l'empreinte de la clé est gardée ici.
CREATE TABLE IF NOT EXISTS public.pilotage_rappels_cles (
    owner UUID PRIMARY KEY DEFAULT auth.uid() REFERENCES auth.users(id) ON DELETE CASCADE,
    cle_hash TEXT NOT NULL UNIQUE,
    derniere_synchro TIMESTAMPTZ
);
ALTER TABLE public.pilotage_rappels_cles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "pilotage_rappels_cles_owner" ON public.pilotage_rappels_cles;
CREATE POLICY "pilotage_rappels_cles_owner" ON public.pilotage_rappels_cles
    FOR ALL TO authenticated USING (owner = auth.uid()) WITH CHECK (owner = auth.uid());

-- Reçoit TOUS les rappels non terminés de l'iPhone : [{ "titre", "liste", "echeance" (AAAA-MM-JJ ou vide) }]
-- · un rappel inconnu devient une tâche (rangée dans le projet dont le nom ressemble à sa liste) ;
-- · une tâche venue des rappels qui n'est plus envoyée a été cochée (ou supprimée) sur l'iPhone : elle est cochée ici ;
-- · une tâche cochée dans l'outil alors que le rappel est encore ouvert est renvoyée dans « a_cocher ».
CREATE OR REPLACE FUNCTION public.pilotage_rappels_sync(p_cle TEXT, p_rappels JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
    v_owner UUID;
    v_today TEXT := to_char((now() AT TIME ZONE 'Europe/Paris')::date, 'YYYY-MM-DD');
    v_listes TEXT[];
    r JSONB;
    v_titre TEXT;
    v_liste TEXT;
    v_due TEXT;
    v_id TEXT;
    v_projet TEXT;
    v_data JSONB;
    v_ids TEXT[] := '{}';
    v_crees INT := 0;
    v_maj INT := 0;
    v_finis INT := 0;
    v_a_cocher JSONB := '[]';
BEGIN
    SELECT owner INTO v_owner FROM pilotage_rappels_cles WHERE cle_hash = encode(digest(coalesce(p_cle, ''), 'sha256'), 'hex');
    IF v_owner IS NULL THEN
        RAISE EXCEPTION 'cle inconnue' USING ERRCODE = '28000';
    END IF;
    IF p_rappels IS NULL OR jsonb_typeof(p_rappels) <> 'array' THEN
        RAISE EXCEPTION 'format attendu : une liste de rappels' USING ERRCODE = '22023';
    END IF;

    -- Listes à importer, choisies dans l'outil (vide = toutes)
    SELECT array_agg(lower(btrim(x))) INTO v_listes
    FROM pilotage_items p, jsonb_array_elements_text(coalesce(p.data->'rappelsListes', '[]')) x
    WHERE p.owner = v_owner AND p.id = 'profile' AND btrim(x) <> '';

    FOR r IN SELECT value FROM jsonb_array_elements(p_rappels) LOOP
        CONTINUE WHEN jsonb_typeof(r) <> 'object';
        v_titre := btrim(coalesce(r->>'titre', ''));
        v_liste := btrim(coalesce(r->>'liste', ''));
        CONTINUE WHEN v_titre = '';
        CONTINUE WHEN v_listes IS NOT NULL AND NOT (lower(v_liste) = ANY (v_listes));
        v_due := substring(coalesce(r->>'echeance', '') FROM '\d{4}-\d{2}-\d{2}');
        v_id := 'r-' || md5(lower(v_liste) || '|' || lower(v_titre));
        v_ids := array_append(v_ids, v_id);

        SELECT data INTO v_data FROM pilotage_items WHERE owner = v_owner AND id = v_id;
        IF v_data IS NULL THEN
            -- Projet dont le nom contient le nom de la liste (ou l'inverse)
            SELECT id INTO v_projet FROM pilotage_items
            WHERE owner = v_owner AND kind = 'project' AND v_liste <> ''
              AND coalesce(data->>'status', '') NOT IN ('archive', 'termine')
              AND (lower(coalesce(data->>'remindersList', '')) = lower(v_liste)
                   OR strpos(lower(data->>'name'), lower(v_liste)) > 0
                   OR strpos(lower(v_liste), lower(data->>'name')) > 0)
            ORDER BY (lower(coalesce(data->>'remindersList', '')) = lower(v_liste)) DESC, (data->>'order')::numeric NULLS LAST
            LIMIT 1;
            INSERT INTO pilotage_items (owner, id, kind, data, updated_at) VALUES (v_owner, v_id, 'task', jsonb_strip_nulls(jsonb_build_object(
                'title', v_titre, 'due', coalesce(v_due, v_today), 'done', false, 'order', extract(epoch FROM now()) / 1e10,
                'projectId', v_projet, 'brand', CASE WHEN v_projet IS NULL THEN 'perso' END,
                'source', 'rappels', 'liste', v_liste, 'createdAt', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'))), now());
            v_crees := v_crees + 1;
        ELSIF coalesce((v_data->>'done')::boolean, false) AND v_data->>'doneBy' IS DISTINCT FROM 'rappels' THEN
            -- Cochée dans l'outil : le raccourci cochera le rappel
            v_a_cocher := v_a_cocher || jsonb_build_object('titre', v_titre, 'liste', v_liste);
        ELSE
            -- Rappel toujours ouvert : on reprend son titre et sa date (et on rouvre la tâche si elle avait été cochée par une synchro)
            UPDATE pilotage_items SET data = (data - 'doneBy' - 'doneOn') || jsonb_build_object('title', v_titre, 'done', false)
                    || CASE WHEN v_due IS NOT NULL THEN jsonb_build_object('due', v_due) ELSE '{}'::jsonb END,
                updated_at = now()
            WHERE owner = v_owner AND id = v_id
              AND (data->>'title' IS DISTINCT FROM v_titre OR coalesce((data->>'done')::boolean, false)
                   OR (v_due IS NOT NULL AND data->>'due' IS DISTINCT FROM v_due));
            IF FOUND THEN v_maj := v_maj + 1; END IF;
        END IF;
    END LOOP;

    -- Rappels disparus de l'iPhone (cochés ou supprimés) : la tâche est cochée
    UPDATE pilotage_items SET data = data || jsonb_build_object('done', true, 'doneOn', v_today, 'doneBy', 'rappels'), updated_at = now()
    WHERE owner = v_owner AND kind = 'task' AND data->>'source' = 'rappels'
      AND NOT coalesce((data->>'done')::boolean, false)
      AND NOT (id = ANY (v_ids))
      AND (v_listes IS NULL OR lower(coalesce(data->>'liste', '')) = ANY (v_listes));
    GET DIAGNOSTICS v_finis = ROW_COUNT;

    UPDATE pilotage_rappels_cles SET derniere_synchro = now() WHERE owner = v_owner;
    RETURN jsonb_build_object('recus', jsonb_array_length(p_rappels), 'crees', v_crees, 'mis_a_jour', v_maj, 'termines', v_finis, 'a_cocher', v_a_cocher);
END $$;
REVOKE ALL ON FUNCTION public.pilotage_rappels_sync(TEXT, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.pilotage_rappels_sync(TEXT, JSONB) TO anon, authenticated;
