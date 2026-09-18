import type { Publication } from "@/domain/publication";
import type { ConnectionStatus, SocialPlatform } from "@/domain/social";

export const workspace = { id: "ws_demo", name: "Estúdio Aurora", initials: "EA" };
export const connections: { platform: SocialPlatform; status: ConnectionStatus; handle?: string }[] = [
  { platform: "instagram", status: "connected", handle: "@estudioaurora" },
  { platform: "facebook", status: "connected", handle: "Estúdio Aurora" },
  { platform: "tiktok", status: "disconnected" },
  { platform: "youtube", status: "expired", handle: "Aurora Criativa" },
  { platform: "linkedin", status: "disconnected" },
  { platform: "x", status: "error", handle: "@aurorastudio" },
  { platform: "kwai", status: "disconnected" },
];
export const publications: Publication[] = [
  { id: "pub_1", workspaceId: workspace.id, baseText: "Bastidores da nossa nova identidade visual.", mediaType: "video", status: "scheduled", scheduledAt: "2026-09-18T18:30:00Z", createdAt: "2026-09-16T12:00:00Z", destinations: [
    { id: "d1", platform: "instagram", status: "scheduled", text: "Por trás de cada detalhe ✦ #design", attempts: 0 },
    { id: "d2", platform: "facebook", status: "scheduled", text: "Conheça os bastidores do projeto.", attempts: 0 },
  ]},
  { id: "pub_2", workspaceId: workspace.id, baseText: "Três dicas para organizar seu calendário criativo.", mediaType: "image", status: "published", createdAt: "2026-09-15T14:00:00Z", destinations: [
    { id: "d3", platform: "instagram", status: "published", text: "3 dicas para uma rotina mais criativa.", attempts: 1 },
    { id: "d4", platform: "linkedin", status: "published", text: "Como estruturamos nosso calendário editorial.", attempts: 1 },
  ]},
  { id: "pub_3", workspaceId: workspace.id, baseText: "Manifesto Aurora: ideias precisam de espaço.", mediaType: "video", status: "failed", createdAt: "2026-09-12T10:00:00Z", destinations: [
    { id: "d5", platform: "youtube", status: "failed", title: "Manifesto Aurora", text: "Ideias precisam de espaço.", attempts: 2, lastError: "Conexão expirada" },
    { id: "d6", platform: "facebook", status: "published", text: "Ideias precisam de espaço.", attempts: 1 },
  ]},
];
