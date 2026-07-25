import { PhaseEditor } from '../_components/site-editor';
import { loadSiteEditorData } from '../_data';

export const metadata = { title: 'RSVP page editor' };

/**
 * /site-editor/[eventId]/rsvp — the standalone RSVP-part editor (the Studio
 * "RSVP" card). One of the four website parts; same machinery as the combined
 * editor's RSVP tab (PhaseEditor + the shared loader), but on its own
 * full-screen route. See ../_data.ts for the auth + data contract and
 * ../_components/site-editor.tsx PhaseEditor for the UI.
 */
export default async function RsvpEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const props = await loadSiteEditorData(eventId, `/site-editor/${eventId}/rsvp`);
  return <PhaseEditor {...props} phase="rsvp" />;
}
