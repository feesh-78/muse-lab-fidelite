// Connexion à Supabase (même projet que les autres outils The Muse Lab).
// La clé "anon" est publique : ce sont les règles de sécurité (RLS) de supabase-setup.sql
// qui garantissent que seules tes propres données sont lisibles.
export const SUPABASE_URL = 'https://nxqttyosjjirqtcvfkbk.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cXR0eW9zamppcnF0Y3Zma2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMjAxMzYsImV4cCI6MjA3NTc5NjEzNn0.2As8Nf9Itz0T__9X2QHAVxctOH4NO7kak6eiHRK3x88';

// Table et espace de stockage créés par supabase-setup.sql
export const TABLE = 'pilotage_items';
export const BUCKET = 'pilotage';
