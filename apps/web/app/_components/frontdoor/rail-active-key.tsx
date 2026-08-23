'use client';

/**
 * rail-active-key.tsx — the ONE answer to "which rail row is lit", published
 * from the one place that can see every row.
 *
 * ─── WHY A CONTEXT AND NOT A SECOND RESOLVER ─────────────────────────────
 * The rail is rendered by two components at once: `FrontDoorShell` draws the
 * account rows and the Studio group, and a `railContext` child drawn beneath
 * them draws the event menu (or the admin / vendor one). Each used to call
 * `activeRailKey` over its OWN rows, which is fine only while the two sets can
 * never match the same URL — and the Studio rows broke that the moment they
 * started pointing at real in-app routes.
 *
 * 🔑 A WINNER RESOLVED PER COMPONENT IS NOT A WINNER. `activeRailKey` exists
 * precisely because asking each row "are you active?" double-lights; asking
 * each COMPONENT the same question is the identical mistake one level up.
 *
 * So the shell resolves ONCE over the union and publishes the key. A child
 * reads it and compares. There is no fallback resolver here on purpose: a
 * child that quietly resolved its own rows when the provider was missing would
 * reintroduce exactly the second answer this removes, and it would do it
 * silently. `null` renders as "no row lit", which is a real and honest answer.
 */

import { createContext, useContext } from 'react';

const RailActiveKeyContext = createContext<string | null>(null);

export function RailActiveKeyProvider({
  activeKey,
  children,
}: {
  activeKey: string | null;
  children: React.ReactNode;
}) {
  return (
    <RailActiveKeyContext.Provider value={activeKey}>{children}</RailActiveKeyContext.Provider>
  );
}

/** The key of the one lit row across the WHOLE rail, or null when none is. */
export function useRailActiveKey(): string | null {
  return useContext(RailActiveKeyContext);
}
