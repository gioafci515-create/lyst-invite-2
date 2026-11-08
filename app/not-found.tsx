import Link from "next/link";
import styles from "@/components/route.module.css";

export default function NotFound() {
  return (
    <main className={styles.main} style={{ display: "grid", placeItems: "center", padding: 24 }}>
      <div style={{ maxWidth: 420, display: "grid", gap: 16 }}>
        <h1 style={{ fontFamily: "var(--f-grotesk)", fontSize: 28, lineHeight: 1.1 }}>This page is not part of this event</h1>
        <p style={{ fontSize: 16, lineHeight: 1.5, color: "var(--muted)" }}>The hosts may have switched it off, or the address is wrong.</p>
        <Link href="/" className="btn-primary" data-btn>
          Back to the invitation
        </Link>
      </div>
    </main>
  );
}
