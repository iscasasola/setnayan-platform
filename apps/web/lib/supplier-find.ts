/**
 * supplier-find.ts — "Find a supplier": which categories an event sees, in
 * the groups a host thinks in.
 *
 * Owner-approved 2026-10-01 (`prototypes/supplier_inbox_and_find_2026-10-01_fable.html`
 * frames 4–6; DECISION_LOG "SUPPLIER INBOX + FIND-A-SUPPLIER DESIGN — APPROVED,
 * WITH BOTH RECOMMENDATIONS"): one search · "Popular for <type>" (a wake:
 * "What families usually need") · then Venue & food · Look & style · Photos &
 * video · Music & program · Paperwork, each category reading "Booked ✓" when
 * the host already booked one.
 *
 * ── WHAT THIS MODULE DOES NOT DECIDE ────────────────────────────────────────
 * 🔑 WHICH categories exist for an event is NOT decided here. The caller hands
 * in the bench's own folders — `buildShortlistFolders` with no vendor rows —
 * which already applies the three scope filters the bench has always applied:
 * `service_categories.applicable_event_types` (Admin › Event type › Scope
 * categories), `marketplace_hidden`, and the couple's faith. So Find a supplier
 * and the bench can never disagree about what a birthday may book, and there is
 * no second scope rule here to drift.
 *
 * This module only REGROUPS: the DB folders (tier 1) are the supplier's words
 * ("Booths, carts & bars", "Hosts, music & program"); the five groups below are
 * the host's. The DB tier names are unchanged — this is a page-level map.
 *
 * ── THE MAP IS EXHAUSTIVE BY TYPE ───────────────────────────────────────────
 * `FIND_GROUP_OF_TILE` is a `Record<WeddingTile, FindGroupId>`, so a new tile
 * added to the taxonomy without a group here fails `tsc` — it cannot silently
 * fall into "more". (A tile the DB knows and the code does not still lands in
 * `more` rather than vanishing.)
 */
import type { WeddingTile } from '@/lib/taxonomy';
import type { ShortlistFolder } from '@/lib/shortlist-taxonomy';

export type FindGroupId =
  | 'farewell'
  | 'venue_food'
  | 'look_style'
  | 'photos_video'
  | 'music_program'
  | 'paperwork'
  | 'more';

/** Page order. A group with no category in scope simply does not render. */
export const FIND_GROUP_ORDER: readonly FindGroupId[] = [
  'farewell',
  'venue_food',
  'look_style',
  'photos_video',
  'music_program',
  'paperwork',
  'more',
];

export const FIND_GROUP_OF_TILE: Readonly<Record<WeddingTile, FindGroupId>> = {
  // ── A wake's own service — only a wake is scoped to these.
  funeral_home: 'farewell',
  cremation: 'farewell',
  memorial_park: 'farewell',
  officiants: 'farewell',
  counseling_seminars: 'paperwork',
  // ── Venue & food
  reception: 'venue_food',
  ceremony_venue: 'venue_food',
  accommodation: 'venue_food',
  restaurant_reservation: 'venue_food',
  catering: 'venue_food',
  cake: 'venue_food',
  stations: 'venue_food',
  crew_meals: 'venue_food',
  dessert: 'venue_food',
  food_cart: 'venue_food',
  food_truck: 'venue_food',
  mobile_bar: 'venue_food',
  coffee_espresso: 'venue_food',
  mocktail: 'venue_food',
  chairs_tents: 'venue_food',
  // ── Look & style
  brides_attire: 'look_style',
  grooms_attire: 'look_style',
  womens_attire: 'look_style',
  mens_attire: 'look_style',
  filipiniana_barongs: 'look_style',
  hmua: 'look_style',
  grooming: 'look_style',
  wellness_fitness: 'look_style',
  jewelleries_accessories: 'look_style',
  stylist_decorator: 'look_style',
  florist: 'look_style',
  led_wall: 'look_style',
  dance_floor: 'look_style',
  outdoor: 'look_style',
  fireworks: 'look_style',
  // ── Photos & video
  photo_video: 'photos_video',
  editorial: 'photos_video',
  livestream: 'photos_video',
  photo_booth: 'photos_video',
  digital_services: 'photos_video',
  // ── Music & program
  live_band: 'music_program',
  choir: 'music_program',
  orchestra: 'music_program',
  wedding_singer: 'music_program',
  dj: 'music_program',
  choreographer: 'music_program',
  performers: 'music_program',
  host_mc: 'music_program',
  av_production: 'music_program',
  speaker_talent: 'music_program',
  kids_entertainer: 'music_program',
  lights_sound: 'music_program',
  reveal_element: 'music_program',
  // ── Paperwork (prints and giveaways for every type without the papers)
  wedding_paperwork: 'paperwork',
  printing: 'paperwork',
  souvenir_giveaways: 'paperwork',
  trophies_awards: 'paperwork',
  // ── Getting there & the rest
  coordinator: 'more',
  date_specialist: 'more',
  travel_honeymoon: 'more',
  bridal_car: 'more',
  guest_shuttle: 'more',
  escort: 'more',
  transfers_rentals: 'more',
  tour_activity: 'more',
  tour_guide: 'more',
  referee_official: 'more',
  event_medic: 'more',
  everything_else: 'more',
  event_insurance: 'more',
  personal_accident_insurance: 'more',
  travel_insurance: 'more',
  massage_chair: 'more',
  perfume_bar: 'more',
  arcade_games: 'more',
  henna_tattoo: 'more',
  mini_nail_bar: 'more',
  tarot_astrology_palmistry: 'more',
  caricature_calligraphy_painting: 'more',
  engraving_embroidery: 'more',
};

/**
 * The heading over a group. A wake reads its own words (frame 6: "The
 * service"); "Paperwork" is only true for a type that has papers to file —
 * a birthday's same group is its prints and giveaways (frame 5).
 */
export function findGroupLabel(
  id: FindGroupId,
  ctx: { solemn: boolean; hasPaperwork: boolean },
): string {
  switch (id) {
    case 'farewell':
      return 'The service';
    case 'venue_food':
      return ctx.solemn ? 'Food & seating' : 'Venue & food';
    case 'look_style':
      return ctx.solemn ? 'Flowers & setting' : 'Look & style';
    case 'photos_video':
      return 'Photos & video';
    case 'music_program':
      return ctx.solemn ? 'Music & prayers' : 'Music & program';
    case 'paperwork':
      return ctx.hasPaperwork ? 'Paperwork' : 'Prints & giveaways';
    case 'more':
      return 'Getting there & more';
  }
}

/**
 * "Popular for <type>" — the four a host of that type books first (frames 4–6).
 * ORDER ONLY: a tile listed here that is not in the event's scope is dropped
 * by `buildFindList`, so this list can never ADD a category to an event.
 */
const POPULAR_BY_TYPE: Readonly<Record<string, readonly string[]>> = {
  wedding: ['photo_video', 'catering', 'reception', 'hmua'],
  birthday: ['cake', 'photo_booth', 'kids_entertainer', 'catering'],
  wake: ['funeral_home', 'memorial_park', 'cremation', 'florist'],
  debut: ['reception', 'hmua', 'photo_video', 'catering'],
  christening: ['ceremony_venue', 'catering', 'cake', 'photo_video'],
};
const POPULAR_DEFAULT: readonly string[] = ['reception', 'catering', 'photo_video', 'host_mc'];

const TYPE_PLURAL: Readonly<Record<string, string>> = {
  wedding: 'weddings',
  birthday: 'birthdays',
  debut: 'debuts',
  christening: 'christenings',
  anniversary: 'anniversaries',
  graduation: 'graduations',
  reunion: 'reunions',
  corporate: 'company events',
  gender_reveal: 'gender reveals',
  gala_night: 'gala nights',
  concert: 'concerts',
  open_house: 'open houses',
  grand_opening: 'grand openings',
  tournament: 'tournaments',
  celebration: 'celebrations',
};

/** The Popular strip's heading. A wake is never "popular" (frame 6). */
export function popularHeading(eventType: string | null, solemn: boolean): string {
  if (solemn) return 'What families usually need';
  const plural = TYPE_PLURAL[eventType ?? 'wedding'];
  return plural ? `Popular for ${plural}` : 'Popular picks';
}

export type FindCategory = {
  tile: string;
  label: string;
  /** The host already booked a supplier here. Null = we could not check. */
  booked: boolean | null;
  /** Verified suppliers listing this category, or null when unknown. */
  supplierCount: number | null;
};

export type FindGroup = {
  id: FindGroupId;
  label: string;
  categories: FindCategory[];
  /** How many of this group's categories are booked; null = unknown. */
  bookedCount: number | null;
};

export type FindList = {
  popular: FindCategory[];
  groups: FindGroup[];
  /** Every category in scope, flat — what the search runs over. */
  total: number;
};

/**
 * PURE. Regroup the bench's scoped folders into the host's groups.
 *
 * @param folders   `buildShortlistFolders({ vendorRows: [] , … })` — already
 *                  scoped to the event type, hidden tiles and faith.
 * @param booked    tiles the host has a locked supplier in, or NULL when that
 *                  read failed — then no row may say "Booked ✓" (a refused read
 *                  must not look like "nothing booked" either, so the caller
 *                  says so once).
 * @param counts    tile → verified supplier count, or null when unknown.
 * @param query     the one search box; matches the category's own label or any
 *                  service under it (`servicesByTile`).
 */
export function buildFindList(args: {
  folders: ReadonlyArray<Pick<ShortlistFolder, 'tiles'>>;
  eventType: string | null;
  solemn: boolean;
  booked: ReadonlySet<string> | null;
  counts?: ReadonlyMap<string, number> | null;
  query?: string;
  servicesByTile?: ReadonlyMap<string, readonly string[]>;
}): FindList {
  const { folders, eventType, solemn, booked, counts, servicesByTile } = args;
  const q = (args.query ?? '').trim().toLowerCase();

  const all: FindCategory[] = [];
  const seen = new Set<string>();
  for (const f of folders) {
    for (const t of f.tiles) {
      if (seen.has(t.tile)) continue;
      seen.add(t.tile);
      if (q) {
        const hay = [t.label, ...(servicesByTile?.get(t.tile) ?? [])].join(' ').toLowerCase();
        if (!hay.includes(q)) continue;
      }
      all.push({
        tile: t.tile,
        label: t.label,
        booked: booked ? booked.has(t.tile) : null,
        supplierCount: counts ? (counts.get(t.tile) ?? 0) : null,
      });
    }
  }

  const byTile = new Map(all.map((c) => [c.tile, c]));
  const hasPaperwork = byTile.has('wedding_paperwork');

  // Popular is skipped while searching — the results ARE the answer then.
  const popularKeys = POPULAR_BY_TYPE[eventType ?? 'wedding'] ?? POPULAR_DEFAULT;
  const popular = q
    ? []
    : popularKeys.map((k) => byTile.get(k)).filter((c): c is FindCategory => c != null);


  const buckets = new Map<FindGroupId, FindCategory[]>();
  for (const c of all) {
    const g = (FIND_GROUP_OF_TILE as Record<string, FindGroupId | undefined>)[c.tile] ?? 'more';
    const arr = buckets.get(g);
    if (arr) arr.push(c);
    else buckets.set(g, [c]);
  }

  const groups: FindGroup[] = [];
  for (const id of FIND_GROUP_ORDER) {
    const categories = buckets.get(id);
    if (!categories || categories.length === 0) continue;
    groups.push({
      id,
      label: findGroupLabel(id, { solemn: args.solemn, hasPaperwork }),
      categories,
      bookedCount: booked ? categories.filter((c) => c.booked).length : null,
    });
  }

  return { popular, groups, total: all.length };
}

/** "31 suppliers" · "1 supplier" · nothing while the count is unknown. */
export function supplierCountLabel(n: number | null): string | null {
  if (n == null) return null;
  if (n <= 0) return 'Joining soon';
  return n === 1 ? '1 supplier' : `${n} suppliers`;
}
