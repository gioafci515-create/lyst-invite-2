"use client";

import Image from "next/image";
import type { ReactNode } from "react";
import { SECTION, useEmbedded } from "./Embed";
import styles from "./app.module.css";

export const STEPS = [
  { label: "Invite", href: `#${SECTION.invite}` },
  { label: "Respond", href: `#${SECTION.details}` },
  { label: "Prepare", href: `#${SECTION.hub}` },
  { label: "Participate", href: `#${SECTION.camera}` },
  { label: "Remember", href: `#${SECTION.live}` },
] as const;

type Props = {
  /** header actions artwork from Figma (live dot + screen icon) */
  header?: { src: string; width: number; height?: number };
  title?: string;
  /** index into STEPS */
  step: number;
  action?: { label: string; onClick?: () => void; href?: string; disabled?: boolean; icon?: boolean };
  /** page background override (e.g. acid green) */
  bg?: string;
  children: ReactNode;
};

export default function AppShell({ header, title, step, action, bg, children }: Props) {
  const embedded = useEmbedded();
  const actionInner = (
    <>
      {action?.icon !== false && (
        <Image src="/images/app/arrow-up-right-16.svg" alt="" width={16} height={16} aria-hidden />
      )}
      {action?.label}
    </>
  );

  return (
    <div className={`${styles.phone} ${embedded ? styles.embedded : ""}`} style={bg ? { background: bg } : undefined}>
      <header className={styles.bar}>
        <div className={styles.heading}>{title && <h3>{title}</h3>}</div>
        {header && (
          <Image src={header.src} alt="" width={header.width} height={header.height ?? 44} aria-hidden />
        )}
      </header>

      <div className={styles.content}>{children}</div>

      <footer className={styles.dock}>
        <nav className={styles.journey} aria-label="Journey">
          {STEPS.map((s, i) => (
            <a
              key={s.label}
              href={s.href}
              className={styles.step}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={styles.stepBar} data-current={i === step} />
              <span className={styles.stepLabel}>{s.label}</span>
            </a>
          ))}
        </nav>
        {action &&
          (action.href ? (
            <a href={action.href} className={styles.primary} data-btn>
              {actionInner}
            </a>
          ) : (
            <button className={styles.primary} onClick={action.onClick} disabled={action.disabled}>
              {actionInner}
            </button>
          ))}
      </footer>
    </div>
  );
}
