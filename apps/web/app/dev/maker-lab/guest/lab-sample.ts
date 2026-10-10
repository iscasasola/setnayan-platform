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
