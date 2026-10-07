"use client";

import Image from "next/image";
import Link from "next/link";
import type { ReactNode } from "react";
import styles from "./app.module.css";

export const STEPS = [
  { label: "Invite", href: "/" },
  { label: "Respond", href: "/respond" },
  { label: "Prepare", href: "/prepare" },
  { label: "Participate", href: "/participate" },
  { label: "Remember", href: "/remember" },
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
  const actionInner = (
    <>
      {action?.icon !== false && (
        <Image src="/images/app/arrow-up-right-16.svg" alt="" width={16} height={16} aria-hidden />
      )}
      {action?.label}
    </>
  );

  return (
    <div className={styles.phone} style={bg ? { background: bg } : undefined}>
      <header className={styles.bar}>
        <div className={styles.heading}>{title && <h1>{title}</h1>}</div>
        {header && (
          <Image src={header.src} alt="" width={header.width} height={header.height ?? 44} aria-hidden />
        )}
      </header>

      <div className={styles.content}>{children}</div>

      <footer className={styles.dock}>
        <nav className={styles.journey} aria-label="Journey">
          {STEPS.map((s, i) => (
            <Link
              key={s.label}
              href={s.href}
              className={styles.step}
              aria-current={i === step ? "step" : undefined}
            >
              <span className={styles.stepBar} data-current={i === step} />
              <span className={styles.stepLabel}>{s.label}</span>
            </Link>
          ))}
        </nav>
        {action &&
          (action.href ? (
            <Link href={action.href} className={styles.primary}>
              {actionInner}
            </Link>
          ) : (
            <button className={styles.primary} onClick={action.onClick} disabled={action.disabled}>
              {actionInner}
            </button>
          ))}
      </footer>
    </div>
  );
}
