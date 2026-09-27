import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getInstagramOAuthConfig } from "@/lib/oauth/instagram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function present(name: string) {
  return Boolean(process.env[name]);
}

function encryptionKeyStatus() {
  const value = process.env.OAUTH_TOKEN_ENCRYPTION_KEY;
  if (!value) return { present: false, valid32BytesBase64: false };

  try {
    return {
      present: true,
      valid32BytesBase64: Buffer.from(value, "base64").length === 32,
    };
  } catch {
    return { present: true, valid32BytesBase64: false };
  }
}

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const admin = createSupabaseAdminClient();
  const instagram = getInstagramOAuthConfig();

  return NextResponse.json(
    {
      safe: true,
      environment: {
        vercelEnv: process.env.VERCEL_ENV ?? null,
        nodeEnv: process.env.NODE_ENV ?? null,
      },
      variables: {
        NEXT_PUBLIC_SUPABASE_URL: present("NEXT_PUBLIC_SUPABASE_URL"),
        NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: present("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
        NEXT_PUBLIC_SUPABASE_ANON_KEY: present("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
        SUPABASE_SERVICE_ROLE_KEY: present("SUPABASE_SERVICE_ROLE_KEY"),
        OAUTH_TOKEN_ENCRYPTION_KEY: encryptionKeyStatus(),
        INSTAGRAM_CLIENT_ID: present("INSTAGRAM_CLIENT_ID"),
        INSTAGRAM_CLIENT_SECRET: present("INSTAGRAM_CLIENT_SECRET"),
        APP_PUBLIC_URL: present("APP_PUBLIC_URL"),
        INSTAGRAM_OAUTH_SCOPES: present("INSTAGRAM_OAUTH_SCOPES"),
      },
      clients: {
        supabaseServer: Boolean(supabase),
        supabaseAdmin: Boolean(admin),
        instagramOAuth: Boolean(instagram),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store, max-age=0",
      },
    },
  );
}
