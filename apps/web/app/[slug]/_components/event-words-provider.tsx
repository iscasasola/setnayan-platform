'use client';

/**
 * THE EVENT'S OWN WORDS, AVAILABLE TO THE CLIENT PARTS OF THE GUEST TREE.
 *
 * ── WHY A PROVIDER AND NOT A PROP ───────────────────────────────────────────
 * The organiser noun (`couple` · `celebrant` · `graduate` · `organizer` ·
 * `host`) is resolved on the SERVER from the event type. Most of the guest tree
 * is server-rendered and can simply take it as a prop — but five surfaces are
 * client components (the video greeting, the selfie capture, the face opt-in,
 * the photo wall, the guest column form), and several sit several layers below
 * the component that knows the event. Threading one string through those layers
 * would mean touching files that have nothing else to do with this, and every
 * intermediate becomes a place to forget it.
 *
 * ── THE FALLBACK IS THE OLD BEHAVIOUR, ON PURPOSE ───────────────────────────
 * 🔒 The default is `null`, and every consumer is expected to fall back to the
 * sentence it renders today. That is what makes adopting this SAFE ONE FILE AT
 * A TIME: a component that has not been wired yet, or one rendered outside the
 * provider (a modal in a portal, a future route), keeps its current wording
 * rather than rendering an empty gap or a wrong word.
 *
 * ⚠ THE FALLBACK IS "the couple", AND THE FIRST DRAFT OF THIS COMMENT ARGUED
 * THE OPPOSITE. The argument against it is real: a wedding default makes a
 * missing provider INVISIBLE, because every launched production event is a
 * wedding. The argument for it is stronger — the alternative ("the host") means
 * that if the provider is ever not mounted, every real couple's live invitation
 * silently starts calling them "the host". **A safe default must not be able to
 * regress the only case that exists.**
 *
 * So the default preserves today, and the invisibility it creates is closed by
 * a GUARD instead of by a scary value: `event-words-mounted.test.ts` asserts the
 * provider actually wraps the tree, and that every consumer of the hook handles
 * `null`. A silent fallback is only acceptable when something else is watching.
 */
import { createContext, useContext, type ReactNode } from 'react';

/** The shape the client half needs. A subset of the server's `EventWords` —
 *  client components only ever say "the X" or "the X's", never the event word. */
export type ClientEventWords = {
  /** 'the couple' · 'the celebrant' · 'the host'. */
  theOrganizer: string;
  /** 'The couple' — sentence-initial. */
  TheOrganizer: string;
  /** 'the couple’s'. */
  theOrganizerPossessive: string;
};

/**
 * What a consumer renders when no provider is above it — byte-identical to the
 * wording every one of these surfaces shipped with before this existed. See the
 * docblock: this preserves the only case that exists in production, and the
 * guard is what stops it hiding a missing provider.
 */
export const WORDS_AS_SHIPPED: ClientEventWords = {
  theOrganizer: 'the couple',
  TheOrganizer: 'The couple',
  theOrganizerPossessive: 'the couple’s',
};

const EventWordsContext = createContext<ClientEventWords | null>(null);

/** Mounted once by the server, high in the guest tree, with the resolved words. */
export function EventWordsProvider({
  words,
  children,
}: {
  words: ClientEventWords;
  children: ReactNode;
}) {
  return <EventWordsContext.Provider value={words}>{children}</EventWordsContext.Provider>;
}

/**
 * Read the event's words. Returns `null` when there is no provider above —
 * callers MUST handle that by rendering what they render today.
 *
 * Deliberately not a throwing hook: a missing provider is a wording problem,
 * and crashing a guest's invitation over a noun would be far worse than the
 * noun being generic.
 */
export function useEventWords(): ClientEventWords | null {
  return useContext(EventWordsContext);
}
