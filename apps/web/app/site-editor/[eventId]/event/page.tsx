import { PhaseEditor } from '../_components/site-editor';
import { loadSiteEditorData } from '../_data';

export const metadata = { title: 'Event-day page editor' };

/**
 * /site-editor/[eventId]/event — the standalone Event-part editor (the Studio
 * "Event" card): the live, day-of page guests open at the venue. Same machinery
 * as the combined editor's Event tab (PhaseEditor + the shared loader), on its
 * own full-screen route. See ../_data.ts + ../_components/site-editor.tsx.
 */
export default async function EventEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const props = await loadSiteEditorData(eventId, `/site-editor/${eventId}/event`);
  return <PhaseEditor {...props} phase="event" />;
}
