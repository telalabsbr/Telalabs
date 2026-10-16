import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createUntypedSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/oauth/token-crypto";
import { getMetaGraphBaseUrl } from "@/lib/oauth/meta";

export const runtime = "nodejs";

type AudioType = "music" | "original_sound";

type MetaAudioItem = {
  id?: string;
  audio_id?: string;
  title?: string | null;
  audio_type?: string | null;
  duration_in_ms?: number | null;
  duration?: number | null;
  display_artist?: string | null;
  ig_artist?: string | null;
  cover_artwork_thumbnail_url?: string | null;
  cover_artwork_thumbnail_uri?: string | null;
  cover_artwork_url?: string | null;
  download_url?: string | null;
  preview_url?: string | null;
  ig_username?: string | null;
  creator_username?: string | null;
  profile_picture_url?: string | null;
  on_platform_audio_preview_link?: string | null;
};

type MetaAudioResponse = {
  audio?: MetaAudioItem[];
  data?: MetaAudioItem[];
  error?: {
    message?: string;
    code?: number;
    error_subcode?: number;
    type?: string;
  };
};

function normalizeAudioType(value: string | null): AudioType {
  return value === "original_sound" ? "original_sound" : "music";
}

function metadataObject(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
}

async function requestMetaAudio(args: {
  accessToken: string;
  igUserId: string;
  audioType: AudioType;
  query: string;
  searchParam: "search_query" | "q";
}) {
  const url = new URL(`${getMetaGraphBaseUrl()}/ig_audio`);
  url.searchParams.set("ig_user_id", args.igUserId);
  url.searchParams.set("audio_type", args.audioType);
  if (args.query) url.searchParams.set(args.searchParam, args.query);

  const response = await fetch(url, {
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${args.accessToken}`,
    },
    cache: "no-store",
  });
  const body = await response.json().catch(() => ({})) as MetaAudioResponse;
  return { response, body };
}

export async function GET(request: NextRequest) {
  const brandId = request.nextUrl.searchParams.get("brand_id");
  const connectionId = request.nextUrl.searchParams.get("connection_id");
  const audioType = normalizeAudioType(request.nextUrl.searchParams.get("audio_type"));
  const query = (request.nextUrl.searchParams.get("q") ?? "").trim().slice(0, 120);

  if (!brandId || !connectionId) {
    return NextResponse.json({ error: "brand_and_connection_required" }, { status: 400 });
  }

  const supabase = await createSupabaseServerClient();
  const admin = createUntypedSupabaseAdminClient();
  if (!supabase || !admin) {
    return NextResponse.json({ error: "server_not_configured" }, { status: 500 });
  }

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 });
  }

  const { data: brand, error: brandError } = await supabase
    .from("brands")
    .select("id,organization_id")
    .eq("id", brandId)
    .eq("status", "ACTIVE")
    .is("deleted_at", null)
    .single();

  if (brandError || !brand) {
    return NextResponse.json({ error: "brand_not_accessible" }, { status: 403 });
  }

  const { data: connection, error: connectionError } = await supabase
    .from("social_connections")
    .select("id,provider,brand_id,organization_id,connection_status,metadata")
    .eq("id", connectionId)
    .eq("provider", "instagram")
    .eq("brand_id", brand.id)
    .eq("organization_id", brand.organization_id)
    .single();

  if (connectionError || !connection || connection.connection_status !== "CONNECTED") {
    return NextResponse.json({ error: "instagram_connection_not_accessible" }, { status: 404 });
  }

  const metadata = metadataObject(connection.metadata);
  const metaAssetId = typeof metadata.meta_asset_id === "string" ? metadata.meta_asset_id : null;
  if (metadata.meta_advanced_enabled !== true || !metaAssetId) {
    return NextResponse.json({
      error: "meta_advanced_required",
      requires_meta_authorization: true,
    }, { status: 409 });
  }

  const credentialResult = await admin.rpc("server_get_meta_asset_audio_credential", {
    p_meta_asset_id: metaAssetId,
  });
  const credential = Array.isArray(credentialResult.data)
    ? credentialResult.data[0]
    : credentialResult.data;

  if (credentialResult.error || !credential?.user_access_token_ciphertext) {
    return NextResponse.json({
      error: "meta_reauthorization_required",
      requires_meta_reauthorization: true,
    }, { status: 409 });
  }

  if (credential.user_expires_at && new Date(String(credential.user_expires_at)).getTime() <= Date.now()) {
    return NextResponse.json({
      error: "meta_reauthorization_required",
      requires_meta_reauthorization: true,
    }, { status: 409 });
  }

  const igUserId = typeof credential.instagram_business_account_id === "string"
    ? credential.instagram_business_account_id
    : null;
  if (!igUserId) {
    return NextResponse.json({ error: "instagram_meta_link_missing" }, { status: 409 });
  }

  const userAccessToken = await decryptToken(String(credential.user_access_token_ciphertext));

  let result = await requestMetaAudio({
    accessToken: userAccessToken,
    igUserId,
    audioType,
    query,
    searchParam: "search_query",
  });

  // Some Meta rollouts exposed the free-text parameter as q before the current
  // docs converged on search_query. Retry only a parameter-validation failure.
  if (
    query
    && !result.response.ok
    && result.body.error?.code === 100
    && /search_query|parameter|param/i.test(result.body.error?.message ?? "")
  ) {
    result = await requestMetaAudio({
      accessToken: userAccessToken,
      igUserId,
      audioType,
      query,
      searchParam: "q",
    });
  }

  if (!result.response.ok || result.body.error) {
    const metaError = result.body.error;
    console.warn("instagram_audio_search_failed", {
      status: result.response.status,
      code: metaError?.code ?? null,
      subcode: metaError?.error_subcode ?? null,
      type: metaError?.type ?? null,
    });
    return NextResponse.json({
      error: "instagram_audio_search_failed",
      message: "O Instagram não conseguiu carregar o catálogo de áudio agora.",
    }, { status: result.response.status >= 400 && result.response.status < 500 ? 400 : 502 });
  }

  const audio = (result.body.audio ?? result.body.data ?? []).map(item => {
    const audioId = item.audio_id ?? item.id ?? "";
    return {
      audio_id: audioId,
      title: item.title ?? "Áudio do Instagram",
      audio_type: item.audio_type === "original_sound" ? "original_sound" : audioType,
      duration_in_ms: item.duration_in_ms ?? item.duration ?? null,
      display_artist: item.display_artist ?? item.ig_artist ?? null,
      cover_artwork_thumbnail_url: item.cover_artwork_thumbnail_uri ?? item.cover_artwork_thumbnail_url ?? item.cover_artwork_url ?? null,
      download_url: item.download_url ?? item.preview_url ?? null,
      ig_username: item.ig_username ?? item.creator_username ?? null,
      profile_picture_url: item.profile_picture_url ?? null,
      on_platform_audio_preview_link: item.on_platform_audio_preview_link ?? null,
    };
  }).filter(item => !!item.audio_id);

  return NextResponse.json({
    audio,
    audio_type: audioType,
    query,
    preview_supported: false,
  });
}
