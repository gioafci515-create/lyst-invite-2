import { Suspense, ViewTransition, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CaptureKind, ModuleId } from "@/lib/eventState";
import { getWire } from "@/lib/serverEvent";
import { EventSeed } from "@/lib/eventStore";
import { EmbedProvider } from "./Embed";
import ModuleGate from "./ModuleGate";
import PhaseGate from "./PhaseGate";
import LiveCard from "./LiveCard";
import NightLayer from "./NightLayer";
import styles from "./route.module.css";

type Props = {
  /** the host switch that gates this route; omitted for routes every event has (details, programme, updates) */
  module?: ModuleId;
  title: string;
  /** one plain sentence: what this screen is for and who sees what you leave here */
  intro?: string;
  /** the screen brings its own phone-width frame (AppShell); otherwise the route lays out its content */
  framed?: boolean;
  /** only open during the event (and, for voice and video, after it): otherwise an "opens on" / "closed" screen */
  capture?: CaptureKind;
  /** the live moment card at the bottom (default on); off where the moment already lives inside the screen */
  liveCard?: boolean;
  children: ReactNode;
};

function Header({ title }: { title: string }) {
  return (
    <header className={styles.header}>
      <Link href="/" className={styles.back} aria-label="Back to home">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
          <path d="M20 12H5M11 6l-6 6 6 6" />
        </svg>
        <span>Home</span>
      </Link>
      <h1 className={styles.title}>{title}</h1>
    </header>
  );
}

/** Each feature's approved photograph (crops by object-position only; the images are untouched). */
const SCENE: Partial<Record<ModuleId, { src: string; pos: string }>> = {
  voice: { src: "/images/gallery1.png", pos: "50% 40%" },
  video: { src: "/images/shard.png", pos: "50% 38%" },
  live: { src: "/images/gallery3.png", pos: "50% 55%" },
  gallery: { src: "/images/gallery3.png", pos: "50% 40%" },
  later: { src: "/images/gallery2.png", pos: "50% 26%" },
  tasks: { src: "/images/story-mobile.png", pos: "50% 30%" },
  capsule: { src: "/images/gallery3.png", pos: "50% 70%" },
};
const SCENE_DEFAULT = { src: "/images/gallery2.png", pos: "50% 30%" };

/** The screen's opening scene: its photograph, its name set large (the h1 in the header says the same to assistive tech). */
function Scene({ title, module }: { title: string; module?: ModuleId }) {
  const ph = (module && SCENE[module]) || SCENE_DEFAULT;
  return (
    <div className={styles.scene} aria-hidden>
      <Image src={ph.src} alt="" fill priority quality={90} sizes="100vw" style={{ objectFit: "cover", objectPosition: ph.pos }} />
      <p className={styles.sceneTitle}>{title}</p>
    </div>
  );
}

/** Server check (the proxy already redirects; this is the backup), then the screen with the state the server read. */
async function Gated({ module, intro, framed = true, capture, liveCard = true, children }: Omit<Props, "title">) {
  const wire = await getWire();
  if (module && !wire.modules[module]) notFound();
  return (
    <EventSeed wire={wire}>
      <div className={framed ? styles.framed : styles.open}>
        <EmbedProvider mode="route">
          {module ? (
            <ModuleGate id={module}>
              {capture ? (
                <PhaseGate kind={capture}>
                  {intro && <p className={styles.intro}>{intro}</p>}
                  {children}
                </PhaseGate>
              ) : (
                <>
                  {intro && <p className={styles.intro}>{intro}</p>}
                  {children}
                </>
              )}
            </ModuleGate>
          ) : (
            <>
              {intro && <p className={styles.intro}>{intro}</p>}
              {children}
            </>
          )}
          {liveCard && <LiveCard />}
          <NightLayer />
        </EmbedProvider>
      </div>
    </EventSeed>
  );
}

/** A feature on its own full-screen route: header with a back button to /, then the screen. */
export default function FeatureRoute({ title, ...rest }: Props) {
  return (
    <>
      <Header title={title} />
      <main id="main" className={styles.main}>
        <Scene title={title} module={rest.module} />
        <Suspense fallback={<div className={styles.loading} aria-busy="true" aria-label="Loading" />}>
          {/* arriving on a screen: it rises in; leaving it: it fades (lateral moves, so no sideways slide) */}
          <ViewTransition enter="page-in" exit="page-out" default="none">
            <Gated {...rest} />
          </ViewTransition>
        </Suspense>
      </main>
    </>
  );
}
