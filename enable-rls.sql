-- Activer Row Level Security et politiques publiques

-- Activer RLS sur current_data
ALTER TABLE current_data ENABLE ROW LEVEL SECURITY;

-- Politiques pour current_data
CREATE POLICY "Allow public read access"
ON current_data FOR SELECT
USING (true);

CREATE POLICY "Allow public write access"
ON current_data FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete access"
ON current_data FOR DELETE
USING (true);

-- Activer RLS sur history_data
ALTER TABLE history_data ENABLE ROW LEVEL SECURITY;

-- Politiques pour history_data
CREATE POLICY "Allow public read access"
ON history_data FOR SELECT
USING (true);

CREATE POLICY "Allow public write access"
ON history_data FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow public delete access"
ON history_data FOR DELETE
USING (true);
