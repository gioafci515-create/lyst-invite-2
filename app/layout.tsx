import type { Metadata } from "next";
import { Arimo, Roboto_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const arimo = Arimo({ variable: "--font-arimo", subsets: ["latin"], weight: ["400", "700"] });
const robotoMono = Roboto_Mono({ variable: "--font-mono", subsets: ["latin"], weight: ["400", "700"] });
const spaceGrotesk = Space_Grotesk({ variable: "--font-grotesk", subsets: ["latin"], weight: ["700"] });

export const metadata: Metadata = {
  title: "UN/FOLD 2026 — LYST invitation",
  description: "A live publishing experiment: type, sound, performance and an audience that edits the ending.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${arimo.variable} ${robotoMono.variable} ${spaceGrotesk.variable}`}>
      <body>{children}</body>
    </html>
  );
}
