-- =============================================================
-- The Muse Lab — Ménage & Réassort
-- À exécuter UNE FOIS dans Supabase : SQL Editor > New query > Run
-- =============================================================

-- Tâches (liste "menage" ou "checklist"), modifiables depuis le site
CREATE TABLE IF NOT EXISTS menage_items (
    id BIGSERIAL PRIMARY KEY,
    list TEXT NOT NULL CHECK (list IN ('menage', 'checklist')),
    label TEXT NOT NULL,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Tâches cochées (une ligne par tâche, par jour et par studio)
CREATE TABLE IF NOT EXISTS menage_checks (
    id BIGSERIAL PRIMARY KEY,
    item_id BIGINT NOT NULL REFERENCES menage_items(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    studio TEXT NOT NULL,
    done_by TEXT,
    done_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (item_id, day, studio)
);

-- Achats à prévoir (déclenchent un email à team@themuselab.fr)
CREATE TABLE IF NOT EXISTS menage_achats (
    id BIGSERIAL PRIMARY KEY,
    article TEXT NOT NULL,
    quantite TEXT,
    note TEXT,
    studio TEXT NOT NULL,
    demande_par TEXT,
    fait BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Accès public (même logique que l'appli fidélité)
ALTER TABLE menage_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE menage_checks ENABLE ROW LEVEL SECURITY;
ALTER TABLE menage_achats ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public all" ON menage_items FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all" ON menage_checks FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Public all" ON menage_achats FOR ALL USING (true) WITH CHECK (true);

-- Listes de départ (modifiables ensuite depuis le site)
INSERT INTO menage_items (list, label, position) VALUES
    ('menage', 'Nettoyage des toilettes (cuvette, lavabo, miroir)', 1),
    ('menage', 'Réapprovisionner papier toilette & savon', 2),
    ('menage', 'Aspirer et laver le sol du studio', 3),
    ('menage', 'Désinfecter les tapis et le matériel', 4),
    ('menage', 'Nettoyer les miroirs du studio', 5),
    ('menage', 'Vider les poubelles', 6),
    ('menage', 'Ranger les vestiaires', 7),
    ('menage', 'Essuyer l''accueil et les poignées de porte', 8),
    ('checklist', 'Toilettes', 1),
    ('checklist', 'Réassort bonbons', 2),
    ('checklist', 'Réassort eau', 3);
