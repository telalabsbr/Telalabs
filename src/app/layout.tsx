import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Tela", template: "%s · Tela" },
  description: "Conteúdo em todos os lugares, sem o trabalho repetitivo.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
