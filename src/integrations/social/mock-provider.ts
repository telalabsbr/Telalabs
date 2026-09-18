import type { PublishInput, PublishResult, SocialProvider } from "@/domain/providers/social-provider";
import { ProviderNotConfiguredError } from "@/domain/providers/social-provider";
import { unknownProviderCapabilities, type ProviderCapabilities } from "@/domain/providers/capabilities";
import type { SocialPlatform } from "@/domain/social";

/** Adapter local explícito: nunca envia conteúdo a uma rede externa. */
export class MockSocialProvider implements SocialProvider {
  constructor(readonly platform: SocialPlatform) {}

  async connect(): Promise<{ authorizationUrl: string }> {
    throw new ProviderNotConfiguredError(this.platform);
  }

  async getCapabilities(): Promise<ProviderCapabilities> {
    return unknownProviderCapabilities;
  }

  async publish(_input: PublishInput): Promise<PublishResult> {
    throw new ProviderNotConfiguredError(this.platform);
  }

  async disconnect(): Promise<void> {
    return Promise.resolve();
  }
}
