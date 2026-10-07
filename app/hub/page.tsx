import type { Metadata } from "next";
import HubClient from "./HubClient";

export const metadata: Metadata = { title: "UN/FOLD 2026 — Event hub" };

export default function HubPage() {
  return <HubClient />;
}
