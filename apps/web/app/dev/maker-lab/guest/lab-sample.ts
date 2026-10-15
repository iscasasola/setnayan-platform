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
import STAND_IN_JSON from '@/lib/the-entourage-second-column-is-the-partner.cast.json';

const STAND_IN_CAST = STAND_IN_JSON as unknown as EntourageGuestRow[];

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
  ['ps1', 'Hon.', 'Ricardo', 'Villanueva-Santos', 'principal_sponsor_ninong', 4, 0],
  ['ps2', 'Mrs.', 'Jessica Marie', 'Villanueva-Santos', 'principal_sponsor_ninang', 4, 1],
  ['ps3', 'Atty.', 'Cesar Emmanuel', 'Lim-Macapagal', 'principal_sponsor_ninong', 5, 0],
  ['ps4', 'Mrs.', 'Pilar', 'Lim-Macapagal', 'principal_sponsor_ninang', 5, 1],
  ['ps5', 'Dr.', 'Eduardo', 'Bautista', 'principal_sponsor_ninong', 6, 0],
  ['ps6', 'Ms.', 'Carmen Concepcion', 'Reyes', 'principal_sponsor_ninang', 6, 1],
  ['ps7', 'Engr.', 'Francisco Jose', 'Dimaculangan', 'principal_sponsor_ninong', 7, 0],
  ['ps8', 'Mrs.', 'Teresita', 'Dimaculangan', 'principal_sponsor_ninang', 7, 1],
  ['ps9', 'Gen.', 'Rodrigo', 'Pangilinan-Aquino', 'principal_sponsor_ninong', 8, 0],
  ['ps10', 'Mrs.', 'Maria Luisa', 'Pangilinan-Aquino', 'principal_sponsor_ninang', 8, 1],
  ['ps11', 'Mr.', 'Antonio', 'Garcia', 'principal_sponsor_ninong', 9, 0],
  ['ps12', 'Mrs.', 'Remedios', 'Garcia', 'principal_sponsor_ninang', 9, 1],
  ['ps13', 'Hon.', 'Felicidad', 'Mangubat-Evangelista', 'principal_sponsor_ninang', 10, 0],
  ['cs1', 'Mr.', 'Paolo', 'Cruz', 'candle_sponsor', 11, 0],
  ['cs2', 'Ms.', 'Beatriz', 'Cruz', 'candle_sponsor', 11, 1],
  ['vs1', 'Mr.', 'Miguel Angelo', 'Reyes', 'veil_sponsor', 12, 0],
  ['vs2', 'Ms.', 'Anna Patricia', 'Reyes', 'veil_sponsor', 12, 1],
  ['cd1', 'Mr.', 'Luis', 'Santos', 'cord_sponsor', 13, 0],
  ['cd2', 'Ms.', 'Kristine', 'Tolentino', 'cord_sponsor', 13, 1],
  ['bmaid1', 'Ms.', 'Joy', 'Alvarez', 'bridesmaid', 14, 0],
  ['gmen1', 'Mr.', 'Dennis', 'Alvarez', 'groomsman', 14, 1],
  ['bmaid2', 'Ms.', 'Rina', 'Chua', 'bridesmaid', 15, 0],
  ['gmen2', 'Mr.', 'Vince', 'Ong', 'groomsman', 15, 1],
  ['rb', null, 'Joaquin', 'Dela Cruz', 'ring_bearer', 16, 0],
  ['fg', null, 'Sofia', 'Reyes', 'flower_girl', 17, 0],
];

/** The sample entourage, as `loadEntourage` hands it to the page: grouped and ordered by the real builder. */
export function labEntourage(cast: 'sample' | 'standin' = 'sample') {
  /* 👫 A `lab_cast=standin` cookie: the owner's REAL entourage in shape (85 rows — roles, walks, 21 Ninongs to 17
     Ninangs), every name a stand-in (`lib/the-entourage-second-column-is-the-partner.cast.json`) — what the
     2026-10-15 entourage styles were drawn and walked on. */
  if (cast === 'standin') return buildEntourage(STAND_IN_CAST, null, null, DEFAULT_NAME_STYLE);
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
    /* 👗 What each role wears (2026-10-14) — so the lab draws the figures as a couple sets them: the sponsors and the
       guests each with TWO picks, the women's sponsors in a colour of their own (`dress_code_config.women`). */
    roles: { bride: { style: 'long_gown' }, groom: { style: 'barong_tagalog' }, guest: { style: 'smart_casual' } },
    groups: { principal_sponsors: { style: 'barong_tagalog', note: 'In the wedding colours' }, bridesmaids: { style: 'filipiniana' }, groomsmen: { style: 'suit' } },
    women: { groups: { principal_sponsors: { style: 'long_gown', colours: [board[2]] } }, roles: { guest: { style: 'cocktail_dress' } } },
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
    guest: [board[3], board[1]],
  };
}
