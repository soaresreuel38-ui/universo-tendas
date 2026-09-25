import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Universo Tendas — Gestão", template: "%s · Universo Tendas" },
  description: "Sistema interno de estoque, locações e vendas da Universo Tendas (Sinop - MT).",
  robots: { index: false, follow: false },
  applicationName: "Universo Tendas",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#16171a",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
