import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./config";

export function createSupabaseAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfig.url || !serviceRoleKey) return null;

  return createClient(supabaseConfig.url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
