import { createBrowserClient } from "@supabase/ssr";
import { supabaseConfig } from "./config";

export function createSupabaseBrowserClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) return null;
  return createBrowserClient(supabaseConfig.url, supabaseConfig.anonKey);
}
