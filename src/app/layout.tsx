import type { Metadata, Viewport } from "next";
import { PwaClient } from "@/components/pwa-client";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tela Social", template: "%s · Tela Social" },
  description: "Crie uma vez, adapte e publique em todos os lugares.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "Tela Social",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#ffffff",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body><PwaClient/>{children}</body></html>;
}
