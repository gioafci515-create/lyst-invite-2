import { Suspense } from "react";
import { approvedMedia, countByType, galleryItem } from "@/lib/contrib";
import { EventSeed } from "@/lib/eventStore";
import { getWire } from "@/lib/serverEvent";
import HomeView, { type GalleryItem, type Recap } from "@/components/HomeView";
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

/** What the night left behind, counted on the server: approved photos and clips, voices, letters. Never fails the page. */
async function recap(gallery: GalleryItem[]): Promise<Recap | null> {
  try {
    const c = await countByType();
    return {
      photos: gallery.filter((g) => g.kind === "photo").length,
      clips: gallery.filter((g) => g.kind === "video").length,
      voices: c.voice ?? 0,
      letters: (c.letter ?? 0) + (c.later ?? 0) + (c.forlater ?? 0),
    };
  } catch {
    return null;
  }
}

async function Loaded() {
  const wire = await getWire();
  const gallery = wire.phase === "after" && wire.modules.gallery ? await galleryPreview() : null;
  const counts = wire.phase === "after" ? await recap(gallery ?? (await galleryPreview())) : null;
  return (
    <EventSeed wire={wire}>
      <HomeView gallery={gallery} recap={counts} />
    </EventSeed>
  );
}

/** Shown for the moment it takes the server to read the event settings. Neutral on purpose: no feature can flash. */
function Shell() {
  return (
    <header className={styles.header} aria-busy="true">
      <span className={styles.mark}>LYST</span>
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
