import "server-only";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

function serviceRoleConfig() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseConfig.url || !serviceRoleKey) return null;
  return { url: supabaseConfig.url, serviceRoleKey };
}

export function createSupabaseAdminClient() {
  const config = serviceRoleConfig();
  if (!config) return null;

  return createClient<Database>(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Cliente restrito ao servidor para RPCs recém-migradas antes da próxima
 * sincronização completa de database.types.ts. Nunca exportar para código client.
 */
export function createUntypedSupabaseAdminClient() {
  const config = serviceRoleConfig();
  if (!config) return null;

  return createClient(config.url, config.serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
