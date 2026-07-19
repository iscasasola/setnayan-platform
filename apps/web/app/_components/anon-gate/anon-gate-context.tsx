'use client';

/**
 * AnonGateContext — one source of truth, seeded once at the dashboard layout,
 * telling any client island whether the current principal is a Supabase native
 * ANONYMOUS user (finished onboarding without an account, per the anon-draft
 * model in lib/anon-onboarding.ts).
 *
 * Why a context: the gated action buttons (unlock a category, checkout, …) sit
 * arbitrarily deep under dashboard pages. Threading `isAnonymous` as a prop
 * through every intermediate page/server component would mean each one
 * re-fetching the user. The dashboard layout already resolves `user`, so it
 * seeds this provider once and every descendant reads it for free.
 *
 * Default `false` so a component used OUTSIDE a provider (e.g. the public
 * vendor page, which passes `isAnonymous` as an explicit prop instead) behaves
 * exactly as a secured user would — never accidentally gating.
 *
 * Inert until the anon flag is live: `is_anonymous` is only ever true once
 * NEXT_PUBLIC_ANON_ONBOARDING_ENABLED + the Supabase Auth setting are on, so in
 * prod today every consumer reads `false` and renders unchanged.
 */

import { createContext, useContext, type ReactNode } from 'react';

const AnonGateContext = createContext<{ isAnonymous: boolean }>({ isAnonymous: false });

export function AnonGateProvider({
  isAnonymous,
  children,
}: {
  isAnonymous: boolean;
  children: ReactNode;
}) {
  return (
    <AnonGateContext.Provider value={{ isAnonymous }}>{children}</AnonGateContext.Provider>
  );
}

export function useAnonGate(): { isAnonymous: boolean } {
  return useContext(AnonGateContext);
}
