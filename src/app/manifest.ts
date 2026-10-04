import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Universo Tendas — Gestão",
    short_name: "Universo Tendas",
    start_url: "/admin",
    scope: "/admin",
    display: "standalone",
    background_color: "#f4f4f5",
    theme_color: "#0c3f80",
    icons: [{ src: "/brand/universo-logo.png", sizes: "150x150", type: "image/png" }],
  };
}
