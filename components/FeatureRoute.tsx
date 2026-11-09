import { Suspense, type ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import type { CaptureKind, ModuleId } from "@/lib/eventState";
import { getWire } from "@/lib/serverEvent";
import { EventSeed } from "@/lib/eventStore";
import { EmbedProvider } from "./Embed";
import ModuleGate from "./ModuleGate";
import PhaseGate from "./PhaseGate";
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

/** Server check (the proxy already redirects; this is the backup), then the screen with the state the server read. */
async function Gated({ module, intro, framed = true, capture, children }: Omit<Props, "title">) {
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
        <Suspense fallback={<div className={styles.loading} aria-busy="true" aria-label="Loading" />}>
          <Gated {...rest} />
        </Suspense>
      </main>
    </>
  );
}
