import type { Metadata, Viewport } from "next";
import { Arimo, Roboto_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const arimo = Arimo({ variable: "--font-arimo", subsets: ["latin"], weight: ["400", "700"] });
const robotoMono = Roboto_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "700"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["700"] });

export const metadata: Metadata = {
  title: "UN/FOLD 2026 — LYST invitation",
  description: "A live publishing experiment: type, sound, performance and an audience that edits the ending.",
  icons: { icon: "/icons/icon-192.png", apple: "/icons/apple-touch-icon.png" },
  appleWebApp: { capable: true, title: "UN/FOLD", statusBarStyle: "black-translucent" },
};

// viewport-fit=cover lets the full-screen camera reach under phone notches
export const viewport: Viewport = {
  viewportFit: "cover",
  themeColor: "#ff3b21",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${arimo.variable} ${robotoMono.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
