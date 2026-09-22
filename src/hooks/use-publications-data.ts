"use client";

import { useCallback, useEffect, useState } from "react";
import { publications as demoPublications } from "@/data/mock";
import type { Publication, PublicationDestination, PublicationStatus } from "@/domain/publication";
import { socialPlatforms, type SocialPlatform } from "@/domain/social";
import { useTenantData } from "@/components/tenant-provider";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

function isPlatform(value: string): value is SocialPlatform {
  return (socialPlatforms as readonly string[]).includes(value);
}

function mapTargetState(state: string): PublicationStatus {
  if (state === "PUBLISHED") return "published";
  if (state === "FAILED_FINAL" || state === "NEEDS_ACTION" || state === "UNKNOWN") return "failed";
  if (state === "CANCELLED") return "cancelled";
  if (state === "DRAFT") return "draft";
  if (["PUBLISHING","PROCESSING","PREPARING","STAGED","VALIDATING","RETRY_WAIT"].includes(state)) return "processing";
  return "scheduled";
}

function aggregateStatus(destinations: PublicationDestination[]): PublicationStatus {
  if (!destinations.length) return "draft";
  if (destinations.some(item => item.status === "failed")) return "failed";
  if (destinations.every(item => item.status === "published")) return "published";
  if (destinations.some(item => item.status === "processing")) return "processing";
  if (destinations.some(item => item.status === "scheduled")) return "scheduled";
  if (destinations.every(item => item.status === "cancelled")) return "cancelled";
  return "draft";
}

function mediaTypeFromIntent(intent: string): "image" | "video" {
  return intent === "IMAGE" || intent === "CAROUSEL" ? "image" : "video";
}

export function usePublicationsData() {
  const tenant = useTenantData();
  const [publications, setPublications] = useState<Publication[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const refresh = useCallback(async () => {
    setError("");

    if (tenant.loading) {
      setLoading(true);
      return;
    }

    if (tenant.source !== "supabase" || !tenant.organization) {
      setPublications(tenant.source === "demo" ? demoPublications : []);
      setLoading(false);
      return;
    }

    const client = createSupabaseBrowserClient();
    if (!client) {
      setPublications([]);
      setError("Supabase não configurado neste ambiente.");
      setLoading(false);
      return;
    }

    setLoading(true);

    const postsResult = await client
      .from("posts")
      .select("id,organization_id,brand_id,internal_title,base_caption,status,content_intent,created_at,updated_at")
      .eq("organization_id", tenant.organization.id)
      .eq("brand_id", tenant.activeBrand.id)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .limit(300);

    if (postsResult.error) {
      setError(postsResult.error.message);
      setPublications([]);
      setLoading(false);
      return;
    }

    const posts = postsResult.data ?? [];
    const postIds = posts.map(post => post.id);
    if (!postIds.length) {
      setPublications([]);
      setLoading(false);
      return;
    }

    const targetsResult = await client
      .from("post_targets")
      .select("id,post_id,social_connection_id,provider,state,scheduled_at,published_at,caption_override,title_override,created_at,updated_at")
      .eq("organization_id", tenant.organization.id)
      .in("post_id", postIds)
      .order("scheduled_at", { ascending: true });

    if (targetsResult.error) {
      setError(targetsResult.error.message);
      setPublications([]);
      setLoading(false);
      return;
    }

    const targets = targetsResult.data ?? [];
    const targetIds = targets.map(target => target.id);

    const attemptsResult = targetIds.length
      ? await client
          .from("publication_attempts")
          .select("post_target_id,attempt_no,error_code,error_message_safe,outcome,started_at")
          .eq("organization_id", tenant.organization.id)
          .in("post_target_id", targetIds)
          .order("started_at", { ascending: false })
      : { data: [], error: null };

    if (attemptsResult.error) setError(attemptsResult.error.message);

    const attemptsByTarget = new Map<string, Array<{
      attempt_no: number;
      error_code: string | null;
      error_message_safe: string | null;
      outcome: string;
      started_at: string;
    }>>();

    for (const attempt of attemptsResult.data ?? []) {
      const list = attemptsByTarget.get(attempt.post_target_id) ?? [];
      list.push(attempt);
      attemptsByTarget.set(attempt.post_target_id, list);
    }

    const targetsByPost = new Map<string, PublicationDestination[]>();
    for (const target of targets) {
      if (!isPlatform(target.provider)) continue;
      const attempts = attemptsByTarget.get(target.id) ?? [];
      const lastAttempt = attempts[0];
      const destination: PublicationDestination = {
        id: target.id,
        platform: target.provider,
        status: mapTargetState(target.state),
        connectionId: target.social_connection_id,
        title: target.title_override ?? undefined,
        text: target.caption_override ?? "",
        scheduledAt: target.scheduled_at,
        attempts: attempts.length ? Math.max(...attempts.map(item => item.attempt_no)) : 0,
        lastErrorCode: lastAttempt?.error_code ?? undefined,
        lastError: lastAttempt?.error_message_safe ?? undefined,
        publishedAt: target.published_at ?? undefined,
      };
      const list = targetsByPost.get(target.post_id) ?? [];
      list.push(destination);
      targetsByPost.set(target.post_id, list);
    }

    const mapped: Publication[] = posts.map(post => {
      const destinations = targetsByPost.get(post.id) ?? [];
      const scheduledTimes = destinations.map(item => item.scheduledAt).filter(Boolean) as string[];
      return {
        id: post.id,
        workspaceId: post.brand_id,
        baseText: post.base_caption ?? post.internal_title,
        mediaType: mediaTypeFromIntent(post.content_intent),
        status: aggregateStatus(destinations),
        scheduledAt: scheduledTimes.sort()[0],
        createdAt: post.created_at,
        destinations: destinations.map(destination => ({
          ...destination,
          text: destination.text || post.base_caption || post.internal_title,
        })),
      };
    });

    setPublications(mapped);
    setLoading(false);
  }, [tenant.loading, tenant.source, tenant.organization, tenant.activeBrand.id]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  return { publications, loading, error, refresh, source: tenant.source };
}
