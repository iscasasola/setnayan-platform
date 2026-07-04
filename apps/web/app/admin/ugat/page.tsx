import { getUgatCounts } from '@/lib/ugat/data';
import { runSavedSearch } from '@/lib/ugat/data';
import { UGAT_SAVED_SEARCHES } from '@/lib/ugat/data';
import { UgatConsole } from './_components/ugat-console';

export const metadata = { title: 'Ugat · Admin' };

/**
 * /admin/ugat — the Ugat Console (slice 1).
 *
 * "Ugat" (Tagalog: root) is the live entity map — a port of the verified corpus
 * prototype (03_Strategy/Jarvis_Console_Prototype_2026-07-04.html). It shows the
 * nine platform entity types as nodes on a dark canvas, the schema-audited
 * connections between them as clickable edges/joints, and the 2026-07-05 audit's
 * health findings as an overlay. The console NAVIGATES the admin — it does not
 * replace it (the taxonomy node links to /admin/taxonomy, vendors to their admin
 * page, orders to the payments queue).
 *
 * WHAT IS LIVE (this slice): the nine type-node COUNTS (real DB reads, admin
 * service-role client, cached ~60s), the eight entity TABLES (paginated live
 * rows), and the ⌘K OMNIBOX (server search across vendors/events/users/orders/
 * taxonomy). WHAT IS STATIC (labelled as such in the UI): the joint/edge cards
 * (schema documentation, correct until the schema changes) and the health
 * findings (frozen 2026-07-05 audit registry — live telemetry is slice 2). Only
 * the PLATFORM (type-level) scope ships here; per-event/per-vendor row scopes
 * are slice 2.
 *
 * Access is gated by the admin layout (non-admins get a 404); the server actions
 * behind the tables + omnibox re-check admin as defense-in-depth.
 */
export default async function AdminUgatPage() {
  // One cached round trip for the nine counts; run the three saved searches so
  // the omnibox Questions group opens with live numbers.
  const [counts, savedSearches] = await Promise.all([
    getUgatCounts(),
    Promise.all(UGAT_SAVED_SEARCHES.map((s) => runSavedSearch(s.key))),
  ]);

  return <UgatConsole counts={counts} savedSearches={savedSearches} />;
}
