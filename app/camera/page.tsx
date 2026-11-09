import { Suspense } from "react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getWire } from "@/lib/serverEvent";
import { EventSeed } from "@/lib/eventStore";
import CameraClient from "./CameraClient";

export const metadata: Metadata = { title: "Camera — UN/FOLD 2026" };

/** Server check first (the proxy already redirects a switched-off camera; this is the backup), then the camera. */
async function Gated() {
  const wire = await getWire();
  if (!wire.modules.camera) notFound();
  return (
    <EventSeed wire={wire}>
      <CameraClient />
    </EventSeed>
  );
}

export default function CameraPage() {
  return (
    <Suspense fallback={<div style={{ minHeight: "100dvh", background: "#0a0a0a" }} aria-busy="true" />}>
      <Gated />
    </Suspense>
  );
}
