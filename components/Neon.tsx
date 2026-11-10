import type { CSSProperties } from "react";
import s from "./neon.module.css";

/**
 * Letters that switch on like a neon sign when the page opens: each one stutters and catches on its own beat, then
 * holds. The beats are fixed per letter (not random), so the server and the browser render the same thing. Pure CSS:
 * it runs from the very first paint, and with reduced motion the letters are simply on.
 */
export default function Neon({ text, from = 0, tone }: { text: string; from?: number; tone?: "red" }) {
  return (
    <>
      {[...text].map((ch, i) => {
        const n = from + i;
        // a scattered but repeatable order: 120 ms base, then one of nine beats 85 ms apart
        const delay = 120 + ((n * 5 + 3) % 9) * 85;
        return (
          <span key={i} className={`${s.tube} ${tone === "red" ? s.red : ""}`} style={{ "--d": `${delay}ms` } as CSSProperties}>
            {ch}
          </span>
        );
      })}
    </>
  );
}
