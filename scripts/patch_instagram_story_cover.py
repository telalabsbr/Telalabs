from pathlib import Path

path = Path("src/integrations/social/instagram-adapter.ts")
text = path.read_text(encoding="utf-8")

def r(old: str, new: str):
    global text
    if old not in text:
        raise SystemExit("Trecho nao encontrado:\n" + old[:400])
    text = text.replace(old, new, 1)

r(
'''  accessTokenFromContext,
  issueMediaDeliveryUrl,
  loadRuntimePublicationContext,''',
'''  accessTokenFromContext,
  issueAttachedMediaDeliveryUrl,
  issueMediaDeliveryUrl,
  loadRuntimePublicationContext,'''
)
r('type PublishedMedia = { id?: string };', 'type PublishedMedia = { id?: string; permalink?: string };')
r('  mediaType: "IMAGE" | "REELS";', '  mediaType: "IMAGE" | "REELS" | "STORIES";')

r(
'''async function rememberPublishedMedia(args: {
  organizationId: string;
  postTargetId: string;
  mediaId: string;
  containerId?: string | null;
}) {''',
'''async function rememberPublishedMedia(args: {
  organizationId: string;
  postTargetId: string;
  mediaId: string;
  containerId?: string | null;
  permalink?: string | null;
}) {'''
)
r(
'''    metadata: {
      source_container_id: args.containerId ?? null,
      reconciled: true,
    },''',
'''    metadata: {
      source_container_id: args.containerId ?? null,
      reconciled: true,
      permalink: args.permalink ?? null,
    },'''
)

r(
'''  mediaId: string;
  previousMetadata: Json;
}) {''',
'''  mediaId: string;
  previousMetadata: Json;
  permalink?: string | null;
}) {'''
)
r(
'''      published_media_id: args.mediaId,
      published_at: new Date().toISOString(),''',
'''      published_media_id: args.mediaId,
      published_at: new Date().toISOString(),
      permalink: args.permalink ?? null,'''
)
r(
'''    metadata: {
      source_container_id: args.containerId,
    },''',
'''    metadata: {
      source_container_id: args.containerId,
      permalink: args.permalink ?? null,
    },'''
)

r('    params: { fields: "id" },', '    params: { fields: "id,permalink" },')

r(
'''function publishedIdFromMetadata(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata.published_media_id;
  return typeof value === "string" ? value : null;
}
''',
'''function publishedIdFromMetadata(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata.published_media_id;
  return typeof value === "string" ? value : null;
}

function permalinkFromMetadata(metadata: Json) {
  if (!metadata || typeof metadata !== "object" || Array.isArray(metadata)) return null;
  const value = metadata.permalink;
  return typeof value === "string" && value.startsWith("https://") ? value : null;
}

function surfaceFromConfig(config: Json) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return "";
  return typeof config.surface === "string" ? config.surface.toLowerCase() : "";
}
'''
)

r(
'''    const isVideo = context.media.mime_type.startsWith("video/");
    let container = await existingContainer(job.postTargetId);''',
'''    const isVideo = context.media.mime_type.startsWith("video/");
    const isStory = surfaceFromConfig(context.target.provider_config) === "story";
    let container = await existingContainer(job.postTargetId);'''
)

r(
'''      return {
        outcome: "SUCCEEDED",
        providerRequestId: mediaId ?? container.provider_asset_id,
      };
    }

    if (!container) {
      const deliveryUrl = await issueMediaDeliveryUrl(context);
      const create = await metaGraphRequest<ContainerCreated>({
        path: `/${encodeURIComponent(context.connection.provider_account_id)}/media`,
        method: "POST",
        accessToken,
        params: isVideo
          ? {
              media_type: "REELS",
              video_url: deliveryUrl,
              caption: context.target.caption,
              share_to_feed: true,
            }
          : {
              image_url: deliveryUrl,
              caption: context.target.caption,
            },
      });''',
'''      return {
        outcome: "SUCCEEDED",
        providerRequestId: mediaId ?? container.provider_asset_id,
        publicUrl: permalinkFromMetadata(container.metadata),
      };
    }

    if (!container) {
      const deliveryUrl = await issueMediaDeliveryUrl(context);
      let coverUrl: string | null = null;
      if (!isStory && isVideo && context.cover_media?.mime_type === "image/jpeg" && context.cover_media.processing_status === "READY") {
        coverUrl = await issueAttachedMediaDeliveryUrl(context, context.cover_media);
      }

      const createParams: Record<string, string | boolean> = isStory
        ? isVideo
          ? { media_type: "STORIES", video_url: deliveryUrl }
          : { media_type: "STORIES", image_url: deliveryUrl }
        : isVideo
          ? {
              media_type: "REELS",
              video_url: deliveryUrl,
              caption: context.target.caption,
              share_to_feed: true,
              ...(coverUrl ? { cover_url: coverUrl } : {}),
            }
          : {
              image_url: deliveryUrl,
              caption: context.target.caption,
            };

      const create = await metaGraphRequest<ContainerCreated>({
        path: `/${encodeURIComponent(context.connection.provider_account_id)}/media`,
        method: "POST",
        accessToken,
        params: createParams,
      });'''
)

r(
'''          mediaType: isVideo ? "REELS" : "IMAGE",''',
'''          mediaType: isStory ? "STORIES" : isVideo ? "REELS" : "IMAGE",'''
)

r(
'''    try {
      await markContainerPublished({
        providerAssetRowId: container.id,
        organizationId: job.organizationId,
        postTargetId: job.postTargetId,
        containerId: container.provider_asset_id,
        mediaId: publish.data.id,
        previousMetadata: container.metadata,
      });''',
'''    const mediaDetails = await publishedMedia(publish.data.id, accessToken);
    const permalink = mediaDetails.ok ? mediaDetails.data?.permalink ?? null : null;

    try {
      await markContainerPublished({
        providerAssetRowId: container.id,
        organizationId: job.organizationId,
        postTargetId: job.postTargetId,
        containerId: container.provider_asset_id,
        mediaId: publish.data.id,
        previousMetadata: container.metadata,
        permalink,
      });'''
)
r(
'''    return {
      outcome: "SUCCEEDED",
      providerRequestId: publish.data.id,
    };''',
'''    return {
      outcome: "SUCCEEDED",
      providerRequestId: publish.data.id,
      publicUrl: permalink,
    };'''
)

# Reconcile: already-published container should surface saved permalink.
old = '''      return {
        outcome: "SUCCEEDED",
        providerRequestId: mediaId ?? container.provider_asset_id,
      };
    }

    const unknownAttempt = await latestUnknownPublishAttempt(job.postTargetId);'''
new = '''      return {
        outcome: "SUCCEEDED",
        providerRequestId: mediaId ?? container.provider_asset_id,
        publicUrl: permalinkFromMetadata(container.metadata),
      };
    }

    const unknownAttempt = await latestUnknownPublishAttempt(job.postTargetId);'''
r(old, new)

r(
'''            mediaId: providerObjectId,
            previousMetadata: container.metadata,
          });''',
'''            mediaId: providerObjectId,
            previousMetadata: container.metadata,
            permalink: mediaResponse.data.permalink ?? null,
          });'''
)
r(
'''            mediaId: providerObjectId,
          });''',
'''            mediaId: providerObjectId,
            permalink: mediaResponse.data.permalink ?? null,
          });'''
)
r(
'''      return {
        outcome: "SUCCEEDED",
        providerRequestId: providerObjectId,
      };''',
'''      return {
        outcome: "SUCCEEDED",
        providerRequestId: providerObjectId,
        publicUrl: mediaResponse.data.permalink ?? null,
      };'''
)

# Story reconciliation may need to persist a recovered container with the right media type.
r(
'''          mediaType: context.media?.mime_type.startsWith("video/") ? "REELS" : "IMAGE",''',
'''          mediaType: surfaceFromConfig(context.target.provider_config) === "story"
            ? "STORIES"
            : context.media?.mime_type.startsWith("video/") ? "REELS" : "IMAGE",'''
)

path.write_text(text, encoding="utf-8")
print("Instagram story/cover/permalink patch applied")
