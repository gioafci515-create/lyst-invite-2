"use client";

import { createContext, useContext, type ReactNode } from "react";

/** True when a screen is rendered as a section of the single-page site (not its own route). */
const EmbedContext = createContext(false);

export function EmbedProvider({ children }: { children: ReactNode }) {
  return <EmbedContext.Provider value={true}>{children}</EmbedContext.Provider>;
}

export const useEmbedded = () => useContext(EmbedContext);

