/**
 * lib/studio-prints-six.ts — the pure halves of Studio › Prints' six (`studio-prints-six.tsx`; owner "approved" 2026-10-13).
 * No request, no React.
 */
import type { MenuMoment } from '@/lib/print-pieces';

/**
 * What the Menu posts as `menu_json` — EXACTLY what the old form's hidden input carried (`print-menu-editor.tsx`): blank dishes
 * dropped, every word trimmed (the server's parser drops and caps the rest). The quiet save sends this, byte for byte.
 */
export function menuPayload(moments: readonly MenuMoment[]): string {
  return JSON.stringify(moments.map((m) => ({ title: m.title.trim(), dishes: m.dishes.map((d) => d.trim()).filter(Boolean) })));
}

/** The toast after a quiet save — a good result, or a failure that says what failed (never the look of success). */
export function studioMenuSaveWords(ok: boolean): string {
  return ok ? 'Menu saved — the Menu card shows it' : 'Your menu did not save';
}

/** The ◆ note a free couple meets on "Download all tickets" (kind 20: shown, tappable, never a page jump). */
export const PASS_ZIP_PRO_NOTE = {
  title: 'Every ticket in one file is Event Hub Pro',
  body: 'With Event Hub Pro you save all your guests’ tickets at once. Each guest can still save their own ticket, free.',
} as const;

/**
 * 🗂 THE ◆ NOTES ON THE OTHER ALL-IN-ONE FILES (owner 2026-10-16, DECISION_LOG "PRINTS: ONE AT A TIME IS FREE — EVERY 'DOWNLOAD
 * ALL' IS EVENT HUB PRO") — the zip's note, said of each file. No price: the unlock page owns it. The route says the same words
 * when it refuses (`allInOneRefusal`).
 */
export const PASSES_PRO_NOTE = {
  title: 'Every guest’s pass in one file is Event Hub Pro',
  body: 'With Event Hub Pro you save all your guests’ passes at once. Each guest’s own pass still saves free, one at a time.',
} as const;
export const WHOLE_SET_PRO_NOTE = {
  title: 'The whole set in one file is Event Hub Pro',
  body: 'With Event Hub Pro you save every piece at once. Each piece’s own PDF still saves free.',
} as const;
/** What `/api/hub-print` says when it refuses an all-in-one file to an event without Event Hub Pro. */
export function allInOneRefusal(piece: string): string {
  const n = piece === 'passes' ? PASSES_PRO_NOTE : WHOLE_SET_PRO_NOTE;
  return `${n.title}. ${n.body}`;
}

/** Prints › Schedule — the printed programme lists only the moments for Everyone (controller 2026-10-13, 01:00 PHT). */
export const PRINT_SCHEDULE_TIP = 'Only the moments marked for Everyone print here. A moment for the entourage or a smaller circle stays off the paper.';

/** Prints › Kindly reply — the same stored line as Studio › RSVP's (owner's answer (1): two doors, one field — no link out). */
export const PRINT_KINDLY_REPLY_TIP =
  'Who guests reply to, printed on the card. A host or your coordinator is read from their account; or type your own line. It is the same line Studio › RSVP shows — change it in either place.';
