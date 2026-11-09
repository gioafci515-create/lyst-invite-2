"use client";

import type { ReactNode } from "react";
import { useEvent } from "@/lib/eventStore";
import type { ModuleId } from "@/lib/eventState";

/** Renders its section only when the hosts have enabled that module for this event. No leftovers, no empty gaps. */
export default function ModuleGate({ id, children }: { id: ModuleId; children: ReactNode }) {
  const { enabled } = useEvent();
  return enabled(id) ? <>{children}</> : null;
}
