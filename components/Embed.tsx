"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * How a screen is being shown:
 *  - false    its own standalone frame (legacy)
 *  - "section" a block inside another page
 *  - "route"  the body of a full-screen feature route; the route header carries the title and the back button
 */
type Mode = false | "section" | "route";
const EmbedContext = createContext<Mode>(false);

export function EmbedProvider({ children, mode = "section" }: { children: ReactNode; mode?: Exclude<Mode, false> }) {
  return <EmbedContext.Provider value={mode}>{children}</EmbedContext.Provider>;
}

export const useEmbedded = () => useContext(EmbedContext) !== false;
export const useEmbedMode = () => useContext(EmbedContext);
