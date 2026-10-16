/**
 * lib/studio-prints-settings.ts — the pure halves of "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST PRINTS,
 * ALL GUESTS ◆, EVERYTHING ◆" (owner 2026-10-17, *"ok on prints"*; DECISION_LOG row of that date; prototype
 * `prototypes/prints_settings_and_downloads_2026-10-17.html`). No request, no React — the words the rows say and the lists they
 * pick from, so a guard can hold them.
 *
 *   · ⚙ PRINT SETTINGS — every switch and input that sat inside a piece row, in ONE sheet with the one Save (the same print
 *     words form, the same field names — `studio-prints-posts-the-same.test.ts`). The sheet's headings are `PRINT_SETTINGS_HEADS`.
 *   · A PIECE ROW — picture · name · size line · size ▾ · ONE Download (free).
 *   · A GUEST PRINT (Event pass · Digital ticket · Guest QR codes · Table signs & place cards) — ONE View as ▾ shared by all four
 *     (`guestPickOptions`), a Download for that guest (free), All guests ◆ (Event Hub Pro), and the line under both
 *     (`guestPrintCountLine`) — the number IS the file, never a guess.
 *   · EVERYTHING ◆ — the set, every guest's pass and place card, the day's sheets, in one PDF (Event Hub Pro).
 */

/** The ⚙ row's name and its one line — what the sheet holds (prototype `.band .gear`). */
export const PRINT_SETTINGS_LABEL = 'Print settings';
export const PRINT_SETTINGS_LINE = 'QR · NFC spot · words on the cards · passes · seat plan';

/** The sheet's headings, in the prototype's order. `line` is the small word at a heading's right. */
export const PRINT_SETTINGS_HEADS = {
  every: { title: 'On every print', line: 'QR · NFC spot' },
  invitation: { title: 'The invitation' },
  details: { title: 'The Finer Details' },
  passes: { title: 'Passes' },
  story: { title: 'Our Story poster' },
  seating: { title: 'Seat plan & the door' },
} as const;
export type PrintSettingsHead = keyof typeof PRINT_SETTINGS_HEADS;

/** Said once, under "On every print": the sizes stay on the rows (one home per decision). */
export const PRINT_SETTINGS_SIZES_LINE = 'Sizes are picked on each piece’s row, where its picture redraws.';

/** The four prints drawn for ONE guest at a time. The Event card is the event's, not a guest's — never here. */
export const GUEST_PRINT_KEYS = ['pass', 'digital-ticket', 'qr-codes', 'seating-pack'] as const;
export type GuestPrintKey = (typeof GUEST_PRINT_KEYS)[number];

export type PrintGuest = { id: string; name: string; reply: 'attending' | 'pending' | 'maybe' };

/**
 * View as ▾ — the guests, coming first, then not replied, then maybe, each group named with its count (prototype `guestItems`).
 * The house dropdown's groups; the order inside a group is the printed passes' own.
 */
export function guestPickOptions(guests: readonly PrintGuest[]): Array<{ key: string; label: string; group: string }> {
  const n = (r: PrintGuest['reply']) => guests.filter((g) => g.reply === r).length;
  const group: Record<PrintGuest['reply'], string> = {
    attending: `Coming · ${n('attending')}`,
    pending: `Not replied yet · ${n('pending')}`,
    maybe: `Maybe · ${n('maybe')}`,
  };
  return (['attending', 'pending', 'maybe'] as const).flatMap((r) => guests.filter((g) => g.reply === r).map((g) => ({ key: g.id, label: g.name, group: group[r] })));
}

/** A name as a file word — `bea-santillan` (the pass route's own rule). */
export function guestFileWord(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40) || 'guest';
}

const fmt = (n: number) => n.toLocaleString('en-PH');

/**
 * The line under a guest print's Download · All guests ◆ — what the all-guests file holds. The pass and the ticket count from the
 * file's own read (`loadPassGuestNames`, the ticket rule); the QR sheet and the place cards are not read here, so they say who
 * they hold without a number (never a guess). Unread (null), the line says who the file is for.
 */
export function guestPrintCountLine(key: GuestPrintKey, guests: readonly PrintGuest[] | null, size?: string): string {
  if (key === 'qr-codes') return 'Every guest’s own QR · 12 to an A4 page';
  if (key === 'seating-pack') return 'Seated guests only · with the table directory and a sign for every table';
  if (!guests || guests.length === 0) return key === 'pass' ? 'Guests who are coming' : 'One PNG per guest who is coming · .zip';
  const n = (r: PrintGuest['reply']) => guests.filter((g) => g.reply === r).length;
  if (key === 'digital-ticket') return `${fmt(guests.length)} ${guests.length === 1 ? 'ticket' : 'tickets'} · one PNG per guest who is coming · .zip`;
  const parts = [`${fmt(n('attending'))} coming`];
  if (n('pending') > 0) parts.push(`${fmt(n('pending'))} not replied yet`);
  if (n('maybe') > 0) parts.push(`${fmt(n('maybe'))} maybe`);
  return `${fmt(guests.length)} ${guests.length === 1 ? 'pass' : 'passes'} · ${parts.join(', ')}${size ? ` · ${size}` : ''} · ganged on A4 with cut lines`;
}

/** The token a guest print's addresses carry where the picked guest's id goes — the row swaps it in (`studio-prints-settings.tsx`). */
export const GUEST_TOKEN = '__GUEST__';
/** …and where the picked guest's name goes, as a file word. */
export const GUEST_WORD_TOKEN = '__GUESTWORD__';

/** The Everything ◆ row's words (prototype `.foot`). */
export function everythingLine(themeName: string): string {
  return `Every piece above in one PDF, in ${themeName} — the set, every guest’s pass and place card, the day’s sheets.`;
}
export const EVERYTHING_HEAD = { title: 'Everything', line: 'one file · Event Hub Pro' } as const;
export const EVERYTHING_LABEL = 'Download everything';
