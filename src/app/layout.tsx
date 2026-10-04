import type { Metadata, Viewport } from "next";
import "@fontsource-variable/inter";
import "./globals.css";

// Metadados do site público. O painel (/admin) e o login sobrescrevem com noindex.
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL || "https://universotendas.com.br"),
  title: { default: "Universo Tendas | Locação de Tendas em Sinop - MT", template: "%s | Universo Tendas" },
  description: "Locação de tendas e estruturas para eventos em Sinop - MT. Escolha a tenda, informe a data e o local e faça sua reserva online.",
  applicationName: "Universo Tendas",
  openGraph: { type: "website", locale: "pt_BR", siteName: "Universo Tendas" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0c3f80",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body>{children}</body>
    </html>
  );
}
