'use client';

/**
 * THE COUPLE'S ROLE WORDS, FOR THE GUEST LIST'S CLIENT HALF.
 *
 * ⚖ Owner 2026-09-30: a couple may call their bridesmaids "Bride's Crew" —
 * `events.role_names`, read ONCE by the Guest list page and handed down here so
 * every chip, picker, toast and bulk sheet says the same word without threading
 * one prop through a dozen layers.
 *
 * 🔒 THE FALLBACK IS THE USUAL WORD. With no provider above it (a surface that
 * has not been wired, a portal), `useRoleNames()` returns `{}` and every label
 * reads exactly as before this existed — never a blank. What stops a missing
 * provider from hiding is `role-names-reach-every-screen.test.ts`, which
 * asserts the page mounts it.
 *
 * A rename made from the role picker updates this in place (`setNames`), so the
 * list shows the new word at once, before the server's refresh lands.
 */
import { createContext, useContext, useState, type ReactNode } from 'react';
import type { RoleNames } from '@/lib/role-names';

type Ctx = { names: RoleNames; setNames: (next: RoleNames) => void };

const RoleNamesContext = createContext<Ctx>({ names: {}, setNames: () => {} });

export function RoleNamesProvider({ names, children }: { names: RoleNames; children: ReactNode }) {
  // A local edit is kept only while the server's read is the one it was made
  // against; a fresh read (after revalidation) replaces it.
  const [local, setLocal] = useState<{ base: RoleNames; names: RoleNames } | null>(null);
  const current = local && local.base === names ? local.names : names;
  return (
    <RoleNamesContext.Provider value={{ names: current, setNames: (next) => setLocal({ base: names, names: next }) }}>
      {children}
    </RoleNamesContext.Provider>
  );
}

/** The couple's role words — `{}` (the usual words) outside a provider. */
export function useRoleNames(): RoleNames {
  return useContext(RoleNamesContext).names;
}

/** For the rename control: apply a saved result in place. */
export function useSetRoleNames(): (next: RoleNames) => void {
  return useContext(RoleNamesContext).setNames;
}
