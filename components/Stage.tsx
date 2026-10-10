import type { ReactNode } from "react";
import { EmbedProvider } from "./Embed";
import styles from "./site.module.css";

type Props = {
  id: string;
  eyebrow: string;
  title: string;
  lead: string;
  /** alternate background band */
  tone?: "sand" | "cream";
  /** full-width content (desktop hub) instead of a phone-width screen */
  wide?: boolean;
  children: ReactNode;
};

/** One section of the single-page site: heading copy beside (or above) a screen. */
export default function Stage({ id, eyebrow, title, lead, tone = "sand", wide, children }: Props) {
  return (
    <section id={id} className={`${styles.stage} ${tone === "cream" ? styles.cream : ""}`} aria-labelledby={`${id}-title`}>
      <div className={`${styles.stageInner} ${wide ? styles.wide : ""}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>{eyebrow}</p>
          <h2 id={`${id}-title`} className={styles.title}>
            {title}
          </h2>
          <p className={styles.lead}>{lead}</p>
        </div>
        <div className={styles.screen}>
          <EmbedProvider>{children}</EmbedProvider>
        </div>
      </div>
    </section>
  );
}
