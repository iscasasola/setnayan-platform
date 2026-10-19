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
     "Dr." Eduardo Santos above says neither father nor mother by title; walking beside "Mrs." Lourdes, the pair names
     him Father of the Bride (`withThePairInferred`, owner 2026-10-17). */
  ['gm1', 'Ms.', 'Juana', 'Sarmiento', 'groom_grandparents', 20, 0],
  ['gm2', 'Ms.', 'Maxima', 'Sarmiento', 'groom_grandparents', 20, 1],
  /* A lone Groomsman beside the lone Bridesmaid above — /maria-and-jose's crew as the controller found it live on
     2026-10-17 (two crew members, no pair, so no column words drawn). */
  ['gmen3', 'Mr.', 'Gabriel', 'Castillo', 'groomsman', 21, 0],
];
/** In the lone cast the Maid of Honor and the Best Man do not walk together (the same live state): she walks alone. */
const LONE_WALKS: Record<string, number> = { moh: 22 };

/**
 * 👪 `&cast=cale` on `?entourage=` — the groom's parents in the shape live /cale-ice had on 2026-10-17 (owner's
 * screenshot, "Standing with us · PARENTS"): a father titled "Mr." and a mother titled "Atty.", her attire left at
 * its default. Before `parentWordOf` paired them she read "Parent of the Groom"; the owner: "mother of the groom".
 * Stand-in names in the same shape (a middle initial, a hyphenated married surname).
 */
const CALE_PARENTS: Row[] = [
  ['gp1', 'Mr.', 'Manolo C.', 'Dela Cruz', 'groom_parents', 1, 0],
  ['gp2', 'Atty.', 'Eufemia M.', 'Sacdalan-Dela Cruz', 'groom_parents', 1, 1],
];

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

/** 🏷 `&sections=vip` (2026-10-19): two of the couple's siblings (stand-in names) under Immediate Family, renamed "VIP". */
const VIP_ROWS: Row[] = [
  ['if1', 'Ms.', 'Bianca', 'Santos', 'bride_immediate_family', 18, 0],
  ['if2', 'Mr.', 'Marco', 'Dela Cruz', 'groom_immediate_family', 18, 1],
];
export const LAB_VIP_SECTION_NAMES = { 'section:immediate_family': { one: 'VIP' } } as const;

export function labEntourage(cast: 'sample' | 'standin' | 'lone' | 'cale' | 'titles' | 'man' | 'vip' | 'vip-usual' = 'sample') {
  /* 👫 A `lab_cast=standin` cookie: the owner's REAL entourage in shape (85 rows — roles, walks, 21 Ninongs to 17
     Ninangs), every name a stand-in (`lib/the-entourage-second-column-is-the-partner.cast.json`) — what the
     2026-10-15 entourage styles were drawn and walked on. */
  if (cast === 'standin') return buildEntourage(STAND_IN_CAST, null, null, DEFAULT_NAME_STYLE);
  /* 🤵‍♂️ `man` (2026-10-19): the sample with its maid of honor a MAN OF HONOR — a stand-in name, same walk and place. */
  const asMan: Row[] = ROWS.map((r) => (r[0] === 'moh' ? ['moh', 'Mr.', 'Carlo', 'Reyes', 'man_of_honor', r[5], r[6]] : r));
  const cast0 = cast === 'cale' ? [...CALE_PARENTS, ...ROWS.filter((r) => r[4] !== 'groom_parents')] : cast === 'man' ? asMan : ROWS;
  const vip = cast === 'vip' || cast === 'vip-usual';
  const rows: EntourageGuestRow[] = (cast === 'lone' ? [...ROWS, ...LONE_ROWS] : vip ? [...ROWS, ...VIP_ROWS] : cast0).map(([id, prefix, first, last, role, walk, place]) => ({
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
  return buildEntourage(rows, null, cast === 'vip' ? LAB_VIP_SECTION_NAMES : null, DEFAULT_NAME_STYLE);
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
 * 🪞 `?attire=cale` — cale-ice's dress code EXACTLY as production held it on 2026-10-17 (read SELECT-only by the
 * controller, before the owner's 06:32Z Apply): the men of VIP · Family saved as the old word "formal", three per-ROLE
 * picks the Studio has no row for (best man · best woman · the groom's parents — one "Long gown" for a mixed pair), six
 * colours typed into the old dress-code panel beside the Mood Board's five, and no Wear yet for the bride, the groom,
 * the groomsmen or the guests. `?attire=cale-now` is the same event after that Apply (every Studio row picked).
 * Fixture only; nothing here reaches a guest.
 */
export function labCaleIceDressConfig(after = false, honour = false, man = false) {
  const before = {
    dos: ['Lean into the palette'],
    donts: ['No white or ivory'],
    roles: { best_man: { style: 'suit' }, best_woman: { style: 'long_gown' }, groom_parents: { style: 'long_gown' } } as Record<string, { style: string }>,
    title: '',
    women: { groups: { vip_family: { style: 'long_gown' }, principal_sponsors: { style: 'long_gown' } } } as Record<string, unknown>,
    groups: { vip_family: { style: 'formal' }, bridesmaids: { style: 'long_gown' }, principal_sponsors: { style: 'suit' }, secondary_sponsors: { style: 'suit' } } as Record<string, { style: string }>,
    palette: ['#351115', '#646B38', '#F3E5B9', '#E6C0B3', '#803236', '#6B4226'].map((hex) => ({ hex, name: hex })),
    description: '',
    show_figure: true,
  };
  if (!after) return before;
  /* 👯 `?attire=cale-honour` — after the couple dresses the two honour rows (2026-10-19): the maid of honor in a cocktail
     dress, the best man in a tuxedo, the best woman in a Filipiniana; one call time and one note per row. */
  const honourRoles = honour
    ? { maid_of_honor: { style: 'cocktail_dress', callTime: '13:30', note: 'Dusty rose, not pink' }, best_man: { style: 'tuxedo', callTime: '13:00' } }
    : {};
  return {
    ...before,
    roles: { ...before.roles, bride: { style: 'ball_gown' }, groom: { style: 'three_piece_suit' }, guest: { style: 'suit' }, ...honourRoles },
    women: {
      /* 🤵‍♂️ `?attire=man-honour` (2026-10-19): the maid's row's FOR MEN column — the man of honor in a Barong Tagalog. */
      roles: { guest: { style: 'long_gown' }, ...(honour ? { best_man: { style: 'filipiniana' } } : {}), ...(man ? { maid_of_honor: { style: 'barong_tagalog' } } : {}) },
      groups: {
        vip_family: { style: 'long_gown', colours: ['#5C0700', '#248191', '#3E3350'] },
        principal_sponsors: { style: 'long_gown', colours: ['#8B7E74', '#6C6C6C'] },
        secondary_sponsors: { style: 'long_gown', colours: ['#5C0700', '#5C0700', '#5C0700'] },
        bearers_flower_girl: { style: 'tulle_dress' },
      },
    },
    groups: {
      groomsmen: { style: 'suit' },
      vip_family: { style: 'suit' },
      bridesmaids: { style: 'long_gown' },
      principal_sponsors: { style: 'suit' },
      secondary_sponsors: { style: 'suit' },
      bearers_flower_girl: { style: 'vest_and_bow_tie' },
    },
  };
}
/** cale-ice's `role_palette` beside `labCaleIceDressConfig` (the same two reads). */
export function labCaleIceRolePalette(after = false) {
  const shared = {
    guest: ['#6B4226', '#C9A0A0', '#191970', '#5C2542'],
    best_man: ['#803236'],
    reception: ['#5C0700', '#669C35', '#B51A00', '#F7F2EC', '#CFAFAF'],
    bridesmaids: ['#646B38', '#B51A00'],
    maid_of_honor: ['#803236'],
    palette_style: 'simple',
    wedding_party: ['#6B4226', '#C9A0A0', '#191970', '#5C2542'],
  };
  if (!after) {
    return {
      ...shared,
      bride: ['#FFFFFF', '#FFFFFF'],
      groom: ['#FFFFFF', '#FFFFFF'],
      groomsmen: ['#646B38'],
      principal_sponsors: ['#8B7E74', '#6C6C6C'],
      secondary_sponsors: ['#7A8B6F'],
      parents_immediate_family: ['#5C0700', '#669C35', '#B51A00'],
      touched_roles: ['best_man', 'bride', 'bridesmaids', 'groom', 'groomsmen', 'guest', 'maid_of_honor', 'parents_immediate_family', 'principal_sponsors', 'secondary_sponsors', 'wedding_party'],
    };
  }
  return {
    ...shared,
    guest: ['#5C2542', '#191970', '#C9A0A0', '#6B4226'],
    bride: ['#F7F2EC', '#F3DDE3'],
    groom: ['#F7F2EC', '#FFFFFF', '#FFFFFF'],
    groomsmen: ['#2C2A29', '#006400', '#669C35'],
    principal_sponsors: ['#2C2A29', '#808080', '#8B7E74'],
    secondary_sponsors: ['#2C2A29', '#006400', '#669C35'],
    bearers_flower_girl: ['#5C0700', '#5C0700'],
    parents_immediate_family: ['#2C2A29', '#2C2A29', '#5C0700'],
    touched_roles: ['bearers_flower_girl', 'best_man', 'bride', 'bridesmaids', 'groom', 'groomsmen', 'guest', 'maid_of_honor', 'parents_immediate_family', 'principal_sponsors', 'secondary_sponsors', 'wedding_party'],
  };
}
/** cale-ice's role names (`events.role_names`, same read). */
export const LAB_CALE_ICE_ROLE_NAMES = {
  groomsman: { one: "Groom's Crew" },
  bridesmaid: { one: "Bride's Crew" },
  principal_sponsor_ninang: { one: 'Ninang' },
  principal_sponsor_ninong: { one: 'Ninong' },
};
/**
 * cale-ice's guest list, by role — the shape `guestRoleTally` hands `studioAttireRows` (read SELECT-only 2026-10-17:
 * bride · groom · parents and immediate family · principal, candle, cord and veil sponsors · bridesmaids and maids of
 * honor · groomsmen, best men and a best woman · bearers and flower girls · 20 guests; five honour attendants, measured
 * 2026-10-19). The lab builds its Attire rows from it with the Maker's own `studioAttireRows`, never a typed copy.
 */
export const LAB_CALE_ICE_ROLE_TALLY = [
  { role: 'bride', count: 1 },
  { role: 'groom', count: 1 },
  { role: 'bride_parents', count: 2 },
  { role: 'groom_parents', count: 2 },
  { role: 'groom_immediate_family', count: 2 },
  { role: 'principal_sponsor_ninong', count: 20 },
  { role: 'principal_sponsor_ninang', count: 20 },
  { role: 'candle_sponsor', count: 2 },
  { role: 'cord_sponsor', count: 2 },
  { role: 'veil_sponsor', count: 2 },
  { role: 'maid_of_honor', count: 2 },
  { role: 'bridesmaid', count: 12 },
  { role: 'best_man', count: 2 },
  { role: 'best_woman', count: 1 },
  { role: 'groomsman', count: 13 },
  { role: 'ring_bearer', count: 2 },
  { role: 'bible_bearer', count: 1 },
  { role: 'flower_girl', count: 2 },
  { role: 'guest', count: 20 },
] as const;
/** 🤵‍♂️ `?attire=man-honour` — the same guest list with a man of honor beside the two maids of honor (2026-10-19). */
export const LAB_MAN_OF_HONOR_ROLE_TALLY = [...LAB_CALE_ICE_ROLE_TALLY, { role: 'man_of_honor', count: 1 }] as const;

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

/**
 * 🎭 `?as=…&asrole=<role>-<f|m>` — See as · Role ▾ on the lab's canvas (owner 2026-10-17, "view it as a father of the
 * bride"): cale-ice's own dress code (its export, colour for colour), with the VIP family and the principal sponsors as
 * TWO picks — the men in a barong in the row's colours, the women in a Filipiniana / long gown in THEIR own — so the
 * Role pick shows the mixed pair. Fixture only; nothing here reaches a guest.
 */
export function labCaleRoleDressConfig() {
  return {
    title: '',
    dos: ['Lean into the palette'],
    donts: ['No white or ivory'],
    palette: ['#351115', '#646B38', '#F3E5B9', '#E6C0B3', '#803236', '#6B4226'].map((hex) => ({ name: hex, hex })),
    roles: { best_man: { style: 'suit' }, best_woman: { style: 'long_gown' } },
    groups: {
      vip_family: { style: 'barong_tagalog' },
      /* ⏰ Call times, as Studio › Attire sets them per row (2026-10-18) — read as a ninang / a bridesmaid via See as. */
      principal_sponsors: { style: 'barong_tagalog', callTime: '14:00' },
      secondary_sponsors: { style: 'long_gown' },
      bridesmaids: { style: 'long_gown', callTime: '12:30' },
    },
    women: { groups: { vip_family: { style: 'filipiniana', colours: ['#E6C0B3', '#F3E5B9'] }, principal_sponsors: { style: 'long_gown' } } },
    show_figure: true,
  };
}
export function labCaleRoleRolePalette() {
  return {
    reception: [...LAB_CALE_BOARD],
    parents_immediate_family: ['#5C0700', '#669C35', '#B51A00'],
    principal_sponsors: ['#8B7E74', '#6C6C6C'],
    secondary_sponsors: ['#646B38'],
    bridesmaids: ['#646B38', '#B51A00'],
    guest: ['#6B4226', '#C9A0A0', '#191970', '#5C2542'],
    touched_roles: ['parents_immediate_family', 'principal_sponsors', 'secondary_sponsors', 'bridesmaids', 'guest'],
  };
}
