import type { MoodBoardActions } from '@/app/dashboard/[eventId]/studio/mood-board/_components/mood-board-actions-context';

/**
 * 🧪 THE LAB'S STAND-INS FOR STUDIO › MOOD BOARD & DRESS CODE'S WRITES (DEV-ONLY — `/dev/maker-lab?studio=1`,
 * `/dev/details-lab?studio=1`). A plain module with NO action imported, so a guard can load it and prove what they answer.
 *
 * The lab draws the REAL page on fixtures; its presses used to reach the real actions (a colour pick, an outfit, a photo, a Do's &
 * Don'ts edit, a supplier's change undone). These succeed LOCALLY and write nothing; a photo is kept in the browser's memory only.
 * With `&refuse=1` they REFUSE with the database's own words, on purpose, so the plain refusal (`a-host-never-reads-database-words`)
 * can be SEEN — the page must say one plain sentence of its own and never print these.
 */
export const LAB_MOOD_BOARD_ACTIONS: Partial<MoodBoardActions> = {
  hubDraftAction: async () => ({ ok: true, intent: 'save', applied: 0, held: [] }),
  rejectColourChange: async () => ({ status: 'ok' }),
  uploadMoodboardSlot: async (fd) => {
    const file = fd.get('file');
    /* The photo stays in this browser tab; a reload forgets it. */
    const url = typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function' && file instanceof Blob ? URL.createObjectURL(file) : 'data:image/gif;base64,R0lGODlhAQABAAAAACw=';
    return { status: 'ok', image_url: url };
  },
  removeMoodboardSlot: async () => ({ status: 'ok' }),
  applyGalleryPick: async () => ({ status: 'error', message: 'The lab has no supplier gallery.' }),
  fetchGalleryAssets: async () => ({ assets: [], total: 0, hiddenCount: 0 }) as never,
  updateDressCodeLists: async () => undefined,
};

/** `?refuse=1`: the writes REFUSE with the database's own words (or throw), on purpose. */
export const LAB_MOOD_BOARD_REFUSALS: Partial<MoodBoardActions> = {
  hubDraftAction: async () => ({ ok: false, intent: 'save', error: 'new row violates row-level security policy for table "events"' }),
  rejectColourChange: async () => ({ status: 'error', message: 'column event_colour_changes.reverted_at does not exist' }),
  uploadMoodboardSlot: async () => ({ status: 'error', message: 'invalid input syntax for type uuid: "lab"' }),
  removeMoodboardSlot: async () => ({ status: 'error', message: 'invalid input syntax for type uuid: "lab"' }),
  updateDressCodeLists: async () => {
    throw new Error('permission denied for table events');
  },
};
