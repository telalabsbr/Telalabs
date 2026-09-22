import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

export function createSupabaseBrowserClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) return null;
  return createBrowserClient<Database>(supabaseConfig.url, supabaseConfig.anonKey);
}
