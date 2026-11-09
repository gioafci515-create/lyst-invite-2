"use client";

import type { ReactNode, Ref } from "react";
import type { Reply } from "@/lib/rsvp";
import r from "./screens/room.module.css";

/**
 * The guest's current answer, the same card on the invitation and on /details. A decline reads as a decline, never as
 * "coming"; a meal the guest hasn't picked reads as not chosen, never as a default.
 */
export default function ReplyCard({
  reply,
  children,
  headingRef,
  onChooseMeal,
}: {
  reply: Reply;
  children?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
  /** when given, an unchosen meal gets a button that opens the form */
  onChooseMeal?: () => void;
}) {
  const going = reply.attending === "accept";
  const rows: [string, ReactNode][] = going
    ? [
        ["Name", reply.name],
        ["Party", reply.guests === 1 ? "Just you" : `${reply.guests} people${reply.companion ? `, with ${reply.companion}` : ""}`],
        [
          "Meal",
          reply.meal || (
            <span className={r.notChosen}>
              Not chosen yet.{" "}
              {onChooseMeal && (
                <button type="button" className={r.inlineAction} onClick={onChooseMeal}>
                  Choose a meal
                </button>
              )}
            </span>
          ),
        ],
        ["Dietary", reply.dietary || "Nothing to note"],
        ["Access", reply.requests || "Nothing to note"],
      ]
    : [["Name", reply.name]];
  return (
    <section className={r.answer} data-attending={reply.attending} aria-labelledby="answer-title">
      <h2 id="answer-title" ref={headingRef} tabIndex={-1} className={r.h2}>
        {going ? "You’re coming." : "You’re not coming."}
      </h2>
      <dl className={r.answerList}>
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} style={{ display: "contents" }}>
              <dt>{k}</dt>
              <dd>{v}</dd>
            </div>
          ))}
      </dl>
      {children}
    </section>
  );
}
