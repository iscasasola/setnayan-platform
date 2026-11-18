/**
 * merged-view.ts — how a merged admin page shows one of its old pages (admin reorg v7, `lib/admin/admin-pages.ts`).
 *
 * Owner rule, 17 Nov 2026: reposition and realign only — *"No code everything that is already there."* So a merged
 * page does not re-draw its views: it MOUNTS the old page's own body, unchanged, with the same search params it would
 * have had at its old address (the old address forwards here, query kept). The old page module stays where it is,
 * with its own actions, reads and copy; only its address moved.
 *
 * Same move the event dashboard already makes (`dashboard/[eventId]/guests/page.tsx` mounts the seating page).
 */

export type SearchParamsRecord = Record<string, string | string[] | undefined>;

/** Any page module's default export. `never` accepts every page's own (narrower) props type. */
export type PageBody = (props: never) => unknown;

/** Render an old page's body as a view of the merged page. */
export function mountView<P extends PageBody>(Page: P, sp: SearchParamsRecord): ReturnType<P> {
  return Page({ searchParams: Promise.resolve(sp) } as Parameters<P>[0]) as ReturnType<P>;
}

/** The page's own title for that view, read off the old page's `metadata` (so a tab still says what it shows). */
export function viewTitle(mod: { metadata?: { title?: unknown } } | undefined, fallback: string): string {
  const t = mod?.metadata?.title;
  return typeof t === 'string' ? t : fallback;
}
