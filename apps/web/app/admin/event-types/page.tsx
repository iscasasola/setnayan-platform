import { redirect } from 'next/navigation';

/**
 * /admin/event-types RETIRED 2026-07-03 → folded into the Taxonomy Studio's
 * Vocabularies rail (Taxonomy Studio PR 7). The event-type roster — the couple-
 * launch `enabled` lever, the picker-card presentation fields, and retire/
 * un-retire — now lives in /admin/taxonomy under Vocabularies → Event types,
 * alongside the category-scoping controls (one bucket, two clearly-separated
 * grains). This redirect keeps old bookmarks + deep-links working; nav entries
 * were removed. The per-type sub-editors (categories · profile · onboarding)
 * still live under this route and are reached from the Studio bucket rows.
 */
export const metadata = { title: 'Event Types · Admin' };

export default function EventTypesRedirect() {
  redirect('/admin/taxonomy?view=vocab-event');
}
