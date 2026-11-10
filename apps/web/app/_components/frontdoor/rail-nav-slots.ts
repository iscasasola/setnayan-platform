/**
 * The nav-registry slots the front-door rail renders a label from (`RAIL_SLOT` in `front-door-shell.tsx`, a CLIENT
 * module — a server component importing a value from it gets a client reference, not the value, so the list lives
 * here too). `app-rail-shell.tsx` hands the shell ONLY these, and only in the `app` variant where `slotLabel` reads
 * them. `lib/a-nav-gets-only-the-slots-it-reads.test.ts` fails if the two lists ever disagree.
 */
export const RAIL_NAV_SLOT_KEYS: readonly string[] = ['customer.account.events', 'customer.account.library'];
