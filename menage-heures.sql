-- =============================================================
-- The Muse Lab — Heures de ménage (Kalie, Valériane…)
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New snippet > Run
-- =============================================================

CREATE TABLE IF NOT EXISTS menage_heures (
    id BIGSERIAL PRIMARY KEY,
    day DATE NOT NULL,
    studio TEXT NOT NULL,
    person TEXT NOT NULL,
    hours NUMERIC(4, 2) NOT NULL CHECK (hours > 0 AND hours <= 24),
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE menage_heures ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public all" ON menage_heures;
CREATE POLICY "Public all" ON menage_heures FOR ALL USING (true) WITH CHECK (true);
