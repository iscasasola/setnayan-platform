import type { MoodBoardActions } from '@/app/dashboard/[eventId]/studio/mood-board/_components/mood-board-actions-context';
import type { CouplePhotoShareReply } from '@/lib/couple-photo-share';

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
  applyGalleryPick: async () => ({ status: 'error', message: 'The lab has no supplier Inspiration.' }),
  fetchGalleryAssets: async () => ({ assets: [], total: 0, hiddenCount: 0 }) as never,
  updateDressCodeLists: async () => undefined,
  /* 🤝🖼 A supplier's suggestion kept / declined / its Keep undone — answered here; the Palette moves the photo itself. */
  keepInspirationSuggestion: async () => ({ status: 'ok', slotPosition: 0, replaced: false }),
  declineInspirationSuggestion: async () => ({ status: 'ok' }),
  undoMoodBoardChange: async () => ({ status: 'ok' }),
  /* ⏰ The guests' call time — the Schedule's own writers answer like the real ones (they return nothing, or throw). */
  updateScheduleBlock: async () => undefined,
  createScheduleBlock: async () => undefined,
  /* 📸 Share a photo with a supplier — the lab's own two linked shops; a send waits, a take-back answers ok (nothing is written). */
  couplePhotoShare: async (req): Promise<CouplePhotoShareReply> => {
    switch (req.op) {
      case 'read':
        return { op: 'read', result: { status: 'ok', shareable: true, inspirationId: 'lab-photo', cards: LAB_PHOTO_SHARE_CARDS, shares: [], namesCredit: 'Ana & Ben · Feb 2027', defaultAudience: 'exclusive' } };
      case 'send':
        return { op: 'send', result: { status: 'ok', shareId: 'lab-share', shop: LAB_PHOTO_SHARE_CARDS.find((c) => c.vendorServiceId === req.vendorServiceId)?.shop ?? 'Bloom & Co.' } };
      case 'take_back':
        return { op: 'take_back', result: { status: 'ok' } };
      case 'answer':
        return { op: 'answer', result: { status: 'ok', approved: req.approve, line: 'Approved — it is on your service card now.' } };
      case 'audience':
        return { op: 'audience', result: { status: 'ok' } };
      case 'viewer_looks':
        return { op: 'viewer_looks', result: {} };
    }
  },
};

/** 📸 The lab's linked shops' cards (fixtures — no database). */
export const LAB_PHOTO_SHARE_CARDS = [
  { vendorServiceId: 'lab-card-bouquet', title: 'Garden bridal bouquet', shop: 'Bloom & Co.' },
  { vendorServiceId: 'lab-card-centre', title: 'Table centrepieces', shop: 'Bloom & Co.' },
  { vendorServiceId: 'lab-card-styling', title: 'Full reception styling', shop: 'Hacienda Décor' },
];

/** `?refuse=1`: the writes REFUSE with the database's own words (or throw), on purpose. */
export const LAB_MOOD_BOARD_REFUSALS: Partial<MoodBoardActions> = {
  hubDraftAction: async () => ({ ok: false, intent: 'save', error: 'new row violates row-level security policy for table "events"' }),
  rejectColourChange: async () => ({ status: 'error', message: 'column event_colour_changes.reverted_at does not exist' }),
  uploadMoodboardSlot: async () => ({ status: 'error', message: 'invalid input syntax for type uuid: "lab"' }),
  removeMoodboardSlot: async () => ({ status: 'error', message: 'invalid input syntax for type uuid: "lab"' }),
  updateDressCodeLists: async () => {
    throw new Error('permission denied for table events');
  },
  keepInspirationSuggestion: async () => ({ status: 'error' }),
  declineInspirationSuggestion: async () => ({ status: 'error' }),
  undoMoodBoardChange: async () => ({ status: 'error', message: 'permission denied for function undo_mood_board_change' }),
  updateScheduleBlock: async () => {
    throw new Error('new row violates check constraint "event_schedule_blocks_check"');
  },
  createScheduleBlock: async () => {
    throw new Error('permission denied for table event_schedule_blocks');
  },
  couplePhotoShare: async (req): Promise<CouplePhotoShareReply> =>
    req.op === 'send'
      ? { op: 'send', result: { status: 'refused', message: 'permission denied for function couple_share_photo_with_supplier' } }
      : req.op === 'read'
        ? { op: 'read', result: { status: 'error' } }
        : req.op === 'take_back'
          ? { op: 'take_back', result: { status: 'error' } }
          : req.op === 'audience'
            ? { op: 'audience', result: { status: 'error' } }
            : req.op === 'viewer_looks'
              ? { op: 'viewer_looks', result: {} }
              : { op: 'answer', result: { status: 'refused', message: 'permission denied for function vendor_answer_couple_photo' } },
};
