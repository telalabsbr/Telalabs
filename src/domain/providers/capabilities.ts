export const publishingSurfaces = ["feed", "reel", "story", "short", "video"] as const;
export type PublishingSurface = (typeof publishingSurfaces)[number];

export const publicationOptions = [
  "caption",
  "title",
  "description",
  "hashtags",
  "location",
  "privacy",
  "comments",
  "duet",
  "stitch",
  "shareToFeed",
  "coverFrame",
  "customThumbnail",
  "altText",
  "musicLibrary",
  "autoMusic",
  "brandedContent",
] as const;

export type PublicationOption = (typeof publicationOptions)[number];
export type CapabilityAvailability = "supported" | "unsupported" | "conditional" | "unknown";

export interface ProviderCapabilities {
  surfaces: Partial<Record<PublishingSurface, CapabilityAvailability>>;
  options: Partial<Record<PublicationOption, CapabilityAvailability>>;
  limits?: {
    maxCaptionCharacters?: number;
    maxTitleCharacters?: number;
    maxVideoDurationSeconds?: number;
  };
  /**
   * Capacidades podem variar por tipo de conta, permissões concedidas,
   * região e respostas da própria API. Providers reais devem resolver
   * estes valores no momento da publicação/conexão sempre que possível.
   */
  notes?: string[];
}

export const unknownProviderCapabilities: ProviderCapabilities = {
  surfaces: {},
  options: {},
  notes: ["Capacidades ainda não verificadas para esta conexão."],
};
