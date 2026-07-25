import { PhaseEditor } from '../_components/site-editor';
import { loadSiteEditorData } from '../_data';

export const metadata = { title: 'Editorial editor' };

/**
 * /site-editor/[eventId]/editorial — the standalone Editorial-part editor (the
 * Studio "Editorial" card): the after-the-day story + gallery + thank-you. Same
 * machinery as the combined editor's Editorial tab (PhaseEditor + the shared
 * loader), on its own full-screen route. See ../_data.ts +
 * ../_components/site-editor.tsx.
 */
export default async function EditorialEditorPage({
  params,
}: {
  params: Promise<{ eventId: string }>;
}) {
  const { eventId } = await params;
  const props = await loadSiteEditorData(eventId, `/site-editor/${eventId}/editorial`);
  return <PhaseEditor {...props} phase="editorial" />;
}
