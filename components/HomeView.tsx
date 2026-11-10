"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useLayoutEffect, useState, useSyncExternalStore, ViewTransition } from "react";
import { captureState, type CaptureKind } from "@/lib/eventState";
import { useEvent } from "@/lib/eventStore";
import { groupLabel, HASH_ROUTE, NAV, ROUTE, type NavGroup } from "@/lib/sections";
import SiteHeader from "./SiteHeader";
import QuickBar from "./QuickBar";
import InviteScreen from "./screens/InviteScreen";
import NightIndex from "./NightIndex";
import NightLayer from "./NightLayer";
import styles from "./site.module.css";

export type GalleryItem = { id: string; kind: "photo" | "video"; w?: number; h?: number };
/** counts for the after-the-event recap (only numbers above zero are ever shown) */
export type Recap = { photos: number; clips: number; voices: number; letters: number };

/**
 * Old in-page links (/#voice, /#later, /#camera, …) now have routes. Forward them before anything else happens.
 * Anchors that only exist on the invitation (programme, rsvp) are forwarded once the invitation is no longer shown.
 */
function useHashForward() {
  const router = useRouter();
  const ev = useEvent();
  useLayoutEffect(() => {
    const go = () => {
      const id = decodeURIComponent(location.hash.slice(1));
      if (!id) return;
      let to: string | undefined = HASH_ROUTE[id];
      if (!to && !document.getElementById(id)) to = id === "programme" ? ROUTE.programme : id === "rsvp" ? ROUTE.details : undefined;
      if (to) router.replace(to);
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, [router, ev.phase]);
}

const PHONE = "(max-width: 760px)";
const subscribeWidth = (cb: () => void) => {
  const m = window.matchMedia(PHONE);
  m.addEventListener("change", cb);
  return () => m.removeEventListener("change", cb);
};
/** true on a phone-width screen (false on the server: the footer is far below the first screen, no visible flash) */
const usePhoneWidth = () => useSyncExternalStore(subscribeWidth, () => window.matchMedia(PHONE).matches, () => false);

/** night features and the window each follows; anything not listed (the letter, the invitation, memories) is always listed */
const NIGHT_KIND: Record<string, CaptureKind> = { [ROUTE.tasks]: "tasks", [ROUTE.camera]: "camera", [ROUTE.voice]: "voice", [ROUTE.video]: "video", [ROUTE.live]: "live" };

function FooterGroup({ title, items, compact }: { title: string; items: { href: string; label: string }[]; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  if (!compact) {
    return (
      <div>
        <h2>{title}</h2>
        <ul>
          {items.map((n) => (
            <li key={n.href}>
              <Link href={n.href}>{n.label}</Link>
            </li>
          ))}
        </ul>
      </div>
    );
  }
  return (
    <div>
      <h2>
        <button type="button" className={styles.footerToggle} aria-expanded={open} aria-controls={id} onClick={() => setOpen((o) => !o)}>
          {title}
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden>
            <path d="M6 9l6 6 6-6" />
          </svg>
        </button>
      </h2>
      <ul id={id} hidden={!open}>
        {items.map((n) => (
          <li key={n.href}>
            <Link href={n.href}>{n.label}</Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SiteFooter() {
  const ev = useEvent();
  const compact = usePhoneWidth();
  const groups: NavGroup[] = ["Invitation", "Tonight", "Memories"];
  return (
    <footer className={styles.footer}>
      <div>
        <p className={styles.footerMark}>LYST / invitations</p>
        <p className={styles.footerNote}>
          Questions for the hosts: <a href="mailto:hello@lyst.events">hello@lyst.events</a>. This invitation is for named guests only.
        </p>
      </div>
      <nav className={`${styles.footerIndex} ${compact ? styles.footerCompact : ""}`} aria-label="Everything on this site">
        {groups.map((g) => {
          // a night feature that is closed right now (not yet, or no longer) isn't offered here
          const items = NAV.filter((n) => n.group === g && (!n.module || ev.enabled(n.module)) && (!NIGHT_KIND[n.href] || captureState(NIGHT_KIND[n.href], ev.phase) === "open"));
          if (!items.length) return null;
          return <FooterGroup key={g} title={groupLabel(g, ev.phase)} items={items} compact={compact} />;
        })}
      </nav>
    </footer>
  );
}

/** The home page: the invitation before the event, tonight's actions during it, memories after it. */
export default function HomeView({ gallery, recap = null }: { gallery: GalleryItem[] | null; recap?: Recap | null }) {
  const ev = useEvent();
  useHashForward();
  return (
    <>
      <SiteHeader />
      <ViewTransition enter="page-in" exit="page-out" default="none">
        <div className={styles.page}>
          <main id="main">{ev.phase === "before" ? <InviteScreen /> : <NightIndex gallery={gallery} recap={recap} />}</main>
          <SiteFooter />
        </div>
      </ViewTransition>
      <QuickBar />
      <NightLayer />
    </>
  );
}
