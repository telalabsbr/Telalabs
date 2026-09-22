import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Tela Social",
    short_name: "Tela Social",
    description: "Crie uma vez, adapte e publique em todos os lugares.",
    start_url: "/publicacoes/nova",
    scope: "/",
    display: "standalone",
    background_color: "#f7f8fb",
    theme_color: "#ffffff",
    icons: [
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
    ],
  };
}
