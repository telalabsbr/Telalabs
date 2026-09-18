import type { PublishingSurface, ProviderCapabilities } from "./capabilities";
import type { SocialPlatform } from "../social";

export interface PublishInput {
  connectionId: string;
  idempotencyKey: string;
  surface?: PublishingSurface;
  text: string;
  title?: string;
  mediaUrl?: string;
  scheduledAt?: Date;
  /**
   * Opções específicas da plataforma (privacidade, comentários, capa etc.).
   * Devem ser validadas pelo provider contra getCapabilities() antes do envio.
   */
  providerOptions?: Record<string, unknown>;
}

export interface PublishResult {
  externalId: string;
  publishedAt: Date;
  permalink?: string;
}

export interface SocialProvider {
  readonly platform: SocialPlatform;
  connect(workspaceId: string): Promise<{ authorizationUrl: string }>;
  getCapabilities(connectionId?: string): Promise<ProviderCapabilities>;
  publish(input: PublishInput): Promise<PublishResult>;
  disconnect(connectionId: string): Promise<void>;
}

export class ProviderNotConfiguredError extends Error {
  constructor(platform: SocialPlatform) {
    super(`O provider ${platform} ainda não está configurado.`);
    this.name = "ProviderNotConfiguredError";
  }
}
