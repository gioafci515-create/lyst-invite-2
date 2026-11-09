import { Suspense } from "react";
import { approvedMedia, galleryItem } from "@/lib/contrib";
import { EventSeed } from "@/lib/eventStore";
import { getWire } from "@/lib/serverEvent";
import HomeView, { type GalleryItem } from "@/components/HomeView";
import styles from "@/components/site.module.css";

/** Approved photos for the memories lead, newest first. Never fails the page: no photos is an honest empty state. */
async function galleryPreview(): Promise<GalleryItem[]> {
  try {
    const rows = await approvedMedia();
    return rows.map(galleryItem);
  } catch {
    return [];
  }
}

async function Loaded() {
  const wire = await getWire();
  const gallery = wire.phase === "after" && wire.modules.gallery ? await galleryPreview() : null;
  return (
    <EventSeed wire={wire}>
      <HomeView gallery={gallery} />
    </EventSeed>
  );
}

/** Shown for the moment it takes the server to read the event settings. Neutral on purpose: no feature can flash. */
function Shell() {
  return (
    <header className={styles.header} aria-busy="true">
      <span className={styles.mark}>LYST / 10</span>
    </header>
  );
}

export default function Home() {
  return (
    <Suspense fallback={<Shell />}>
      <Loaded />
    </Suspense>
  );
}
