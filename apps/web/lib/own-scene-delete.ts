/**
 * lib/own-scene-delete.ts — THE ONE WAY A SCENE OF THEIR OWN IS DELETED.
 *
 * Shared by the live "Remove for good" (`saveCustomSection` intent=delete,
 * outside the Maker) and Apply (`hubDraftAction`), which runs a drafted removal
 * (owner 2026-10-07, *"remove for good"* as its own step: in the Maker the delete
 * waits for Apply and Undo brings the scene back). One query, so the two can
 * never disagree about what "deleted" means.
 *
 * 🔑 COUNT THE ROWS. A delete RLS refuses is not an error in PostgREST — it is
 * zero rows and a 204 — so the rows are asked back and counted: exactly one,
 * or it did not happen.
 *
 * Only a `custom_*` row may go (a SHIPPED section's row taken off the page has
 * no way back); the caller checks the type, and so does this.
 */
import { isCustomSectionType } from './custom-sections';

type DeleteClient = {
  from: (table: 'invitation_widgets') => {
    delete: () => {
      eq: (c: 'widget_id', v: string) => {
        eq: (c: 'event_id', v: string) => { select: (c: 'widget_id') => PromiseLike<{ data: unknown[] | null; error: { message: string } | null }> };
      };
    };
  };
};

export async function deleteOwnScene(
  supabase: unknown,
  eventId: string,
  row: { widget_id: string; widget_type: string },
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!isCustomSectionType(row.widget_type)) return { ok: false, error: 'That section is not one you write yourself.' };
  const { data, error } = await (supabase as DeleteClient)
    .from('invitation_widgets')
    .delete()
    .eq('widget_id', row.widget_id)
    .eq('event_id', eventId)
    .select('widget_id');
  if (error) return { ok: false, error: `Failed to remove your section: ${error.message}` };
  if (!data || data.length !== 1) return { ok: false, error: 'Your section could not be removed.' };
  return { ok: true };
}
