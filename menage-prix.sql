-- =============================================================
-- The Muse Lab — Prix des achats de réassort
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New snippet > Run
-- (peut être relancé sans risque)
-- =============================================================

ALTER TABLE menage_achats ADD COLUMN IF NOT EXISTS prix NUMERIC(8, 2) CHECK (prix >= 0);
