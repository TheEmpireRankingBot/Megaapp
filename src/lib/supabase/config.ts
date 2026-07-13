export type SupabaseConfig = {
  url: string;
  key: string;
};

export function getSupabaseConfig(): SupabaseConfig | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  if (Boolean(url) !== Boolean(key)) {
    throw new Error(
      "Supabase Auth is partially configured. Set both NEXT_PUBLIC_SUPABASE_URL and a publishable/anon key, or neither for local mode.",
    );
  }
  return url && key ? { url, key } : null;
}

/** Auth is deliberately opt-in so local PGlite development stays zero-config. */
export function isSupabaseConfigured(): boolean {
  return getSupabaseConfig() !== null;
}
