import type { PublishingSurface } from "./providers/capabilities";
import type { SocialPlatform } from "./social";

export const publicationStatuses = [
  "draft",
  "scheduled",
  "processing",
  "retrying",
  "verifying",
  "needs_action",
  "published",
  "failed",
  "cancelled",
] as const;
export type PublicationStatus = (typeof publicationStatuses)[number];
export type DestinationStatus = PublicationStatus;

export interface PublicationDestination {
  id: string;
  platform: SocialPlatform;
  status: DestinationStatus;
  connectionId?: string;
  surface?: PublishingSurface;
  title?: string;
  text: string;
  scheduledAt?: string;
  providerOptions?: Record<string, unknown>;
  attempts: number;
  lastErrorCode?: string;
  lastError?: string;
  nextAttemptAt?: string;
  externalId?: string;
  publishedAt?: string;
}

export interface Publication {
  id: string;
  workspaceId: string;
  baseText: string;
  mediaType: "image" | "video";
  mediaUrl?: string;
  status: PublicationStatus;
  scheduledAt?: string;
  createdAt: string;
  destinations: PublicationDestination[];
}
