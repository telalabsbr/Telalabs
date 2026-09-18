export const socialPlatforms = ["instagram", "facebook", "tiktok", "youtube", "linkedin", "x", "kwai"] as const;
export type SocialPlatform = (typeof socialPlatforms)[number];
export type ConnectionStatus = "disconnected" | "connected" | "expired" | "error";

export const platformLabels: Record<SocialPlatform, string> = {
  instagram: "Instagram", facebook: "Facebook", tiktok: "TikTok",
  youtube: "YouTube", linkedin: "LinkedIn", x: "X", kwai: "Kwai",
};
