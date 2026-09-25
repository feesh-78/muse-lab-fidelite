// Configuration Supabase
const SUPABASE_URL = 'https://nxqttyosjjirqtcvfkbk.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54cXR0eW9zamppcnF0Y3Zma2JrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjAyMjAxMzYsImV4cCI6MjA3NTc5NjEzNn0.2As8Nf9Itz0T__9X2QHAVxctOH4NO7kak6eiHRK3x88';

// Initialiser le client Supabase
// "var" (et non "const") : la librairie Supabase déclare déjà une variable globale "supabase"
var supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
