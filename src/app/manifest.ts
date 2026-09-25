import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Universo Tendas — Gestão",
    short_name: "Universo Tendas",
    start_url: "/admin",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#16171a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
