const url = import.meta.env.VITE_SUPABASE_URL;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!url || !anon) {
  throw new Error(
    'Supabase env mancante. Copia .env.example in .env.local e compila VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.',
  );
}

export const env = {
  supabaseUrl: url,
  supabaseAnonKey: anon,
} as const;
