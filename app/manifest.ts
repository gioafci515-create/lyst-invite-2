import type { MetadataRoute } from "next";
import { EVENT } from "@/lib/identity";

// Makes the site installable ("Add to Home Screen"), which iPhones require before they allow push notifications.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${EVENT.title} — ${EVENT.host}`,
    short_name: EVENT.name,
    description: `Your invitation, event hub and tasks for ${EVENT.title}.`,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#d9d4c8",
    theme_color: "#ff3b21",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
