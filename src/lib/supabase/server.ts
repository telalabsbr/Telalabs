import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "./database.types";
import { supabaseConfig } from "./config";

export async function createSupabaseServerClient() {
  if (!supabaseConfig.url || !supabaseConfig.publicKey) return null;

  const cookieStore = await cookies();

  return createServerClient<Database>(
    supabaseConfig.url,
    supabaseConfig.publicKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options);
            });
          } catch {
            // Server Components não podem gravar cookies.
            // O middleware mantém a sessão atualizada para esses casos.
          }
        },
      },
    },
  );
}
