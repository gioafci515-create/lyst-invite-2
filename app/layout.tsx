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

/**
 * A screen-change animation the browser skips (the phone turned, the window or its scrollbar changed size mid-way)
 * ends in an error nobody can act on: the new screen is already there. Keep it out of the error log. Inline in the
 * head, because React can start such an animation while the page is still streaming, before any component runs.
 */
const SKIPPED_TRANSITION = `(function(){var s=function(r){return!!r&&(r.name==="InvalidStateError"||r.name==="AbortError")&&/transition/i.test(r.message||"")};addEventListener("unhandledrejection",function(e){if(s(e.reason))e.preventDefault()});addEventListener("error",function(e){if(s(e.error))e.preventDefault()})})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${arimo.variable} ${robotoMono.variable} ${spaceGrotesk.variable}`}>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SKIPPED_TRANSITION }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
