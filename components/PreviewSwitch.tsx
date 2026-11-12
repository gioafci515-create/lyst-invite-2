import { isGuardedPreview, previewChapter } from "@/lib/previewGuard";
import styles from "./previewswitch.module.css";

/**
 * Preview deployments only: a small switch to review the three chapters, and a reminder that nothing is saved there.
 * Renders nothing in production or locally.
 */
export default async function PreviewSwitch() {
  if (!isGuardedPreview()) return null;
  const now = await previewChapter();
  const items: [string, string][] = [
    ["before", "I Invitation"],
    ["during", "II Night"],
    ["after", "III Memory"],
    ["live", "Real phase"],
  ];
  return (
    <nav className={styles.switch} aria-label="Preview: choose a chapter">
      <span className={styles.note}>Preview, nothing is saved</span>
      {items.map(([to, label]) => (
        <a key={to} href={`/api/preview/chapter?to=${to}`} aria-current={(now ?? "live") === to ? "true" : undefined}>
          {label}
        </a>
      ))}
    </nav>
  );
}
