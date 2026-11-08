"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useLayoutEffect } from "react";
import { useEvent } from "@/lib/eventStore";
import { HASH_ROUTE, NAV, ROUTE, type NavGroup } from "@/lib/sections";
import SiteHeader from "./SiteHeader";
import QuickBar from "./QuickBar";
import InviteScreen from "./screens/InviteScreen";
import NightIndex from "./NightIndex";
import styles from "./site.module.css";

export type GalleryItem = { id: string; kind: "photo" | "video" };

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

function SiteFooter() {
  const ev = useEvent();
  const groups: NavGroup[] = ["Invitation", "Tonight", "Memories"];
  return (
    <footer className={styles.footer}>
      <div>
        <p className={styles.footerMark}>LYST / invitations</p>
        <p className={styles.footerNote}>
          Questions for the hosts: <a href="mailto:hello@lyst.events">hello@lyst.events</a>. This invitation is for named guests only.
        </p>
      </div>
      <nav className={styles.footerIndex} aria-label="Everything on this site">
        {groups.map((g) => {
          const items = NAV.filter((n) => n.group === g && (!n.module || ev.enabled(n.module)));
          if (!items.length) return null;
          return (
            <div key={g}>
              <h2>{g}</h2>
              <ul>
                {items.map((n) => (
                  <li key={n.href}>
                    <Link href={n.href}>{n.label}</Link>
                  </li>
                ))}
              </ul>
            </div>
          );
        })}
      </nav>
    </footer>
  );
}

/** The home page: the invitation before the event, tonight's actions during it, memories after it. */
export default function HomeView({ gallery }: { gallery: GalleryItem[] | null }) {
  const ev = useEvent();
  useHashForward();
  return (
    <>
      <SiteHeader />
      <div className={styles.page}>
        <main id="main">{ev.phase === "before" ? <InviteScreen /> : <NightIndex gallery={gallery} />}</main>
        <SiteFooter />
      </div>
      <QuickBar />
    </>
  );
}
