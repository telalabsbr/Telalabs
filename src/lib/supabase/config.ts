const publicKey =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const supabaseConfig = {
  url: process.env.NEXT_PUBLIC_SUPABASE_URL,
  publicKey,
  // Alias mantido por compatibilidade enquanto os ambientes migram da chave anon.
  anonKey: publicKey,
};

export const isSupabaseConfigured = Boolean(supabaseConfig.url && supabaseConfig.publicKey);
