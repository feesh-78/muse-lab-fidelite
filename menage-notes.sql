-- =============================================================
-- The Muse Lab — Transmissions (notes entre les équipes)
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New snippet > Run
-- =============================================================

CREATE TABLE IF NOT EXISTS menage_notes (
    id BIGSERIAL PRIMARY KEY,
    day DATE NOT NULL,
    studio TEXT NOT NULL,
    author TEXT,
    text TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE menage_notes ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public all" ON menage_notes;
CREATE POLICY "Public all" ON menage_notes FOR ALL USING (true) WITH CHECK (true);
