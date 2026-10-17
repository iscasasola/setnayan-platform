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

/**
 * 🧍 `?entourage=` — the sample plus two more people who walk ALONE, so every kind of group holds a lone person
 * (owner 2026-10-17, DECISION_LOG "A LONE PERSON IN THE ENTOURAGE / WEDDING MARCH / STANDING WITH US IS CENTRED"):
 * a Ninang with no Ninong is already in the sample (ps13, a sided group), the Ring Bearer and the Flower Girl walk
 * alone in groups of one role; these add a lone Coin sponsor (a by-role group) and a lone Bridesmaid (a group whose
 * two columns are two roles). Every name is a stand-in.
 */
const LONE_ROWS: Row[] = [
  ['cn1', 'Mr.', 'Ramon', 'Ilagan', 'coin_sponsor', 18, 0],
  ['bmaid3', 'Ms.', 'Lea', 'Navarro', 'bridesmaid', 19, 0],
  /* 👵 TWO GRANDPARENTS, IN THE OWNER'S SHAPE (owner 2026-10-17, "the 2 grandparents should not be named immediate
     family"): cale-ice's two, read SELECT-only that day, are `groom_immediate_family`, titled "Ms.", `relation` empty.
     Here they are AFTER the couple re-picks their role on the guest card — `groom_grandparents` (migration
     20271271089555) — so the lab draws them under "Grandparents", each "Grandmother of the Groom". Stand-in names.
     The unknown-sex parent is already above: "Dr." Eduardo Santos, whose title says neither father nor mother. */
  ['gm1', 'Ms.', 'Juana', 'Sarmiento', 'groom_grandparents', 20, 0],
  ['gm2', 'Ms.', 'Maxima', 'Sarmiento', 'groom_grandparents', 20, 1],
  /* A lone Groomsman beside the lone Bridesmaid above — /maria-and-jose's crew as the controller found it live on
     2026-10-17 (two crew members, no pair, so no column words drawn). */
  ['gmen3', 'Mr.', 'Gabriel', 'Castillo', 'groomsman', 21, 0],
];
/** In the lone cast the Maid of Honor and the Best Man do not walk together (the same live state): she walks alone. */
const LONE_WALKS: Record<string, number> = { moh: 22 };

/** The sample entourage, as `loadEntourage` hands it to the page: grouped and ordered by the real builder. */
/**
 * 🪪 `titles` — the sample with its parents' titles as cale-ice holds them (owner 2026-10-17): the groom's mother an
 * "Atty." picked as "Atty. (Woman)", the bride's father a "Dr." picked as "Dr. (Man)" (`guests.gender`). Before the
 * pick both printed "Parent of the …"; now "Mother of the Groom" / "Father of the Bride". The title alone prints.
 */
const TITLE_PICKS: Record<string, { name_prefix: string; gender: 'woman' | 'man' }> = {
  gp2: { name_prefix: 'Atty.', gender: 'woman' },
  bp1: { name_prefix: 'Dr.', gender: 'man' },
};

export function labEntourage(cast: 'sample' | 'standin' | 'lone' | 'titles' = 'sample') {
  /* 👫 A `lab_cast=standin` cookie: the owner's REAL entourage in shape (85 rows — roles, walks, 21 Ninongs to 17
     Ninangs), every name a stand-in (`lib/the-entourage-second-column-is-the-partner.cast.json`) — what the
     2026-10-15 entourage styles were drawn and walked on. */
  if (cast === 'standin') return buildEntourage(STAND_IN_CAST, null, null, DEFAULT_NAME_STYLE);
  const rows: EntourageGuestRow[] = (cast === 'lone' ? [...ROWS, ...LONE_ROWS] : ROWS).map(([id, prefix, first, last, role, walk, place]) => ({
    guest_id: id,
    name_prefix: prefix,
    first_name: first,
    last_name: last,
    role,
    extra_roles: [],
    march: { walk_no: cast === 'lone' ? (LONE_WALKS[id] ?? walk) : walk, place_in_walk: place },
    ...(cast === 'titles' ? TITLE_PICKS[id] : {}),
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

/**
 * 👗 `?attire=shared` — the dress code as a couple who set it BEFORE the men/women split holds it (the shape cale-ice's
 * live dress code holds, read SELECT-only 2026-10-16): the sponsors' row has ONE Wear for everybody, and it is a
 * women's one ("Long gown"); no `women` part at all. The owner: "the drawing is not following the type of attire".
 */
export function labSharedAttireDressConfig(board: readonly string[]) {
  const { women: _split, ...rest } = labDressConfig(board);
  return { ...rest, groups: { ...rest.groups, principal_sponsors: { style: 'long_gown' } } };
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

/**
 * 👔 `?attire=roles` — THE PER-ROLE ATTIRE WALK (owner 2026-10-16, "APPROVED — ALL 45 ROLE × DESIGN DRAWINGS"), in
 * cale-ice's own colours (Rosewood · Pandan Green · Cream · Olive Grove · Marigold · Narra Brown). Each role wears one of
 * ITS designs; `&groom=` · `&bride=` · `&men=` · `&women=` · `&boys=` · `&girls=` pick another (the sponsors' men and
 * women, the bearers' boys and girls) so every drawing can be walked from the URL. The guests offer FIVE colour options.
 * Fixture only; nothing here reaches a guest.
 */
export const LAB_CALE_ICE = { rosewood: '#5C0700', pandan: '#669C35', cream: '#F7F2EC', olive: '#646B38', marigold: '#F3E5B9', narra: '#6B4226' } as const;
export function labRolesDressConfig(pick: Partial<Record<'groom' | 'bride' | 'men' | 'women' | 'boys' | 'girls' | 'gm' | 'gw', string>> = {}) {
  return {
    title: 'Formal, in our colours',
    roles: { bride: { style: pick.bride ?? 'mermaid' }, groom: { style: pick.groom ?? 'three_piece_suit' }, guest: { style: pick.gm ?? 'barong_tagalog' } },
    groups: {
      principal_sponsors: { style: pick.men ?? 'suit' },
      bridesmaids: { style: 'filipiniana' },
      groomsmen: { style: 'vest_and_tie' },
      bearers_flower_girl: { style: pick.boys ?? 'vest_and_bow_tie' },
    },
    women: {
      groups: { principal_sponsors: { style: pick.women ?? 'filipiniana' }, bearers_flower_girl: { style: pick.girls ?? 'tulle_dress' } },
      roles: { guest: { style: pick.gw ?? 'long_gown' } },
    },
  };
}
export function labRolesRolePalette() {
  const c = LAB_CALE_ICE;
  return {
    reception: [c.rosewood, c.pandan, c.cream, c.olive, c.marigold],
    bride: [c.cream],
    groom: [c.olive, c.marigold, c.cream, c.narra],
    principal_sponsors: [c.rosewood, c.marigold],
    bridesmaids: [c.pandan],
    groomsmen: [c.narra, c.olive],
    bearers_flower_girl: [c.olive],
    guest: [c.rosewood, c.pandan, c.olive, c.marigold, c.narra],
    touched_roles: ['bride', 'groom', 'principal_sponsors', 'bridesmaids', 'groomsmen', 'bearers_flower_girl', 'guest'],
  };
}
