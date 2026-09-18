import type { SocialPlatform } from "../social";

export interface PublishInput { idempotencyKey: string; text: string; title?: string; mediaUrl?: string; scheduledAt?: Date; }
export interface PublishResult { externalId: string; publishedAt: Date; permalink?: string; }
export interface SocialProvider {
  readonly platform: SocialPlatform;
  connect(workspaceId: string): Promise<{ authorizationUrl: string }>;
  publish(input: PublishInput): Promise<PublishResult>;
  disconnect(workspaceId: string): Promise<void>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(platform: SocialPlatform) { super(`O provider ${platform} ainda não está configurado.`); this.name = "ProviderNotConfiguredError"; }
}
