/**
 * 🧪 THE MAKER LAB'S SAMPLE ENTOURAGE AND DRESS CODE (DEV-ONLY — the lab has no database).
 *
 * Fixtures only — the DRAWING is the guest page's own: `EntourageSection` and `DressCodeWidget`. The entourage
 * is built by the REAL builder (`buildEntourage`, `lib/entourage.ts`) from guest rows shaped as the page's read
 * returns them, so groups, pairs and headings are what a guest sees — nothing here is a look-alike.
 * maria-and-jose's couple (Maria Santos · Jose Dela Cruz), plus 16 people who stand up with them.
 */
import { buildEntourage, type EntourageGuestRow } from '@/lib/entourage';
import { DEFAULT_NAME_STYLE } from '@/lib/name-style';

/**
 * 🧾 THE SAMPLE EVENT'S FACTS — ONE COPY (the walk of 2026-10-11, P07). Studio › Info said December 18 at The Garden
 * at Tagaytay, under the address "indalecio-and-claire", while the canvas, Look and Schedule said December 12 at Seda
 * Vertis North: the Studio pages are the details lab's, and it was handing the Maker another couple's facts. The
 * Maker lab's shell, its canvas and its Studio pages (`details-lab-node.tsx`, on `shape=mj`) all read these.
 */
export const LAB_SAMPLE = {
  names: 'Maria & Jose',
  slug: 'maria-and-jose',
  date: '2026-12-12',
  dateLabel: 'December 12, 2026',
  venue: 'Seda Vertis North',
  venueLine: 'Seda Vertis North, Quezon City',
  venueAddress: '1 Astra Way, Vertis North, Quezon City',
  openingLine: 'Together with their families',
  message: 'We cannot wait to celebrate with you.',
} as const;

/** [id, prefix, first, last, role, walk, place] — a walk is a pair walking together. */
type Row = [id: string, prefix: string | null, first: string, last: string, role: string, walk: number, place: number];

const ROWS: Row[] = [
  ['gp1', 'Mr.', 'Peregrino', 'Dela Cruz', 'groom_parents', 1, 0],
  ['gp2', 'Mrs.', 'Milagros', 'Dela Cruz', 'groom_parents', 1, 1],
  ['bp1', 'Dr.', 'Eduardo', 'Santos', 'bride_parents', 2, 1],
  ['bp2', 'Mrs.', 'Lourdes Reyes', 'Santos', 'bride_parents', 2, 0],
  ['moh', 'Ms.', 'Ana Reyes', 'Dela Cruz', 'maid_of_honor', 3, 1],
  ['bm', 'Mr.', 'Daniel', 'Ramos', 'best_man', 3, 0],
  ['ps1', 'Hon.', 'Ricardo', 'Villahermosa', 'principal_sponsor_ninong', 4, 0],
  ['ps2', 'Mrs.', 'Jessica', 'Villahermosa', 'principal_sponsor_ninang', 4, 1],
  ['ps3', 'Atty.', 'Cesar', 'Lim', 'principal_sponsor_ninong', 5, 0],
  ['ps4', 'Mrs.', 'Pilar', 'Lim', 'principal_sponsor_ninang', 5, 1],
  ['bmaid1', 'Ms.', 'Joy', 'Alvarez', 'bridesmaid', 6, 0],
  ['gmen1', 'Mr.', 'Dennis', 'Alvarez', 'groomsman', 6, 1],
  ['bmaid2', 'Ms.', 'Rina', 'Chua', 'bridesmaid', 7, 0],
  ['gmen2', 'Mr.', 'Vince', 'Ong', 'groomsman', 7, 1],
  ['rb', null, 'Joaquin', 'Dela Cruz', 'ring_bearer', 8, 0],
  ['fg', null, 'Sofia', 'Reyes', 'flower_girl', 9, 0],
];

/** The sample entourage, as `loadEntourage` hands it to the page: grouped and ordered by the real builder. */
export function labEntourage() {
  const rows: EntourageGuestRow[] = ROWS.map(([id, prefix, first, last, role, walk, place]) => ({
    guest_id: id,
    name_prefix: prefix,
    first_name: first,
    last_name: last,
    role,
    extra_roles: [],
    march: { walk_no: walk, place_in_walk: place },
  }));
  /* The lab has no event, so no chosen Name style: it is handed the default a NEW event has (`DEFAULT_NAME_STYLE`),
     the way every real caller hands the event's own (the-name-style-reaches-every-formal-surface). Section order and
     role names stay null = the built-in order and words, exactly what the omitted arguments meant. */
  return buildEntourage(rows, null, null, DEFAULT_NAME_STYLE);
}

/** The couple's dress code, as `events.dress_code_config` stores it — the lab's five colours, named. */
export function labDressConfig(board: readonly string[]) {
  const names = ['Oxblood', 'Olive', 'Marigold', 'Rosewood', 'Blush'];
  return {
    title: 'Garden formal, in warm earth tones',
    description: 'Long dresses and barongs or suits in the colours below. Please keep to soft, muted shades on the day.',
    dos: ['Barong Tagalog or a suit', 'Long or midi dresses'],
    donts: ['White or ivory', 'Jeans and sneakers'],
    palette: board.map((hex, i) => ({ name: names[i] ?? '', hex })),
  };
}

/** The Mood Board (`events.role_palette`) from the lab's own colours — "Our colours" and each role's row read it. */
export function labRolePalette(board: readonly string[]) {
  return {
    reception: board.slice(0, 3),
    bride: [board[4]],
    groom: [board[1]],
    bridesmaids: [board[3]],
    groomsmen: [board[1]],
    principal_sponsors: [board[0]],
  };
}

/**
 * 🎨 `?board=cale` — the palette prototype's REAL colours (`prototypes/palette_styles_2026-10-15_fable.html`,
 * cale-ice's `role_palette` + `dress_code_config`, exported there SELECT-only), so a palette look's lab shot can be
 * set beside the design it was built from colour for colour: the Mood Board's five reception colours lead, the six
 * typed in the dress-code editor follow (eleven in "Our colours"), and the Principal Sponsors wear Taupe — the one
 * real colour that takes the third ink step — and Dim Gray. Fixture only; nothing here reaches a guest.
 */
export const LAB_CALE_BOARD = ['#5C0700', '#669C35', '#B51A00', '#F7F2EC', '#CFAFAF'] as const;
export function labCaleDressConfig() {
  return {
    title: 'Formal',
    palette: [
      { name: 'Oxblood', hex: '#351115' },
      { name: 'Olive Grove', hex: '#646B38' },
      { name: 'Piña Cream', hex: '#F3E5B9' },
      { name: 'Blush', hex: '#E6C0B3' },
      { name: 'Burgundy', hex: '#803236' },
      { name: 'Narra Brown', hex: '#6B4226' },
    ],
    roles: { principal_sponsor_ninang: { style: 'long_gown' } },
  };
}
export function labCaleRolePalette() {
  return {
    reception: [...LAB_CALE_BOARD],
    parents_immediate_family: ['#5C0700', '#669C35', '#B51A00'],
    principal_sponsors: ['#8B7E74', '#6C6C6C'],
    touched_roles: ['parents_immediate_family', 'principal_sponsors'],
  };
}
