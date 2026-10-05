import 'server-only';

import { getCurrentUser } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { loadHostMembership } from '@/app/[slug]/_lib/loaders';
import { sanitizeRolePalette, type RolePalette } from '@/lib/mood-board';
import { boardIsTheCouples } from '@/lib/mood-board-palette-set';

/**
 * 🎨 WHICH BOARD THE GALLERY'S SAMPLE WEARS — read on the server, never typed
 * into a URL (owner 2026-10-05, "THE MOOD BOARD PALETTE IS THE PRIORITY"; the
 * sample page and the sample print door are UNAUTHENTICATED doors, so they must
 * not draw an arbitrary palette for anyone who asks).
 *
 * The request names one of a small fixed set (`sampleBoardQuery`):
 *   · nothing          → `undefined`: the sample's own board;
 *   · `palette=none`   → `null`: each theme in its own colours;
 *   · `board=<event>`  → THAT event's Mood Board, only when the signed-in viewer
 *     hosts it and the board is the couple's own; otherwise `null`.
 * Colours are all it can change; it reads one column of one event the viewer
 * already hosts.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function sampleBoardFor(search: {
  palette?: string | null;
  board?: string | null;
}): Promise<RolePalette | null | undefined> {
  if (search.palette === 'none') return null;
  const eventId = search.board;
  if (typeof eventId !== 'string' || !UUID.test(eventId)) return undefined;
  const viewer = await getCurrentUser().catch(() => null);
  if (!viewer) return null;
  const admin = createAdminClient();
  if (!(await loadHostMembership(admin, eventId, viewer.id).catch(() => false))) return null;
  const { data, error } = await admin.from('events').select('role_palette').eq('event_id', eventId).maybeSingle();
  if (error) logQueryError('sampleBoardFor.read', error, { event_id: eventId });
  if (error || !data) return null;
  const board = (data as { role_palette?: unknown }).role_palette;
  return boardIsTheCouples(board) ? sanitizeRolePalette(board) : null;
}
