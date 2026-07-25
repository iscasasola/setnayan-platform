import { SiteEditor } from './_components/site-editor';
import { loadSiteEditorData } from './_data';

export const metadata = { title: 'Website editor' };

/**
 * /site-editor/[eventId] — full-screen, Reels-style wedding-website editor.
 * This is the COMBINED editor (the Studio "Whole website" card): all four
 * parts — Settings · RSVP · Event · Editorial — as tabs in one surface. Each
 * part also has its own standalone editor at /site-editor/[eventId]/<phase>
 * (the RSVP / Event / Editorial Studio cards), built from the same per-phase
 * cards via the PhaseEditor component.
 *
 * WHY a TOP-LEVEL route (sibling of /dashboard, /vendors, /v) instead of a
 * child of /dashboard/[eventId]: the owner's spec (CLAUDE.md 2026-05-31
 * "Reels-style editor") requires a full-screen takeover that leaves all
 * dashboard chrome behind, with a ✕ top-left to return. Next.js nested layouts
 * COMPOSE — a route under dashboard/[eventId]/layout.tsx cannot strip that
 * layout's sidebar + bottom-nav. So the editor must live outside EventLayout's
 * subtree. The root app/layout.tsx still wraps this route, so ThemeProvider +
 * the FOUC theme script are intact.
 *
 * AUTHORIZATION + DATA: both live in the shared loader (./_data.ts) so this
 * editor and the three phase editors agree on the membership gate, the
 * register-to-use gate, and exactly what they show.
 */
export default async function SiteEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const props = await loadSiteEditorData(eventId, `/site-editor/${eventId}`);
  return <SiteEditor {...props} />;
}
