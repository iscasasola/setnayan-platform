/**
 * Reception scene — a stylized, palette-tinted SVG venue the couple designs at
 * stylist grade: every part exposes its real materials (owner directive
 * 2026-06-09: "as intricate as possible … all the materials stylists use on
 * the different parts of the reception").
 *
 * Pure + DOM-free → renders identically server-side, in the React designer, and
 * in a rasterizer for visual testing. Each option also carries a `prompt`
 * phrase, so `buildPrompt()` assembles a stylist brief that drives the paid
 * "Make it real" photoreal render (Nano Banana) — the detailed free design IS
 * the AI's control image + prompt.
 *
 * Layout: a gentle aisle→stage view — ceiling overhead, entrance/tunnel arches
 * over the aisle, the couple's stage + backdrop at the far end, guest tables
 * flanking. Treatments swap the shapes; the shared Reception palette colors it.
 *
 * MULTI-SELECT (owner, 2026-09-03: "on reception design, needs to be able to
 * pick multiple as well"). Real receptions combine treatments — a ceiling is
 * draped fabric AND fairy lights — so an attribute marked `multi` may hold an
 * ARRAY of option ids instead of one. The widening is deliberately one-way:
 * a bare string still means exactly what it always meant, so every stored
 * `events.reception_design` and all 2,600 seeded `moodboard_theme_templates`
 * rows stayed valid with no migration and no backfill. `sel()` still returns
 * ONE id (the primary) for every caller that draws one thing; `selAll()`
 * returns the whole list for the callers that can show all of them.
 */

import { receptionVenuePhrase, isVenueSetting, type VenueSetting } from './venue-settings';
import type { WeddingTile } from './taxonomy';

export type PartId =
  | 'ceiling'
  | 'backdrop'
  | 'stage'
  | 'tables'
  | 'tunnel'
  | 'entrance'
  | 'walls'
  | 'photo_wall'
  | 'welcome_signage'
  // ── the celebration, added 2026-09-06 (owner) ─────────────────────────────
  // 🔑 A FILIPINO WEDDING HAS TWO VENUES, AND THIS IS THE SECOND ONE.
  // Owner: *"after a ceremony venue like church, they transfer to a place to
  // eat and celebrate the wedding. that is the reception venue. this is what
  // is supposed to be created with the stylist and everyone else, catering,
  // food, wall, ceiling, etc… it is a place not where the bride walks but a
  // time to celebrate and eat thus having booths, hosts, bands, etc."*
  //
  // The room could already be dressed — ceiling, walls, backdrop, the couple's
  // stage, the guest tables — but it had nowhere to put the things that make
  // it a CELEBRATION rather than a decorated hall. A couple could book a live
  // band, an emcee, a mobile bar and a perfume booth in the marketplace and
  // not one of them had a place in the drawing, in the zone rail, or in the
  // brief that drives the paid photoreal render.
  //
  // These three are not invented categories. Each is exactly one marketplace
  // PARENT out of the ten in `lib/taxonomy.ts`, chosen because it is a parent
  // whose suppliers occupy floor space at the reception and had no zone:
  //   feast   → `feast`   (catering · stations · cake · crew_meals)
  //   program → `program` (live_band · dj · orchestra · host_mc · performers…)
  //   booths  → `booths`  (photo_booth · mobile_bar · food_cart · perfume_bar…)
  // Anchoring them to the parents rather than naming them freehand is what
  // lets a later change light a zone up from what the couple actually BOOKED
  // without inventing a second mapping between the two vocabularies.
  | 'feast'
  | 'program'
  | 'booths'
  | 'people';

/** Per-role attire colors for the people layer. `guestPalette` is the guest
 *  dress-code palette (multiple approved colors) — guests render in a mix of them. */
export type RoleColors = {
  bride?: string;
  groom?: string;
  party?: string;
  guest?: string;
  guestPalette?: string[];
};

export type Option = {
  id: string;
  label: string;
  prompt: string;
  /**
   * The marketplace trade that SUPPLIES this treatment — data, not decoration.
   *
   * 🔑 THESE WERE COMMENTS, AND A COMMENT CANNOT BE READ BY THE ROOM. RV1 wrote
   * the trade beside each celebration option (`// live_band`, `// mobile_bar`)
   * and said, in this file's own PartId docblock, that anchoring the zones to
   * the marketplace parents is *"what lets a later change light a zone up from
   * what the couple actually BOOKED without inventing a second mapping between
   * the two vocabularies."* This field is that link, promoted from a comment to
   * a value. Nothing re-types a trade name here that is not already a
   * `WeddingTile`, and `assertOptionTilesBelongToTheirZone`
   * (lib/reception-booked-suggestions.ts) refuses, at module load, any tile the
   * zone's own `MOODBOARD_PART_TRADES` entry does not already claim — so the
   * option vocabulary and the part → trade map cannot drift apart silently.
   *
   * ⚠ ABSENT IS AN ANSWER. A ceiling treatment, a table linen or a runner has
   * no single trade that "is" it — a stylist builds all of them — and guessing
   * one would put a florist's name on a chandelier. Only options a marketplace
   * shop is booked to PROVIDE carry a tile; every other option leaves it unset
   * and is therefore never suggested by anybody.
   *
   * The import is type-only, so this adds no runtime edge to `./taxonomy` and
   * this module stays as client-safe as it has always been.
   */
  tile?: WeddingTile;
  /** "Nothing here" (None / Bare / Minimal). On a `multi` attribute it can
   *  never sit alongside a real treatment — "no entrance tunnel" AND "a
   *  tunnel of floral arches" is a contradiction the AI prompt would
   *  faithfully repeat. `sanitizeReceptionDesign` drops it whenever a real
   *  option is also selected. Meaningless (and unset) on single attributes,
   *  where exclusivity is automatic. */
  exclusive?: true;
};
export type Attribute = {
  id: string;
  label: string;
  options: Option[];
  /** Opt-in multi-select (owner, 2026-09-03: "on reception design, needs to be
   *  able to pick multiple as well"). Set ONLY where combining treatments is
   *  what a real reception does — a ceiling really is draped fabric AND fairy
   *  lights. Left unset wherever multiple is nonsense (one table shape, one
   *  stage setup, one guest list in the room). */
  multi?: true;
};
export type Part = { id: PartId; label: string; blurb: string; attributes: Attribute[] };

/** One attribute's stored value. A bare string is the single-selection form —
 *  what every row written before 2026-09-03 holds, and what all 2,600 seeded
 *  `moodboard_theme_templates` rows hold — and it still means exactly what it
 *  always meant, so nothing needed migrating or backfilling. An array is the
 *  new multi-selection form, valid only on a `multi` attribute. */
export type AttributeValue = string | string[];

/** Nested design: part → attribute → chosen option id(s). */
export type ReceptionDesign = Partial<Record<PartId, Record<string, AttributeValue>>>;

/**
 * How many treatments one `multi` attribute may hold at once.
 *
 * THREE, not two: two covers the owner's own examples (draped fabric + fairy
 * lights; a floral wall + greenery), but the welcome table genuinely carries
 * three real things at once — an easel welcome sign, a framed seating chart
 * AND a floral guestbook table — and capping that at two would force a couple
 * to leave one out of a room that has all three. Three is also still short of
 * "everything": the smallest multi attribute (`backdrop.florals`,
 * `stage.florals`) has four options, so no cap-filling selection can ever
 * collapse into "all of them", and `buildPrompt`'s brief and the SVG's layered
 * glyphs both stay readable at three.
 */
export const MAX_SELECTIONS_PER_ATTRIBUTE = 3;

const O = (id: string, label: string, prompt: string): Option => ({ id, label, prompt });
/** An option a marketplace trade SUPPLIES — see `Option.tile`. */
const OT = (id: string, label: string, prompt: string, tile: WeddingTile): Option => ({
  id,
  label,
  prompt,
  tile,
});
/** An option meaning "nothing here" — see `Option.exclusive`. */
const ONone = (id: string, label: string, prompt: string): Option => ({
  id,
  label,
  prompt,
  exclusive: true,
});

export const RECEPTION_PARTS: Part[] = [
  {
    id: 'ceiling',
    label: 'Ceiling',
    blurb: 'What hangs overhead',
    attributes: [
      {
        id: 'treatment',
        label: 'Treatment',
        // The owner's own example of a real combination: draped fabric AND
        // fairy lights. Ceiling treatments are hung fixtures — they share the
        // overhead band without contradicting each other.
        multi: true,
        options: [
          O('chandeliers', 'Crystal chandeliers', 'rows of crystal chandeliers overhead'),
          O('draped', 'Draped canopy', 'a draped fabric canopy across the ceiling'),
          O('fairy_lights', 'Fairy lights', 'a warm canopy of fairy string lights'),
          O('hanging_florals', 'Hanging florals', 'suspended hanging floral clusters'),
          O('hanging_greenery', 'Hanging greenery', 'hanging greenery and vines from the ceiling'),
          O('lanterns', 'Paper lanterns', 'clusters of hanging paper lanterns'),
          O('geometric', 'Geometric', 'modern geometric hanging installations'),
          O('banana_leaf', 'Banana leaf & monstera', 'a hanging canopy of banana leaf and monstera fronds'),
          ONone('bare', 'Open / bare', 'a clean open ceiling'),
        ],
      },
    ],
  },
  {
    id: 'backdrop',
    label: 'Backdrop',
    blurb: 'Behind the couple',
    attributes: [
      {
        id: 'style',
        label: 'Style',
        // The owner's second example: a floral wall AND greenery. Backdrop
        // styles LAYER — each selected style is drawn in turn, so a later pick
        // dresses the one under it (which is what a real combined backdrop is).
        multi: true,
        options: [
          O('draped', 'Draped fabric', 'a draped fabric backdrop'),
          O('floral_wall', 'Floral wall', 'a full floral wall backdrop'),
          O('greenery', 'Greenery hedge', 'a lush greenery hedge backdrop'),
          O('marquee', 'Marquee letters', 'glowing marquee bulb letters'),
          O('neon', 'Neon sign', 'a custom neon sign on the backdrop'),
          O('moon_gate', 'Moon-gate arch', 'a circular moon-gate arch backdrop'),
          O('balloon', 'Balloon wall', 'an organic balloon wall'),
          O('fringe', 'Fringe panels', 'a fringe and tassel panel backdrop'),
          O('led', 'LED wall', 'a large LED video wall backdrop'),
          O('capiz', 'Capiz shell', 'a backdrop of iridescent capiz shell panels'),
        ],
      },
      {
        id: 'florals',
        label: 'Backdrop florals',
        // Corner sprays AND a cascade down one side is a common florist build.
        multi: true,
        options: [
          ONone('none', 'None', ''),
          O('corner', 'Corner sprays', 'with corner floral sprays'),
          O('full', 'Full frame', 'framed all around in flowers'),
          O('cascading', 'Cascading', 'with cascading florals down one side'),
        ],
      },
    ],
  },
  {
    id: 'stage',
    label: 'Stage',
    blurb: 'The couple’s spot',
    attributes: [
      {
        id: 'setup',
        label: 'Setup',
        options: [
          O('sweetheart', 'Sweetheart table', 'a sweetheart table for two'),
          O('long_head', 'Long head table', 'a long head table for the entourage'),
          O('lounge', 'Lounge sofa', 'an elegant lounge sofa setup'),
          O('king_queen', 'King & queen chairs', 'ornate king-and-queen chairs'),
          O('riser_arch', 'Riser + arch', 'a raised platform beneath a floral arch'),
        ],
      },
      {
        id: 'florals',
        label: 'Stage florals',
        // An arch behind the couple, pedestals flanking them and a runner on
        // their table are three separate florist pieces, not three choices.
        multi: true,
        options: [
          O('arch', 'Arch', 'an arch of flowers behind the couple'),
          O('pedestals', 'Pedestals', 'tall floral pedestals flanking the couple'),
          O('table_runner', 'Table runner', 'a floral runner along the couple’s table'),
          ONone('none', 'None', ''),
        ],
      },
    ],
  },
  {
    id: 'tables',
    label: 'Guest tables',
    blurb: 'Where guests sit',
    attributes: [
      {
        // SINGLE on purpose: a guest table is round or long or square. (The
        // catalogue has no "Mixed" option today — if the owner wants mixed
        // shapes across the room, that is a new OPTION here, not a second
        // simultaneous selection: the renderer draws one shape per table spot.)
        id: 'shape',
        label: 'Shape',
        options: [
          O('round', 'Round', 'round guest tables'),
          O('long', 'Long banquet', 'long banquet guest tables'),
          O('square', 'Square', 'square guest tables'),
        ],
      },
      {
        id: 'chairs',
        label: 'Chairs',
        options: [
          O('chiavari', 'Chiavari', 'gold Chiavari chairs'),
          O('cross_back', 'Cross-back', 'wooden cross-back chairs'),
          O('ghost', 'Ghost / acrylic', 'clear acrylic ghost chairs'),
          O('velvet', 'Velvet', 'upholstered velvet chairs'),
          O('bentwood', 'Bentwood', 'bentwood round-back chairs'),
        ],
      },
      {
        id: 'linen',
        label: 'Linen',
        options: [
          O('plain', 'Plain', 'plain floor-length linens'),
          O('runner', 'With runner', 'linens with a table runner'),
          O('full_drape', 'Full drape', 'lush full-drape table linens'),
          O('sequin', 'Sequin', 'shimmering sequin linens'),
          O('banig', 'Banig weave', 'banig-weave table runners'),
        ],
      },
      {
        id: 'centerpiece',
        label: 'Centerpiece',
        options: [
          O('tall', 'Tall florals', 'tall floral centerpieces'),
          O('low', 'Low florals', 'low lush floral centerpieces'),
          O('candelabra', 'Candelabra', 'branched candelabra centerpieces'),
          O('candles', 'Candle cluster', 'clusters of pillar candles'),
          O('greenery_runner', 'Greenery runner', 'a greenery garland runner'),
          O('lanterns', 'Lanterns', 'lantern centerpieces'),
          O('sampaguita', 'Sampaguita garland', 'clusters of sampaguita garlands'),
        ],
      },
      {
        id: 'place',
        label: 'Place setting',
        options: [
          O('gold', 'Gold charger', 'gold charger plates'),
          O('silver', 'Silver charger', 'silver charger plates'),
          O('glass', 'Glass charger', 'clear glass charger plates'),
          O('none', 'Simple', 'simple place settings'),
        ],
      },
    ],
  },
  {
    id: 'tunnel',
    label: 'Entrance tunnel',
    blurb: 'The grand-entrance walk-through',
    attributes: [
      {
        id: 'style',
        label: 'Tunnel',
        // One walk-through can be dressed twice — floral arches strung with
        // fairy lights, lanterns hung along a greenery tunnel. Each selected
        // style draws its own pass over the same three arch depths.
        multi: true,
        options: [
          O('floral', 'Floral arches', 'a grand-entrance tunnel of floral arches'),
          O('draped', 'Draped arches', 'a grand-entrance tunnel of draped fabric arches'),
          O('fairy_light', 'Fairy-light tunnel', 'a glowing fairy-light entrance tunnel'),
          O('greenery', 'Greenery tunnel', 'a lush greenery arch entrance tunnel'),
          O('balloon', 'Balloon tunnel', 'a grand-entrance balloon arch tunnel'),
          O('lantern', 'Lantern walkway', 'an entrance walkway lined with hanging lanterns'),
          O('crystal', 'Crystal tunnel', 'a sparkling crystal-beaded entrance tunnel'),
          O('butterfly', 'Butterfly tunnel', 'a whimsical butterfly entrance tunnel'),
          O('cherry_blossom', 'Cherry blossom', 'a cherry-blossom entrance tunnel'),
          O('cold_spark', 'Cold spark walk', 'a walkway of cold-spark fountains firing as the couple enters'),
          O('bamboo', 'Bamboo & rattan', 'an entrance tunnel of bamboo and rattan arches'),
          ONone('none', 'No tunnel', 'no entrance tunnel'),
        ],
      },
    ],
  },
  {
    id: 'entrance',
    label: 'Aisle',
    blurb: 'The walkway to the stage',
    attributes: [
      {
        id: 'runner',
        label: 'Aisle runner',
        // A fabric runner scattered with petals and lined with candles is one
        // aisle, dressed three ways — each is a separate rental line item.
        multi: true,
        options: [
          O('fabric', 'Fabric runner', 'a fabric aisle runner'),
          O('petals', 'Petals', 'an aisle scattered with petals'),
          O('mirror', 'Mirror', 'a mirrored aisle'),
          O('candle', 'Candle-lined', 'an aisle lined with candles'),
          O('floral_lined', 'Floral-lined', 'an aisle lined with florals'),
          ONone('none', 'Bare', 'a bare aisle'),
        ],
      },
    ],
  },
  {
    id: 'walls',
    label: 'Walls & surroundings',
    // Philippine venues — hotels especially — commonly restrict what can be
    // hung, drilled, or taped to their walls/pillars; a couple should confirm
    // with their venue before booking a wall treatment (informational only,
    // not a blocking validation — same spirit as the tunnel catalog's
    // realism notes above).
    blurb: 'Side walls & pillars — check with your venue before booking',
    attributes: [
      {
        id: 'treatment',
        label: 'Treatment',
        // Draped walls with floral garlands over them is the standard hotel
        // ballroom build. "Uplighting only" and "Bare" are exclusive: both
        // say, in words, that there is no wall dressing.
        multi: true,
        options: [
          O('fabric_drape', 'Fabric drape', 'fabric-draped side walls'),
          O('floral_garland', 'Floral garland', 'floral garlands along the side walls and pillars'),
          O('greenery_wall', 'Greenery wall', 'greenery-clad side walls'),
          ONone('uplighting_only', 'Uplighting only', 'uplit bare walls, no wall dressing'),
          ONone('bare', 'Bare / undressed', 'bare undressed walls'),
        ],
      },
    ],
  },
  {
    id: 'photo_wall',
    label: 'Photo wall',
    blurb: 'The step-and-repeat / photo-op backdrop — separate from your stage backdrop',
    attributes: [
      {
        id: 'style',
        label: 'Style',
        // A greenery wall with a neon sign on it, a balloon garland over a
        // step-and-repeat — the photo op is usually two things at once.
        multi: true,
        options: [
          O('floral_wall', 'Floral wall', 'a floral photo-wall backdrop'),
          O('step_repeat', 'Step & repeat', 'a step-and-repeat photo wall with the couple’s monogram'),
          O('greenery_wall', 'Greenery wall', 'a greenery photo-wall backdrop'),
          O('balloon_garland', 'Balloon garland', 'a balloon-garland photo wall'),
          O('neon_backdrop', 'Neon sign', 'a neon-sign photo wall'),
          ONone('none', 'None', ''),
        ],
      },
    ],
  },
  {
    id: 'welcome_signage',
    label: 'Welcome & signage',
    blurb: 'The welcome table near the entrance — sign, seating chart, guestbook',
    attributes: [
      {
        id: 'style',
        label: 'Style',
        // The welcome area is a SET of things, not a choice between them — the
        // sign, the seating chart and the guestbook table stand side by side.
        // This is the attribute that sets the cap at three rather than two.
        multi: true,
        options: [
          O('easel_sign', 'Easel welcome sign', 'an easel welcome sign at the entrance'),
          O('framed_seating_chart', 'Framed seating chart', 'a framed seating chart display near the entrance'),
          O('floral_guestbook', 'Floral guestbook table', 'a floral-framed guestbook table near the entrance'),
          ONone('minimal', 'Minimal / no signage', 'a minimal welcome table, no signage'),
        ],
      },
    ],
  },
  // ── THE CELEBRATION · three zones, three marketplace parents ──────────────
  // Every option below carries the tile it corresponds to in `lib/taxonomy.ts`,
  // so the thing a couple DRESSES and the thing they BOOK are the same noun.
  // The prompt phrases are written for `buildPrompt`, which drives the paid
  // photoreal render — they describe a place in the room, never a supplier.
  {
    id: 'feast',
    label: 'Food & drink',
    blurb: 'Where the eating happens',
    attributes: [
      {
        id: 'service',
        label: 'How dinner is served',
        // Single: a reception serves dinner one way. (Stations BESIDE a plated
        // dinner is real, and that is what `stations` below is for.)
        options: [
          ONone('none', 'Not decided yet', ''),
          OT('buffet', 'Buffet line', 'a long draped buffet line along the side of the room', 'catering'),
          OT('plated', 'Plated service', 'plated table service, no buffet line', 'catering'),
          OT('family_style', 'Family style', 'family-style platters shared down the middle of each table', 'catering'),
          OT('grazing', 'Grazing table', 'an abundant grazing table of cheeses, fruit and bread', 'stations'),
          OT('lechon', 'Lechon centrepiece', 'a whole roast lechon presented on its own carving table', 'stations'),
        ],
      },
      {
        id: 'stations',
        label: 'Stations & sweets',
        // Multi: a dessert table AND a cake table AND a mobile bar is an
        // ordinary Filipino reception, not an extravagance.
        multi: true,
        options: [
          ONone('none', 'None', ''),
          OT('cake_table', 'Cake table', 'a dressed cake table with the tiered wedding cake', 'cake'),
          OT('dessert', 'Dessert table', 'a dessert table of Filipino sweets and pastries', 'dessert'),
          OT('mobile_bar', 'Mobile bar', 'a styled mobile cocktail bar', 'mobile_bar'),
          OT('mocktail', 'Mocktail bar', 'a non-alcoholic mocktail and fresh-juice bar', 'mocktail'),
          OT('coffee', 'Coffee cart', 'an espresso and coffee cart', 'coffee_espresso'),
          // `food_cart`, not `food_truck`: both parents exist and both are in
          // `MOODBOARD_PART_TRADES['room:feast']`, but a truck parks outside and a
          // cart stands in the room, and this option draws carts along the wall.
          OT('food_cart', 'Food carts', 'Filipino street-food carts along the wall', 'food_cart'),
        ],
      },
    ],
  },
  {
    id: 'program',
    label: 'Program',
    blurb: 'The band, the host, the dancing',
    attributes: [
      {
        id: 'performers',
        // NOT "Who plays": the People zone's one attribute is labelled "Who",
        // and `briefWholeLookZoneLines` excludes People from the whole-look
        // brief. A guard identified it by `label.startsWith('Who')`, so this
        // label would have been silently dropped from the brief the couple pays
        // to render. The proxy is fixed in that guard too — but a label that
        // does not collide is the better half of the fix.
        label: 'The band',
        // Multi: a string quartet at dinner and a band for the party is one of
        // the commonest programs there is.
        multi: true,
        options: [
          ONone('none', 'None', ''),
          OT('live_band', 'Live band', 'a live band on a low riser with their instruments', 'live_band'),
          OT('dj', 'DJ booth', 'a DJ booth with decks and speakers', 'dj'),
          OT('string_quartet', 'String quartet', 'a string quartet seated to one side', 'orchestra'),
          OT('singer', 'Wedding singer', 'a solo wedding singer at a standing microphone', 'wedding_singer'),
          OT('choir', 'Choir', 'a small choir standing in rows', 'choir'),
        ],
      },
      {
        id: 'host',
        label: 'The host',
        // Single: one emcee has one spot.
        options: [
          ONone('none', 'None', ''),
          OT('podium', 'Podium', 'a styled podium for the host', 'host_mc'),
          OT('standing_mic', 'Standing mic', 'a standing microphone for the host', 'host_mc'),
          OT('host_table', 'Host table', 'a small dressed table for the host and their notes', 'host_mc'),
        ],
      },
      {
        id: 'floor',
        label: 'Dance floor',
        options: [
          ONone('none', 'None', ''),
          OT('parquet', 'Parquet', 'a parquet dance floor in front of the stage', 'dance_floor'),
          OT('monogram', 'Monogram decal', 'a dance floor with the couple’s monogram decal at its centre', 'dance_floor'),
          // `dance_floor`, not `led_wall`: a wall is not a floor, and the shop a
          // couple books for this is a dance-floor supplier who happens to
          // build it out of LEDs.
          OT('led', 'LED floor', 'a glowing LED dance floor', 'dance_floor'),
        ],
      },
    ],
  },
  {
    id: 'booths',
    label: 'Guest booths',
    blurb: 'What guests wander to',
    attributes: [
      {
        id: 'kinds',
        label: 'Booths',
        // Multi, capped at MAX_SELECTIONS_PER_ATTRIBUTE like every other multi.
        // These are the `booths` parent's own tiles; the food-and-drink ones
        // that also live under that parent are offered under `feast.stations`
        // instead, where a couple would look for them.
        multi: true,
        options: [
          ONone('none', 'None', ''),
          OT('photo_booth', 'Photo booth', 'a photo booth with a props table', 'photo_booth'),
          OT('arcade', 'Arcade games', 'a retro arcade games corner', 'arcade_games'),
          OT('caricature', 'Caricature artist', 'a caricature artist sketching guests at a small easel', 'caricature_calligraphy_painting'),
          OT('henna', 'Henna tattoo', 'a henna tattoo booth with low seating', 'henna_tattoo'),
          OT('massage', 'Massage chairs', 'a pair of massage chairs in a quiet corner', 'massage_chair'),
          OT('nail_bar', 'Mini nail bar', 'a mini nail bar with two stools', 'mini_nail_bar'),
          OT('perfume', 'Perfume bar', 'a perfume-blending bar with rows of small bottles', 'perfume_bar'),
          OT('tarot', 'Tarot reader', 'a tarot reader at a draped round table', 'tarot_astrology_palmistry'),
          OT('engraving', 'Live engraving', 'a live engraving station personalising guest favours', 'engraving_embroidery'),
        ],
      },
    ],
  },
  {
    id: 'people',
    label: 'People',
    blurb: 'Who’s in the scene — so one render shows everyone in their attire',
    attributes: [
      {
        // prompt phrases are injected by buildPrompt with the actual role
        // colors, so these stay empty (the generic loop skips them).
        id: 'who',
        label: 'Show',
        options: [
          O('couple', 'Couple', ''),
          O('couple_party', 'Couple + entourage', ''),
          O('everyone', 'Everyone (+ guests)', ''),
          O('none', 'Empty venue', ''),
        ],
      },
    ],
  },
];

/**
 * Which family of room the SVG draws. Only a coarser grouping than
 * `VenueSetting` (venue-settings.ts) matters for the DRAWING — `restaurant`
 * draws exactly like `banquet_hall` (an interior room), and `destination` is
 * drawn as `beach`, its nearest neighbour, since the destination weddings
 * this market books are overwhelmingly coastal — rather than inventing a
 * seventh scene for one enum value that already looks like another.
 */
export type VenueSceneFamily = 'hall' | 'heritage' | 'garden' | 'beach' | 'tent';

const VENUE_SCENE: Record<VenueSetting, VenueSceneFamily> = {
  banquet_hall: 'hall',
  restaurant: 'hall',
  heritage: 'heritage',
  garden: 'garden',
  beach: 'beach',
  destination: 'beach',
  outdoor_tent: 'tent',
};

/** The scene family for a stored (possibly absent/unrecognised)
 *  `events.venue_setting`. An unknown value draws as `hall` — the same room
 *  `AMBIGUOUS_VENUE_SETTING` ('banquet_hall', venue-settings.ts) already
 *  means when nothing was chosen, and `hall` gates nothing, so an unset
 *  venue never loses a zone it hasn't actually been told it lacks. */
export function venueSceneFamily(venueSetting: string | null | undefined): VenueSceneFamily {
  return isVenueSetting(venueSetting) ? VENUE_SCENE[venueSetting] : 'hall';
}

/**
 * Zones a venue type genuinely LACKS — gated (disabled, labeled "not at
 * this venue", excluded from the drawing and from every render brief) only
 * where the absence is PHYSICAL, never where the couple might simply choose
 * to build it:
 *   · beach / destination — no ceiling to dress, no walls: open shore.
 *   · garden — no walls (the boundary is planting). Ceiling stays available:
 *     string lights and hanging installations between trees are a real
 *     garden treatment.
 *   · tent — nothing gated: the canopy IS a ceiling, the sides drape.
 *   · hall / restaurant / heritage — nothing gated.
 * (Ported from the agreed prototype, atelier-board.html's `VENUE_ZONE_NA`.)
 */
const VENUE_ZONE_NA: Partial<Record<VenueSetting, ReadonlySet<PartId>>> = {
  beach: new Set<PartId>(['ceiling', 'walls']),
  destination: new Set<PartId>(['ceiling', 'walls']),
  garden: new Set<PartId>(['walls']),
};

/**
 * Does this reception zone exist at the couple's venue? The one predicate
 * every gate in this module (the drawing, the zone rail, `buildPrompt`, and
 * every downstream render brief) must share — see `venueZoneApplies.test.ts`
 * -style coverage in `reception-scene.test.ts`. An unrecognised or absent
 * venue never gates anything (same reasoning as `venueSceneFamily`).
 */
export function venueZoneApplies(venueSetting: string | null | undefined, part: PartId): boolean {
  if (!isVenueSetting(venueSetting)) return true;
  return !VENUE_ZONE_NA[venueSetting]?.has(part);
}

export const DEFAULT_DESIGN: Record<PartId, Record<string, string>> = {
  ceiling: { treatment: 'chandeliers' },
  backdrop: { style: 'draped', florals: 'corner' },
  stage: { setup: 'sweetheart', florals: 'arch' },
  tables: { shape: 'round', chairs: 'chiavari', linen: 'plain', centerpiece: 'tall', place: 'gold' },
  tunnel: { style: 'floral' },
  entrance: { runner: 'fabric' },
  walls: { treatment: 'bare' },
  photo_wall: { style: 'none' },
  welcome_signage: { style: 'minimal' },
  // 🔑 THE THREE CELEBRATION ZONES DEFAULT TO NOTHING, AND THAT IS THE POINT.
  // `sel()`/`selAll()` fall back to DEFAULT_DESIGN for any part a stored
  // `reception_design` has no key for — which is EVERY event that existed
  // before these zones did. Defaulting `feast.service` to 'buffet' would put a
  // buffet line into every couple's room overnight, in the drawing, in the zone
  // rail and in the brief that drives their paid render, without one of them
  // choosing it. 'none' keeps the room byte-identical until a couple picks
  // something, and `reception-scene.test.ts` asserts exactly that.
  feast: { service: 'none', stations: 'none' },
  program: { performers: 'none', host: 'none', floor: 'none' },
  booths: { kinds: 'none' },
  people: { who: 'couple' },
};

/**
 * Normalize ONE stored attribute value to a list of option ids, applying no
 * default: a bare string → `[string]`, an array → its string entries, anything
 * else (including `undefined` and an empty array) → `[]`. Use this when the
 * ABSENCE of a choice has to stay visible; use `selAll()` when you want the
 * default filled in.
 */
export function optionIds(value: AttributeValue | undefined): string[] {
  if (typeof value === 'string') return value.length > 0 ? [value] : [];
  if (Array.isArray(value)) return value.filter((v): v is string => typeof v === 'string' && v.length > 0);
  return [];
}

/**
 * The PRIMARY selected option id for a part+attribute, falling back to the
 * default. Unchanged in meaning and return type since before multi-select — a
 * bare string resolves to itself, an array resolves to its first entry — so
 * every caller that renders or reads ONE treatment keeps working untouched.
 */
export function sel(design: ReceptionDesign, part: PartId, attr: string): string {
  return optionIds(design[part]?.[attr])[0] ?? DEFAULT_DESIGN[part][attr]!;
}

/**
 * EVERY selected option id for a part+attribute, always at least one (the
 * default). `selAll(...)[0] === sel(...)` always holds, so moving a call site
 * from `sel` to `selAll` can only ADD treatments, never change the one that
 * was already being drawn.
 */
export function selAll(design: ReceptionDesign, part: PartId, attr: string): string[] {
  const ids = optionIds(design[part]?.[attr]);
  return ids.length > 0 ? ids : [DEFAULT_DESIGN[part][attr]!];
}

/**
 * One part+attribute a surface actually draws. The caller supplies the list,
 * because it is the only thing that knows — see `DrawnAttributes` below.
 */
export type DrawnAttribute = readonly [PartId, string];

/**
 * WHAT A PRIMARY-ONLY SURFACE IS DRAWING, AND WHAT IT IS LEAVING OUT.
 *
 * The 3D room draws ONE treatment per attribute on purpose: there is one
 * physical ceiling band, one backdrop panel, one welcome table. That is a
 * legitimate limit; a couple silently believing their whole combination is on
 * screen is not. A room that quietly drops two of three welcome-table pieces
 * looks EXACTLY like a room that was given one — the same shape as the guest
 * list that said "No guests yet" to a couple with 180 names.
 *
 * 🔑 `drawn` IS REQUIRED, AND IT IS THE WHOLE POINT OF THE SIGNATURE. The
 * catalogue has ten parts; the 3D room reads SEVEN part+attributes and renders
 * nothing at all for `stage.florals`, `entrance.runner` or `backdrop.florals`.
 * A version of this function that walked every part told a couple
 * *"Stage (showing Arch)"* about a stage the room does not draw — a brand-new
 * false claim inside the fix for false claims. Caught in review before it
 * shipped, and closed by construction: a surface can only disclose about what
 * it passed in, and the room's list is pinned to its own `sel()` calls by
 * `the-room-draws-what-the-couple-saved.test.ts`.
 *
 * Labels, not ids — this is read by a person.
 */
export type HiddenTreatment = {
  part: PartId;
  partLabel: string;
  attrLabel: string;
  /** The one the surface IS drawing. */
  primaryLabel: string;
  /** The ones it is not, in the order the couple picked them. */
  hiddenLabels: string[];
};

export function hiddenTreatments(
  design: ReceptionDesign,
  drawn: ReadonlyArray<DrawnAttribute>,
): HiddenTreatment[] {
  const out: HiddenTreatment[] = [];
  for (const [partId, attrId] of drawn) {
    const part = RECEPTION_PARTS.find((p) => p.id === partId);
    const attr = part?.attributes.find((a) => a.id === attrId);
    if (!part || !attr) continue;
    const chosen = selAll(design, part.id, attr.id);
    if (chosen.length < 2) continue;
    const labelOf = (id: string) => attr.options.find((o) => o.id === id)?.label ?? id;
    out.push({
      part: part.id,
      partLabel: part.label,
      attrLabel: attr.label,
      primaryLabel: labelOf(chosen[0]!),
      hiddenLabels: chosen.slice(1).map(labelOf),
    });
  }
  return out;
}

/**
 * One sentence for a primary-only surface's legend, or `null` when there is
 * nothing to disclose. Returning `null` rather than an empty string is the
 * point: a room with no multi-selection must render byte-identically to one
 * built before this existed, and `null` makes that structural.
 */
export function primaryOnlyNotice(
  design: ReceptionDesign,
  drawn: ReadonlyArray<DrawnAttribute>,
): string | null {
  const hidden = hiddenTreatments(design, drawn);
  if (hidden.length === 0) return null;
  const parts = hidden.map((h) => `${h.partLabel} (showing ${h.primaryLabel})`);
  const list =
    parts.length === 1
      ? parts[0]!
      : `${parts.slice(0, -1).join(', ')} and ${parts[parts.length - 1]!}`;
  const n = hidden.reduce((sum, h) => sum + h.hiddenLabels.length, 0);
  // The second sentence is a CHECKABLE claim, not reassurance: both
  // `lib/concept-pdf.ts` and `lib/moodboard-printable.ts` build their part
  // lists from `selAll`, so every pick really is on the sheet the couple hands
  // a supplier. If either ever moves to `sel`, this sentence becomes a lie —
  // `the-room-draws-what-the-couple-saved.test.ts` pins both.
  return `The room draws one treatment per part, so ${n} of your picks ${n === 1 ? 'is' : 'are'} not on screen — ${list}. All of them are saved, and your concept PDF lists every one for your suppliers.`;
}

/** Fast lookup of the rules per part → attribute, built once from
 *  RECEPTION_PARTS. Used by `sanitizeReceptionDesign` to reject unknown ids,
 *  reject arrays on single-select attributes, and hold the per-attribute cap. */
type AttrRule = { allowed: Set<string>; multi: boolean; exclusive: Set<string> };
const VALID_OPTIONS: Record<string, Record<string, AttrRule>> = (() => {
  const out: Record<string, Record<string, AttrRule>> = {};
  for (const part of RECEPTION_PARTS) {
    out[part.id] = {};
    for (const attr of part.attributes) {
      out[part.id]![attr.id] = {
        allowed: new Set(attr.options.map((o) => o.id)),
        multi: attr.multi === true,
        exclusive: new Set(attr.options.filter((o) => o.exclusive).map((o) => o.id)),
      };
    }
  }
  return out;
})();

/** Is this attribute opt-in multi-select? (Reads the same table the sanitizer
 *  enforces, so the editor and the trust boundary can never disagree.) */
export function isMultiAttribute(part: PartId, attr: string): boolean {
  return VALID_OPTIONS[part]?.[attr]?.multi === true;
}

/**
 * Coerce an arbitrary JSONB blob (e.g. `events.reception_design`) into a clean
 * `ReceptionDesign` — keeping ONLY known part → attribute → valid-option-id
 * triples and dropping everything else. `sel()` already falls back per-attribute,
 * so an empty result is safe (renders DEFAULT_DESIGN). Pure + total: never throws
 * on a malformed value, always returns a usable object. This is the single
 * trust boundary every 3D/SVG consumer of the stored design should pass through.
 *
 * Multi-select rules, enforced HERE so no writer can bypass them:
 *   • a bare string is passed through exactly as before — which is why all
 *     2,600 seeded `moodboard_theme_templates` rows and every stored
 *     `events.reception_design` survived the widening with no migration;
 *   • an array on a NON-`multi` attribute is REJECTED as an array and
 *     collapsed to its first valid entry (a table is not round AND square);
 *   • unknown option ids are dropped, inside an array exactly as outside it;
 *   • duplicates are dropped, and no more than MAX_SELECTIONS_PER_ATTRIBUTE
 *     survive, so a couple cannot select the whole catalogue;
 *   • an `exclusive` "nothing here" option is dropped when a real treatment is
 *     also selected, and kept when it is the only thing selected;
 *   • a surviving single id is written back as a BARE STRING, so one pick
 *     always stores in the legacy shape — arrays appear only where a couple
 *     genuinely chose more than one.
 */
export function sanitizeReceptionDesign(raw: unknown): ReceptionDesign {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {};
  const src = raw as Record<string, unknown>;
  const out: ReceptionDesign = {};
  for (const [partId, attrs] of Object.entries(VALID_OPTIONS)) {
    const partVal = src[partId];
    if (!partVal || typeof partVal !== 'object' || Array.isArray(partVal)) continue;
    const partSrc = partVal as Record<string, unknown>;
    const kept: Record<string, AttributeValue> = {};
    for (const [attrId, rule] of Object.entries(attrs)) {
      const v = partSrc[attrId];
      if (typeof v === 'string') {
        if (rule.allowed.has(v)) kept[attrId] = v;
        continue;
      }
      if (!Array.isArray(v)) continue;
      const ids = Array.from(
        new Set(v.filter((x): x is string => typeof x === 'string' && rule.allowed.has(x))),
      );
      if (ids.length === 0) continue;
      if (!rule.multi) {
        kept[attrId] = ids[0]!;
        continue;
      }
      const real = ids.filter((id) => !rule.exclusive.has(id));
      const chosen = (real.length > 0 ? real : ids.slice(0, 1)).slice(
        0,
        MAX_SELECTIONS_PER_ATTRIBUTE,
      );
      kept[attrId] = chosen.length === 1 ? chosen[0]! : chosen;
    }
    if (Object.keys(kept).length > 0) out[partId as PartId] = kept;
  }
  return out;
}

// ---- palette ----
const DEFAULTS = ['#C9A059', '#8C6BA6', '#D98BA6', '#9CB29A', '#F3ECE0'];
const LINEN = '#FBF7F0';
const WALL = '#ECE6DD';
const FLOOR = '#E4D9CC';
const WARM_LIGHT = '#FCE4A6';
const LEAF = '#7F9A6E';
const GOLD = '#CBA85C';
const SILVER = '#C7CBD1';
const GLASS = '#DCE6E6';
const SKIN = '#E7C8A2';
const HAIR = '#352720';

/** Resolved single colors for the people layer (no palette array). */
type RC = { bride: string; groom: string; party: string; guest: string };
const DEFAULT_ROLE: RC = {
  bride: '#FAF7F2',
  groom: '#222634',
  party: '#B98AA0',
  guest: '#9AA7B0',
};

function clampHex(h: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(h) ? h : '#CCCCCC';
}
function paletteFn(palette: string[]) {
  const p = palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c));
  return (i: number) => clampHex(p[i] ?? p[p.length - 1] ?? DEFAULTS[i] ?? DEFAULTS[0]!);
}
function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255,
    g = (n >> 8) & 255,
    b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
}
function lum(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  return 0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255);
}
/** A contrast edge for a figure: darker if the fill is light, lighter if dark —
 *  so figures separate from a same-toned background (white gown on a pale wall,
 *  dark suit on a dark backdrop). */
function outlineOf(hex: string): string {
  return lum(hex) > 150 ? shade(hex, -82) : shade(hex, 92);
}

// ---- shape helpers ----
const flower = (cx: number, cy: number, r: number, fill: string, center = WARM_LIGHT) =>
  [0, 1, 2, 3, 4]
    .map((k) => {
      const a = (k / 5) * Math.PI * 2 - Math.PI / 2;
      return `<circle cx="${(cx + Math.cos(a) * r).toFixed(1)}" cy="${(cy + Math.sin(a) * r).toFixed(1)}" r="${(r * 0.62).toFixed(1)}" fill="${fill}"/>`;
    })
    .join('') + `<circle cx="${cx}" cy="${cy}" r="${(r * 0.5).toFixed(1)}" fill="${center}"/>`;
const leaf = (cx: number, cy: number, r: number, rot: number) =>
  `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * 0.45).toFixed(1)}" fill="${LEAF}" transform="rotate(${rot} ${cx} ${cy})"/>`;
const bulb = (cx: number, cy: number, r = 3) =>
  `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r}" fill="${WARM_LIGHT}" stroke="#E6C677" stroke-width="0.6"/>`;
const candle = (cx: number, cy: number, h = 16) =>
  `<rect x="${(cx - 2).toFixed(1)}" y="${(cy - h).toFixed(1)}" width="4" height="${h}" rx="1.5" fill="${LINEN}"/>` +
  `<ellipse cx="${cx.toFixed(1)}" cy="${(cy - h - 3).toFixed(1)}" rx="2.2" ry="4" fill="${WARM_LIGHT}"/>`;
const lantern = (cx: number, cy: number, s = 12, fill = GOLD) =>
  `<rect x="${(cx - s / 2).toFixed(1)}" y="${(cy - s).toFixed(1)}" width="${s}" height="${s}" rx="2" fill="none" stroke="${fill}" stroke-width="1.6"/>` +
  `<circle cx="${cx.toFixed(1)}" cy="${(cy - s / 2).toFixed(1)}" r="${(s * 0.28).toFixed(1)}" fill="${WARM_LIGHT}"/>`;

function chargerColor(place: string): string | null {
  if (place === 'gold') return GOLD;
  if (place === 'silver') return SILVER;
  if (place === 'glass') return GLASS;
  return null;
}

function qpoint(p0: [number, number], c: [number, number], p2: [number, number], t: number): [number, number] {
  const u = 1 - t;
  return [u * u * p0[0] + 2 * u * t * c[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * c[1] + t * t * p2[1]];
}

// ---- depth compositing ----
/**
 * One drawable, floor-standing thing. `anchorY` is where it touches the
 * FLOOR — its ground-contact line, never its top and never its tallest
 * point — because in this projection larger `y` is nearer the viewer, and
 * the thing that decides what paints over what is what is standing closer
 * to the camera, not what reaches highest into the air.
 *
 * 🪤 THIS TYPE EXISTS BECAUSE "APPEND IT LAST" HAS NOW BEEN THE BUG TWICE.
 * RV1 drew the dance floor as the room's final layer and it painted straight
 * over the guest tables; the fix there was to special-case it as a FLOOR
 * TREATMENT, drawn before the furniture that stands on it (see `danceFloor`'s
 * own note above it — it stays a special case, not a `FloorItem`, because a
 * rug has no single ground-contact point, it IS the ground). RV2 then gave
 * the room a live band on a riser at the back-right and drew it last again —
 * the exact same mistake, on a zone `danceFloor`'s fix never touched, because
 * that fix was local to one zone instead of being a rule the compositor
 * enforces for everyone standing on the floor. A shared anchor + one sort
 * closes the whole category at once: nothing that stands on the floor gets
 * to skip the comparison by being appended after everything else.
 *
 * Exported (with `compositeFloorItems` below) so `reception-scene.test.ts`
 * can prove the rule is bidirectional — behind AND in front, depending on
 * the numbers, never "the band always loses" hard-coded to look that way —
 * even for a pairing the room's own fixed table spots never actually
 * produce, since every real guest table happens to sit nearer than the band
 * today.
 */
export type FloorItem = { anchorY: number; svg: string };

/**
 * Composite floor-standing items back to front — ascending ground-contact
 * `y`, so whichever one actually touches the floor nearer the viewer always
 * paints last (on top), regardless of the order the caller happened to build
 * them in. The sort is STABLE: two items that tie on `anchorY` (or that never
 * share a pixel) keep the relative order they were given, which is what lets
 * a room with no real overlap come out byte-identical to before this
 * function existed — nothing moves unless the numbers say it must.
 */
export function compositeFloorItems(items: ReadonlyArray<FloorItem>): string {
  return items
    .map((item, order) => ({ item, order }))
    .sort((a, b) => a.item.anchorY - b.item.anchorY || a.order - b.order)
    .map(({ item }) => item.svg)
    .join('');
}

// ---- ceiling ----
/** Every selected ceiling treatment, drawn one over the other — hung fixtures
 *  share the overhead band (draped canopy + fairy lights is the owner's own
 *  example), so layering is what a combined ceiling actually looks like. */
function ceiling(treatments: string[], P: (i: number) => string): string {
  return treatments.map((t) => ceilingLayer(t, P)).join('');
}
function ceilingLayer(t: string, P: (i: number) => string): string {
  const fab = P(0);
  if (t === 'bare') return '';
  if (t === 'draped') {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const x0 = 60 + i * 145,
        x1 = x0 + 145;
      s += `<path d="M ${x0} 8 Q ${(x0 + x1) / 2} 96 ${x1} 8 L ${x1} 0 L ${x0} 0 Z" fill="${fab}" opacity="0.92"/>`;
      s += `<path d="M ${x0} 8 Q ${(x0 + x1) / 2} 96 ${x1} 8" fill="none" stroke="${shade(fab, -25)}" stroke-width="1.5" opacity="0.5"/>`;
    }
    return s;
  }
  if (t === 'fairy_lights') {
    let s = '';
    for (let row = 0; row < 3; row++) {
      const y = 18 + row * 26;
      let d = `M 30 ${y - 8}`;
      const pts: [number, number][] = [];
      for (let i = 0; i <= 12; i++) {
        const x = 30 + (i * 900) / 12;
        const yy = y + (i % 2 === 0 ? 16 : 0);
        pts.push([x, yy]);
        d += ` Q ${x - 35} ${y + 18} ${x} ${yy}`;
      }
      s += `<path d="${d}" fill="none" stroke="${shade(WALL, -40)}" stroke-width="1"/>`;
      s += pts.map(([x, yy]) => bulb(x, yy)).join('');
    }
    return s;
  }
  if (t === 'hanging_florals') {
    let s = '';
    for (let i = 0; i < 7; i++) {
      const cx = 90 + i * 130,
        cy = 20 + (i % 2) * 26;
      s += `<line x1="${cx}" y1="0" x2="${cx}" y2="${cy}" stroke="${LEAF}" stroke-width="1.5"/>`;
      s += flower(cx, cy + 12, 14, P(2));
      s += leaf(cx - 12, cy + 10, 11, -30) + leaf(cx + 12, cy + 14, 11, 30);
    }
    return s;
  }
  if (t === 'hanging_greenery') {
    let s = '';
    for (let i = 0; i < 9; i++) {
      const cx = 70 + i * 105;
      s += `<line x1="${cx}" y1="0" x2="${cx}" y2="40" stroke="${LEAF}" stroke-width="1"/>`;
      for (let k = 0; k < 5; k++) s += leaf(cx + (k % 2 ? 8 : -8), 12 + k * 9, 9, k % 2 ? 40 : -40);
    }
    return s;
  }
  if (t === 'banana_leaf') {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const cx = 100 + i * 150,
        cy = 10 + (i % 2) * 18;
      s += `<line x1="${cx}" y1="0" x2="${cx}" y2="${cy}" stroke="${LEAF}" stroke-width="1.2"/>`;
      // Large drooping banana-leaf/monstera fronds — bigger than the
      // generic `leaf()` glyph used by hanging_greenery, and split down
      // the middle to read as a distinct broad-leaf silhouette.
      for (const [dx, rot] of [[-30, -55], [0, 0], [30, 55]] as [number, number][]) {
        s += `<ellipse cx="${(cx + dx).toFixed(1)}" cy="${(cy + 26).toFixed(1)}" rx="30" ry="12" fill="${shade(LEAF, dx === 0 ? 8 : -6)}" transform="rotate(${rot} ${(cx + dx).toFixed(1)} ${(cy + 26).toFixed(1)})"/>`;
        s += `<line x1="${(cx + dx - 26).toFixed(1)}" y1="${(cy + 26).toFixed(1)}" x2="${(cx + dx + 26).toFixed(1)}" y2="${(cy + 26).toFixed(1)}" stroke="${shade(LEAF, -30)}" stroke-width="1" opacity="0.6" transform="rotate(${rot} ${(cx + dx).toFixed(1)} ${(cy + 26).toFixed(1)})"/>`;
      }
    }
    return s;
  }
  if (t === 'lanterns') {
    let s = '';
    for (let i = 0; i < 6; i++) {
      const cx = 110 + i * 150,
        cy = 22 + (i % 2) * 24;
      s += `<line x1="${cx}" y1="0" x2="${cx}" y2="${cy - 12}" stroke="${shade(WARM_LIGHT, -60)}" stroke-width="1"/>`;
      s += lantern(cx, cy, 18, shade(WARM_LIGHT, -50));
    }
    return s;
  }
  if (t === 'geometric') {
    let s = '';
    for (const cx of [200, 480, 760]) {
      s += `<line x1="${cx}" y1="0" x2="${cx}" y2="20" stroke="${shade(GOLD, -10)}" stroke-width="1"/>`;
      const r = 34;
      const pts = [0, 1, 2, 3, 4, 5].map((k) => {
        const a = (k / 6) * Math.PI * 2;
        return `${(cx + Math.cos(a) * r).toFixed(1)},${(40 + Math.sin(a) * r * 0.7).toFixed(1)}`;
      });
      s += `<polygon points="${pts.join(' ')}" fill="none" stroke="${GOLD}" stroke-width="2"/>`;
      s += `<polygon points="${pts.filter((_, i) => i % 2 === 0).join(' ')}" fill="none" stroke="${shade(GOLD, 20)}" stroke-width="1.5"/>`;
    }
    return s;
  }
  // chandeliers (default)
  let s = '';
  for (const cx of [200, 480, 760]) {
    s += `<line x1="${cx}" y1="0" x2="${cx}" y2="34" stroke="${shade(WARM_LIGHT, -60)}" stroke-width="2"/>`;
    s += `<ellipse cx="${cx}" cy="44" rx="46" ry="12" fill="none" stroke="${WARM_LIGHT}" stroke-width="3"/>`;
    s += `<ellipse cx="${cx}" cy="62" rx="30" ry="9" fill="none" stroke="${WARM_LIGHT}" stroke-width="3"/>`;
    for (let k = -2; k <= 2; k++) {
      s += bulb(cx + k * 22, 44, 3.2);
      s += `<line x1="${cx + k * 22}" y1="44" x2="${cx + k * 18}" y2="74" stroke="${WARM_LIGHT}" stroke-width="1"/>`;
      s += bulb(cx + k * 18, 76, 2.6);
    }
    s += bulb(cx, 88, 3.5);
  }
  return s;
}

// ---- backdrop ----
/** Backdrop geometry — shared by the style layers and the florals overlays. */
const BD = { x: 330, y: 150, w: 300, h: 210 };

/** Every selected backdrop style, then every selected florals overlay on top.
 *  Styles LAYER in selection order (a later pick dresses the one under it),
 *  which is what "a floral wall AND greenery" is in a real room. */
function backdrop(styles: string[], florals: string[], P: (i: number) => string): string {
  return (
    styles.map((style) => backdropStyleLayer(style, P)).join('') +
    florals.map((f) => backdropFloralsLayer(f, P)).join('')
  );
}

function backdropStyleLayer(style: string, P: (i: number) => string): string {
  const { x, y, w, h } = BD;
  let s = '';
  const panel = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(WALL, 6)}"/>`;
  if (style === 'floral_wall') {
    s += panel;
    for (let r = 0; r < 5; r++) for (let c = 0; c < 6; c++) s += flower(x + 28 + c * 49, y + 26 + r * 42, 13, P(2), P(0));
  } else if (style === 'greenery') {
    s += panel + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(LEAF, 60)}" opacity="0.35"/>`;
    for (let i = 0; i < 70; i++) s += leaf(x + 14 + ((i * 53) % (w - 28)), y + 14 + ((i * 31) % (h - 28)), 12, (i * 47) % 180);
  } else if (style === 'marquee') {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(P(0), -50)}"/>`;
    s += `<path d="M ${x + 40} ${y + 150} Q ${x + w / 2} ${y + 20} ${x + w - 40} ${y + 150}" fill="none" stroke="${shade(WARM_LIGHT, -40)}" stroke-width="2"/>`;
    for (let i = 0; i <= 18; i++) s += bulb(x + 40 + (i / 18) * (w - 80), y + 150 - Math.sin((i / 18) * Math.PI) * 130, 4);
  } else if (style === 'neon') {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(P(0), -70)}"/>`;
    s += `<path d="M ${x + 50} ${y + 130} q 30 -70 60 0 q 30 70 60 0 q 30 -70 60 0" fill="none" stroke="${shade(P(2), 60)}" stroke-width="5" stroke-linecap="round" opacity="0.95"/>`;
    s += `<path d="M ${x + 90} ${y + 165} h 120" stroke="${shade(P(2), 40)}" stroke-width="4" stroke-linecap="round"/>`;
  } else if (style === 'moon_gate') {
    s += panel;
    s += `<circle cx="${x + w / 2}" cy="${y + h / 2}" r="92" fill="none" stroke="${P(0)}" stroke-width="14"/>`;
    for (let i = 0; i < 10; i++) {
      const a = Math.PI * (0.15 + (i / 9) * 0.7);
      s += flower(x + w / 2 - Math.cos(a) * 92, y + h / 2 - Math.sin(a) * 92, 9, P(2));
    }
  } else if (style === 'balloon') {
    s += panel;
    for (let i = 0; i < 26; i++) {
      const bx = x + 18 + ((i * 71) % (w - 36));
      const by = y + 18 + ((i * 37) % (h - 40));
      const c = [P(0), P(1), P(2)][i % 3]!;
      s += `<circle cx="${bx}" cy="${by}" r="${10 + (i % 3) * 4}" fill="${c}" opacity="0.9"/>`;
    }
  } else if (style === 'fringe') {
    s += panel;
    for (let i = 0; i < 24; i++) {
      const fx = x + 8 + i * ((w - 16) / 24);
      s += `<path d="M ${fx} ${y + 8} q 3 ${h / 2} 0 ${h - 16}" fill="none" stroke="${i % 2 ? shade(P(0), 18) : P(0)}" stroke-width="${(w - 16) / 24 - 1}" opacity="0.85"/>`;
    }
  } else if (style === 'capiz') {
    // Iridescent capiz shell panels — a grid of pale, translucent
    // quatrefoil-ish shell pieces with a soft pearly overlay, distinct
    // from the flat floral_wall / led grids above.
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="${shade(WALL, 4)}"/>`;
    const shellFills = ['#F7F3EA', '#EFEAE0', '#F2EEE6'];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 8; c++) {
        const sx = x + 10 + c * ((w - 20) / 7);
        const sy = y + 10 + r * ((h - 20) / 5);
        const fill = shellFills[(r + c) % shellFills.length]!;
        s += `<rect x="${(sx - 14).toFixed(1)}" y="${(sy - 14).toFixed(1)}" width="28" height="28" rx="6" fill="${fill}" stroke="${shade(fill, -18)}" stroke-width="0.8" opacity="0.92"/>`;
      }
    }
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="10" fill="url(#rwall)" opacity="0.12"/>`;
  } else if (style === 'led') {
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="${shade(P(1), -60)}"/>`;
    for (let r = 0; r < 4; r++)
      s += `<rect x="${x + 12}" y="${y + 18 + r * 48}" width="${w - 24}" height="22" rx="3" fill="${shade(P(2), -10)}" opacity="${0.5 - r * 0.08}"/>`;
    s += `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="6" fill="none" stroke="${shade(WALL, -40)}" stroke-width="2"/>`;
  } else {
    // draped (default) — vertical fabric folds
    s += panel;
    const fab = P(0);
    for (let i = 0; i < 9; i++) {
      const fx = x + 8 + i * ((w - 16) / 9);
      s += `<rect x="${fx}" y="${y + 4}" width="${(w - 16) / 9 - 2}" height="${h - 8}" rx="6" fill="${i % 2 ? shade(fab, 14) : fab}"/>`;
    }
    s += `<path d="M ${x + 8} ${y + 30} Q ${x + w / 2} ${y + 70} ${x + w - 8} ${y + 30}" fill="none" stroke="${shade(fab, -30)}" stroke-width="3" opacity="0.6"/>`;
  }
  return s;
}

/** One florals accent overlay on the backdrop (drawn over every style layer). */
function backdropFloralsLayer(florals: string, P: (i: number) => string): string {
  const { x, y, w, h } = BD;
  let s = '';
  if (florals === 'corner') {
    for (const [bx, by] of [[x, y], [x + w, y]] as [number, number][])
      for (let i = 0; i < 6; i++) s += flower(bx + (bx === x ? 18 : -18) + (i % 2 ? 14 : -2), by + 16 + i * 16, 10, P(2));
  } else if (florals === 'full') {
    for (let i = 0; i < 22; i++) {
      const tt = i / 21;
      const peri = perimeterPoint(x, y, w, h, tt);
      s += flower(peri[0], peri[1], 9, P(2));
    }
  } else if (florals === 'cascading') {
    for (let i = 0; i < 9; i++) s += flower(x + 22, y + 14 + i * 22, 11 - i * 0.4, P(2)) + leaf(x + 36, y + 20 + i * 22, 9, 30);
  }
  return s;
}
function perimeterPoint(x: number, y: number, w: number, h: number, t: number): [number, number] {
  const per = 2 * (w + h);
  let d = t * per;
  if (d < w) return [x + d, y];
  d -= w;
  if (d < h) return [x + w, y + d];
  d -= h;
  if (d < w) return [x + w - d, y + h];
  d -= w;
  return [x, y + h - d];
}

// ---- stage ----
/** `florals` is every selected stage-floral piece: an arch behind the couple,
 *  pedestals flanking them and a runner on their table are three separate
 *  florist builds that routinely appear together, so each draws its own pass. */
function stage(setup: string, florals: string[], P: (i: number) => string): string {
  const hasArch = florals.includes('arch');
  const hasPedestals = florals.includes('pedestals');
  const hasRunner = florals.includes('table_runner');
  const cx = 480;
  const platform = `<ellipse cx="${cx}" cy="392" rx="150" ry="26" fill="${shade(FLOOR, -14)}"/><rect x="${cx - 150}" y="372" width="300" height="22" fill="${shade(FLOOR, -8)}"/><ellipse cx="${cx}" cy="372" rx="150" ry="22" fill="${shade(FLOOR, 4)}"/>`;
  const chair = (px: number, py: number, ornate = false) =>
    `<rect x="${px - 7}" y="${py - 22}" width="14" height="26" rx="${ornate ? 7 : 4}" fill="${P(1)}"/>` +
    (ornate ? `<rect x="${px - 9}" y="${py - 30}" width="18" height="10" rx="6" fill="${shade(P(1), 18)}"/>` : '') +
    `<rect x="${px - 9}" y="${py}" width="18" height="8" rx="3" fill="${shade(P(1), -20)}"/>`;

  // stage florals (drawn behind setup where relevant)
  let pre = '';
  if (hasArch) {
    pre += `<path d="M ${cx - 90} 372 Q ${cx - 90} 250 ${cx} 250 Q ${cx + 90} 250 ${cx + 90} 372" fill="none" stroke="${P(0)}" stroke-width="14"/>`;
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI * (i / 10);
      pre += flower(cx - Math.cos(a) * 90, 372 - Math.sin(a) * 122, 9, P(2));
    }
  }
  if (hasPedestals) {
    for (const px of [cx - 120, cx + 120]) {
      pre += `<rect x="${px - 6}" y="300" width="12" height="76" fill="${shade(FLOOR, -20)}"/>`;
      pre += flower(px, 292, 18, P(2)) + leaf(px - 16, 296, 12, -30) + leaf(px + 16, 300, 12, 30);
    }
  }

  let body = '';
  if (setup === 'long_head') {
    body += `<rect x="${cx - 110}" y="338" width="220" height="34" rx="5" fill="${LINEN}"/><rect x="${cx - 110}" y="360" width="220" height="14" fill="${P(0)}"/>`;
    for (let k = -3; k <= 3; k++) body += chair(cx + k * 30, 340);
  } else if (setup === 'lounge') {
    body += `<rect x="${cx - 80}" y="344" width="160" height="30" rx="12" fill="${P(1)}"/><rect x="${cx - 80}" y="334" width="160" height="16" rx="8" fill="${shade(P(1), 18)}"/>`;
    body += `<rect x="${cx - 30}" y="372" width="60" height="10" rx="4" fill="${shade(GOLD, -10)}"/>`;
  } else if (setup === 'king_queen') {
    body += chair(cx - 30, 350, true) + chair(cx + 30, 350, true);
    body += `<ellipse cx="${cx}" cy="362" rx="34" ry="12" fill="${LINEN}"/>`;
  } else if (setup === 'riser_arch') {
    if (!hasArch)
      body += `<path d="M ${cx - 80} 372 Q ${cx - 80} 262 ${cx} 262 Q ${cx + 80} 262 ${cx + 80} 372" fill="none" stroke="${P(0)}" stroke-width="12"/>`;
    body += `<rect x="${cx - 70}" y="346" width="140" height="30" rx="6" fill="${LINEN}"/><rect x="${cx - 70}" y="362" width="140" height="14" fill="${P(0)}"/>`;
    body += chair(cx - 26, 348) + chair(cx + 26, 348);
  } else {
    // sweetheart (default)
    body += chair(cx - 26, 348) + chair(cx + 26, 348);
    body += `<ellipse cx="${cx}" cy="356" rx="40" ry="16" fill="${LINEN}"/><path d="M ${cx - 40} 356 a 40 16 0 0 0 80 0 l 0 6 a 40 16 0 0 1 -80 0 Z" fill="${P(0)}"/>`;
    if (!hasArch && !hasPedestals) body += flower(cx, 342, 11, P(2));
  }
  let post = '';
  if (hasRunner) post += flower(cx - 26, 350, 7, P(2)) + flower(cx, 348, 8, P(2)) + flower(cx + 26, 350, 7, P(2));
  return pre + platform + body + post;
}

// ---- tables ----
/**
 * The four guest-table spots, as ONE floor item. Not split per spot: the
 * front pair and the back pair are drawn front-first today, which is not
 * depth order, but the two pairs never occupy the same pixels either — so
 * there is no defect to fix there, and splitting them would let the general
 * sort quietly re-order front vs. back on every render, which is exactly the
 * "nothing else moves" a room with no real overlap is required to keep.
 * `anchorY` uses the FURTHEST spot's own ground-contact line (its shadow
 * ellipse, `cy + r * 0.36`, already drawn below) — the back-right table,
 * which is the one this zone's own defect measured against the band.
 */
function tableFloorItem(
  shapeT: string,
  chairsT: string,
  linenT: string,
  centerT: string,
  placeT: string,
  P: (i: number) => string,
  decor?: DecorLayers,
): FloorItem {
  const cloth = linenT === 'sequin' ? shade(P(1), 30) : LINEN;
  const accent = P(1);
  const charger = chargerColor(placeT);

  const chairGlyph = (chx: number, chy: number, r: number) => {
    const w = r * 0.4,
      h = r * 0.34;
    if (chairsT === 'ghost')
      return `<rect x="${(chx - w / 2).toFixed(1)}" y="${(chy - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${GLASS}" opacity="0.7" stroke="${shade(GLASS, -25)}" stroke-width="0.7"/>`;
    const col =
      chairsT === 'chiavari' ? GOLD : chairsT === 'cross_back' ? '#A9824E' : chairsT === 'velvet' ? shade(accent, -8) : '#9C7A4E';
    if (chairsT === 'cross_back')
      return `<rect x="${(chx - w / 2).toFixed(1)}" y="${(chy - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="1.5" fill="${col}"/><path d="M ${(chx - w / 2).toFixed(1)} ${(chy - h).toFixed(1)} l ${w.toFixed(1)} ${h.toFixed(1)} M ${(chx + w / 2).toFixed(1)} ${(chy - h).toFixed(1)} l ${(-w).toFixed(1)} ${h.toFixed(1)}" stroke="${shade(col, -25)}" stroke-width="0.8"/>`;
    if (chairsT === 'bentwood')
      return `<ellipse cx="${chx.toFixed(1)}" cy="${(chy - h / 2).toFixed(1)}" rx="${(w / 2).toFixed(1)}" ry="${(h / 2).toFixed(1)}" fill="${col}"/>`;
    const rx = chairsT === 'velvet' ? 4 : 1.5;
    return `<rect x="${(chx - w / 2).toFixed(1)}" y="${(chy - h).toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" rx="${rx}" fill="${col}"/>`;
  };

  const centerGlyph = (ccx: number, ccy: number, r: number) => {
    if (centerT === 'candelabra')
      return `<line x1="${ccx}" y1="${ccy}" x2="${ccx}" y2="${(ccy - r * 1.2).toFixed(1)}" stroke="${GOLD}" stroke-width="2"/><line x1="${(ccx - r * 0.5).toFixed(1)}" y1="${(ccy - r * 0.7).toFixed(1)}" x2="${(ccx + r * 0.5).toFixed(1)}" y2="${(ccy - r * 0.7).toFixed(1)}" stroke="${GOLD}" stroke-width="2"/>` +
        candle(ccx, ccy - r * 1.2, r * 0.5) + candle(ccx - r * 0.5, ccy - r * 0.7, r * 0.4) + candle(ccx + r * 0.5, ccy - r * 0.7, r * 0.4);
    if (centerT === 'candles') return candle(ccx, ccy, r * 0.7) + candle(ccx - r * 0.5, ccy + 2, r * 0.5) + candle(ccx + r * 0.5, ccy + 2, r * 0.5);
    if (centerT === 'lanterns') return lantern(ccx, ccy + 2, r * 0.9, GOLD);
    if (centerT === 'sampaguita') {
      // A short garland of small white sampaguita blossoms strung along
      // the table's axis — always white/cream (a real sampaguita's own
      // color), not palette-tinted, so it reads as the flower it is.
      let g = '';
      for (let k = -2; k <= 2; k++) {
        g += flower(ccx + k * (r * 0.32), ccy - (Math.abs(k) % 2 === 0 ? 2 : 6), r * 0.22, '#FFFFFF', '#F7E9A0');
      }
      return g;
    }
    if (centerT === 'greenery_runner')
      return [0, 1, 2, 3].map((k) => leaf(ccx - r + (k * r * 2) / 3, ccy, r * 0.5, k % 2 ? 25 : -25)).join('');
    if (centerT === 'low') return flower(ccx, ccy, r * 0.46, P(2)) + leaf(ccx - r * 0.5, ccy, r * 0.4, -20) + leaf(ccx + r * 0.5, ccy, r * 0.4, 20);
    // tall (default)
    return `<line x1="${ccx}" y1="${ccy}" x2="${ccx}" y2="${(ccy - r * 1.4).toFixed(1)}" stroke="${LEAF}" stroke-width="2"/>` +
      leaf(ccx - r * 0.3, ccy - r * 0.8, r * 0.4, -28) + leaf(ccx + r * 0.3, ccy - r * 0.7, r * 0.4, 28) + flower(ccx, ccy - r * 1.45, r * 0.46, P(2));
  };

  const drawTable = (cx: number, cy: number, r: number) => {
    let s = '';
    // chairs ring
    const nCh = shapeT === 'long' ? 6 : 6;
    for (let k = 0; k < nCh; k++) {
      const a = (k / nCh) * Math.PI * 2 + Math.PI / 6;
      s += chairGlyph(cx + Math.cos(a) * r * 1.18, cy + Math.sin(a) * r * 0.6, r);
    }
    // shadow
    s += `<ellipse cx="${cx}" cy="${(cy + r * 0.36).toFixed(1)}" rx="${r}" ry="${(r * 0.4).toFixed(1)}" fill="${shade(FLOOR, -26)}" opacity="0.16"/>`;
    // table top by shape
    if (shapeT === 'long') {
      const w = r * 2.1,
        hh = r * 0.7;
      s += `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - hh / 2).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}" rx="4" fill="${cloth}" stroke="${shade(cloth, -16)}" stroke-width="1"/>`;
    } else if (shapeT === 'square') {
      const w = r * 1.5;
      s += `<rect x="${(cx - w / 2).toFixed(1)}" y="${(cy - w * 0.32).toFixed(1)}" width="${w.toFixed(1)}" height="${(w * 0.64).toFixed(1)}" rx="3" fill="${cloth}" stroke="${shade(cloth, -16)}" stroke-width="1"/>`;
    } else {
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${r}" ry="${(r * 0.42).toFixed(1)}" fill="${cloth}" stroke="${shade(cloth, -16)}" stroke-width="1"/>`;
    }
    // linen accent
    if (linenT === 'banig') {
      // Woven banig runner — a crosshatch weave pattern down the table's
      // long axis, distinct from the plain color washes below.
      const bw = r * 0.4;
      s += `<ellipse cx="${cx}" cy="${cy}" rx="${(bw).toFixed(1)}" ry="${(r * 0.4).toFixed(1)}" fill="#E8D4A8"/>`;
      for (let k = -3; k <= 3; k++) {
        s += `<line x1="${(cx - bw).toFixed(1)}" y1="${(cy + k * (r * 0.09)).toFixed(1)}" x2="${(cx + bw).toFixed(1)}" y2="${(cy + k * (r * 0.09)).toFixed(1)}" stroke="#B98B4A" stroke-width="0.8" opacity="0.55"/>`;
      }
      for (let k = -2; k <= 2; k++) {
        s += `<line x1="${(cx + k * (bw / 3)).toFixed(1)}" y1="${(cy - r * 0.36).toFixed(1)}" x2="${(cx + k * (bw / 3)).toFixed(1)}" y2="${(cy + r * 0.36).toFixed(1)}" stroke="#B98B4A" stroke-width="0.8" opacity="0.4"/>`;
      }
    } else if (linenT === 'runner') s += `<ellipse cx="${cx}" cy="${cy}" rx="${(r * 0.34).toFixed(1)}" ry="${(r * 0.42).toFixed(1)}" fill="${accent}" opacity="0.6"/>`;
    else if (linenT === 'full_drape') s += `<path d="M ${(cx - r).toFixed(1)} ${cy} a ${r} ${(r * 0.42).toFixed(1)} 0 0 0 ${(r * 2).toFixed(1)} 0 l 0 ${(r * 0.3).toFixed(1)} a ${r} ${(r * 0.42).toFixed(1)} 0 0 1 ${(-r * 2).toFixed(1)} 0 Z" fill="${shade(cloth, -10)}"/>`;
    else if (linenT === 'sequin') s += `<ellipse cx="${cx}" cy="${cy}" rx="${(r * 0.86).toFixed(1)}" ry="${(r * 0.34).toFixed(1)}" fill="${shade(accent, 50)}" opacity="0.5"/>`;
    else s += `<ellipse cx="${cx}" cy="${cy}" rx="${(r * 0.6).toFixed(1)}" ry="${(r * 0.24).toFixed(1)}" fill="${accent}" opacity="0.35"/>`;
    // chargers
    if (charger) for (let k = 0; k < 6; k++) {
      const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
      s += `<circle cx="${(cx + Math.cos(a) * r * 0.78).toFixed(1)}" cy="${(cy + Math.sin(a) * r * 0.34).toFixed(1)}" r="${(r * 0.13).toFixed(1)}" fill="${charger}" stroke="${shade(charger, -25)}" stroke-width="0.5"/>`;
    }
    // centerpiece
    s += centerGlyph(cx, cy - 1, r);
    return s;
  };

  const spots: [number, number, number][] = [
    [150, 520, 60],
    [810, 520, 60],
    [240, 432, 44],
    [720, 432, 44],
  ];
  return {
    // The decor image REPLACES the flat furniture, exactly as backdrop,
    // ceiling and stage do — the couple's chosen anchor still describes where
    // the field of tables actually sits, image or not.
    anchorY: Math.min(...spots.map(([, cy, r]) => cy + r * 0.36)),
    svg: decorImage('tables', decor) ?? spots.map(([cx, cy, r]) => drawTable(cx, cy, r)).join(''),
  };
}

// ---- entrance ----
/** `tunnels` and `runners` are every selected treatment for each: one aisle
 *  can carry a fabric runner scattered with petals AND lined with candles, and
 *  one walk-through can be floral arches strung with fairy lights. Each
 *  selection draws its own pass over the same aisle / the same three arch
 *  depths — the exclusive "Bare"/"No tunnel" ids contribute nothing, and the
 *  sanitizer has already refused to store them beside a real treatment. */
function entrance(tunnels: string[], runners: string[], P: (i: number) => string): string {
  const cx = 480;
  const depths = [
    { top: 470, half: 178, y0: 636 },
    { top: 432, half: 124, y0: 588 },
    { top: 404, half: 86, y0: 548 },
  ];
  let s = '';
  // aisle runners first (under the arches)
  for (const runnerT of runners) {
    if (runnerT === 'petals') for (let i = 0; i < 26; i++) s += `<circle cx="${(cx - 70 + ((i * 53) % 140)).toFixed(1)}" cy="${(420 + ((i * 37) % 210)).toFixed(1)}" r="4" fill="${P(2)}" opacity="0.8"/>`;
    else if (runnerT === 'mirror') s += `<polygon points="420,378 540,378 660,636 300,636" fill="${shade(GLASS, 18)}" opacity="0.7"/>`;
    else if (runnerT === 'candle')
      for (let i = 0; i < 5; i++) {
        const yy = 430 + i * 42;
        const sp = 40 + i * 16;
        s += candle(cx - sp, yy, 12) + candle(cx + sp, yy, 12);
      }
    else if (runnerT === 'floral_lined')
      for (let i = 0; i < 5; i++) {
        const yy = 430 + i * 42;
        const sp = 46 + i * 16;
        s += flower(cx - sp, yy, 8, P(2)) + flower(cx + sp, yy, 8, P(2));
      }
  }

  for (const tunnelT of tunnels) s += tunnelLayer(tunnelT, cx, depths, P);
  return s;
}

/** One entrance-tunnel treatment, drawn across the three receding arch depths. */
function tunnelLayer(
  tunnelT: string,
  cx: number,
  depths: ReadonlyArray<{ top: number; half: number; y0: number }>,
  P: (i: number) => string,
): string {
  let s = '';
  if (tunnelT === 'none') return s;
  if (tunnelT === 'cold_spark') {
    // Cold-spark fountain walk — no arches: dark machine boxes flank the aisle
    // and fire titanium gold-white spark columns. Sparks are NEVER palette-
    // tinted (realism rule — tunnel catalog 2026-07-08); only the runner
    // (drawn above) carries the couple's colours.
    const SPARK = '#FFF3D9';
    depths.forEach((d, idx) => {
      const bw = 24 - idx * 6; // machine box width, receding with depth
      const boxTop = d.y0 - bw * 0.55;
      for (const mx of [cx - d.half * 0.7, cx + d.half * 0.7]) {
        s += `<rect x="${(mx - bw / 2).toFixed(1)}" y="${boxTop.toFixed(1)}" width="${bw}" height="${(bw * 0.55).toFixed(1)}" rx="3" fill="#23252B"/>`;
        // Upward spark fan: a few bright rays + tip dots out of each box.
        const h = 92 - idx * 24;
        for (let i = 0; i < 7; i++) {
          const a = -0.5 + i / 6; // −0.5..0.5 fan spread
          const x2 = mx + a * (24 - idx * 6);
          const y2 = boxTop - h * (0.55 + ((i * 29) % 10) / 22);
          s += `<line x1="${mx.toFixed(1)}" y1="${boxTop.toFixed(1)}" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}" stroke="${SPARK}" stroke-width="${(1.5 - idx * 0.3).toFixed(1)}" opacity="0.85"/>`;
          s += `<circle cx="${x2.toFixed(1)}" cy="${y2.toFixed(1)}" r="${(1.9 - idx * 0.4).toFixed(1)}" fill="${SPARK}"/>`;
        }
      }
    });
    return s;
  }
  depths.forEach((d, idx) => {
    const left = cx - d.half,
      right = cx + d.half;
    const springY = d.top + 70;
    const p0: [number, number] = [left, springY];
    const ctl: [number, number] = [cx, d.top - 36];
    const p2: [number, number] = [right, springY];
    const legL = `M ${left} ${d.y0} L ${left} ${springY}`;
    const legR = `M ${right} ${d.y0} L ${right} ${springY}`;
    const top = `M ${p0[0]} ${p0[1]} Q ${ctl[0]} ${ctl[1]} ${p2[0]} ${p2[1]}`;
    const stroke = (col: string, sw: number) =>
      `<path d="${legL}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/><path d="${legR}" fill="none" stroke="${col}" stroke-width="${sw}" stroke-linecap="round"/><path d="${top}" fill="none" stroke="${col}" stroke-width="${sw}"/>`;
    if (tunnelT === 'bamboo') {
      // Segmented bamboo poles (banded rects, not a smooth stroke) forming
      // the arch legs + a rattan-woven top rail, so it reads as jointed
      // bamboo rather than a generic wooden arch.
      const BAMBOO = '#B9A15A';
      const bw = 9 - idx * 2;
      const segments = (x0: number, y0: number, y1: number) => {
        const n = 5;
        let out = '';
        for (let i = 0; i < n; i++) {
          const sy0 = y0 + ((y1 - y0) * i) / n;
          const sy1 = y0 + ((y1 - y0) * (i + 1)) / n - 2;
          out += `<rect x="${(x0 - bw / 2).toFixed(1)}" y="${Math.min(sy0, sy1).toFixed(1)}" width="${bw}" height="${Math.abs(sy1 - sy0).toFixed(1)}" rx="2" fill="${BAMBOO}" stroke="${shade(BAMBOO, -30)}" stroke-width="0.6"/>`;
        }
        return out;
      };
      s += segments(left, springY, d.y0);
      s += segments(right, springY, d.y0);
      s += `<path d="${top}" fill="none" stroke="${shade('#8A9A6B', 6)}" stroke-width="${bw}" stroke-dasharray="3 3" opacity="0.85"/>`;
    } else if (tunnelT === 'draped') {
      const sw = 13 - idx * 3;
      s += stroke(P(0), sw);
      s += `<path d="M ${p0[0]} ${p0[1]} Q ${cx} ${d.top + 4} ${p2[0]} ${p2[1]}" fill="none" stroke="${shade(P(0), 20)}" stroke-width="${sw - 3}" opacity="0.85"/>`;
    } else if (tunnelT === 'fairy_light') {
      s += stroke(shade(WALL, -34), 4.5 - idx);
      const n = 9 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += bulb(px, py, 4.2 - idx);
      }
      for (let j = 1; j <= 3; j++) {
        const yy = springY + ((d.y0 - springY) * j) / 4;
        s += bulb(left, yy, 4.2 - idx) + bulb(right, yy, 4.2 - idx);
      }
    } else if (tunnelT === 'greenery') {
      s += stroke(LEAF, 10 - idx * 2);
      const n = 10 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += leaf(px, py, 11 - idx * 2, (i * 53) % 180);
      }
    } else if (tunnelT === 'balloon') {
      const n = 9 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="${9 - idx * 2}" fill="${[P(0), P(1), P(2)][i % 3]}" opacity="0.92"/>`;
      }
    } else if (tunnelT === 'lantern') {
      s += stroke(shade(WALL, -30), 3.5 - idx);
      const n = 5 - idx;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += lantern(px, py + 8, 14 - idx * 3, GOLD);
      }
    } else if (tunnelT === 'crystal') {
      s += stroke(shade(GLASS, -20), 3 - idx * 0.6);
      const n = 8 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += `<line x1="${px.toFixed(1)}" y1="${py.toFixed(1)}" x2="${px.toFixed(1)}" y2="${(py + (18 - idx * 4)).toFixed(1)}" stroke="${shade(GLASS, -20)}" stroke-width="0.7"/>`;
        for (let k = 1; k <= 2; k++)
          s += `<circle cx="${px.toFixed(1)}" cy="${(py + k * (9 - idx * 2)).toFixed(1)}" r="${(2.6 - idx * 0.5).toFixed(1)}" fill="${shade(GLASS, 30)}" stroke="${shade(GLASS, -15)}" stroke-width="0.5"/>`;
        s += bulb(px, py, 2.6 - idx * 0.4);
      }
    } else if (tunnelT === 'butterfly') {
      s += stroke(shade(WALL, -20), 2.5 - idx * 0.5);
      const n = 7 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        const c = [P(0), P(1), P(2)][i % 3]!;
        const r = 8 - idx * 2;
        s += `<ellipse cx="${(px - r * 0.4).toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.5).toFixed(1)}" ry="${(r * 0.72).toFixed(1)}" fill="${c}" opacity="0.9"/><ellipse cx="${(px + r * 0.4).toFixed(1)}" cy="${py.toFixed(1)}" rx="${(r * 0.5).toFixed(1)}" ry="${(r * 0.72).toFixed(1)}" fill="${c}" opacity="0.9"/><line x1="${px.toFixed(1)}" y1="${(py - r * 0.5).toFixed(1)}" x2="${px.toFixed(1)}" y2="${(py + r * 0.5).toFixed(1)}" stroke="${shade(c, -35)}" stroke-width="1"/>`;
      }
    } else if (tunnelT === 'cherry_blossom') {
      s += stroke('#A9824E', 7 - idx * 2);
      const n = 9 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += flower(px, py, 9 - idx * 2, shade(P(2), 45), '#F7E6EB');
      }
    } else {
      // floral (default)
      s += stroke(LEAF, 9 - idx * 2);
      const n = 8 - idx * 2;
      for (let i = 0; i <= n; i++) {
        const [px, py] = qpoint(p0, ctl, p2, i / n);
        s += flower(px, py, 11 - idx * 2, P(2));
      }
      s += flower(left, springY + 44, 9 - idx * 2, P(2)) + flower(right, springY + 44, 9 - idx * 2, P(2));
    }
  });
  return s;
}

// ---- walls / surroundings (new Filipino-relevant zone, 2026-09-03) ----
// Fallback-grade rendering (reuses the drape/floral/greenery glyphs already
// defined above) — a simplified side-margin treatment, not full stylist-grade
// intricacy like the 7 original parts, since the couple already sees the
// backdrop/ceiling carry most of the room's character.
function wallsDecor(treatments: string[], P: (i: number) => string): string {
  return treatments.map((t) => wallsDecorLayer(t, P)).join('');
}
function wallsDecorLayer(t: string, P: (i: number) => string): string {
  if (t === 'bare') return '';
  const bandW = 56;
  const bands = [0, 960 - bandW];
  const h = 372;
  if (t === 'uplighting_only') {
    let s = '';
    for (const x of bands) {
      for (let i = 0; i < 4; i++) {
        s += `<ellipse cx="${(x + bandW / 2).toFixed(1)}" cy="${60 + i * 80}" rx="30" ry="60" fill="${P(0)}" opacity="0.16"/>`;
      }
    }
    return s;
  }
  if (t === 'floral_garland') {
    let s = '';
    for (const x of bands) for (let i = 0; i < 6; i++) s += flower(x + bandW / 2, 20 + i * 60, 12, P(2));
    return s;
  }
  if (t === 'greenery_wall') {
    let s = '';
    for (const x of bands) {
      s += `<rect x="${x}" y="0" width="${bandW}" height="${h}" fill="${shade(LEAF, 40)}" opacity="0.3"/>`;
      for (let i = 0; i < 24; i++) s += leaf(x + 10 + ((i * 17) % (bandW - 20)), 14 + ((i * 29) % (h - 28)), 9, (i * 53) % 180);
    }
    return s;
  }
  // fabric_drape (default)
  let s = '';
  for (const x of bands) {
    s += `<path d="M ${x} 4 Q ${x + bandW / 2} ${h * 0.5} ${x} ${h - 4} L ${x + bandW - 2} ${h - 4} Q ${x + bandW / 2} ${h * 0.5} ${x + bandW - 2} 4 Z" fill="${P(0)}" opacity="0.5"/>`;
  }
  return s;
}

// ---- photo wall — the step-and-repeat, separate from the stage backdrop ----
// Reuses the same glyph vocabulary as `backdrop()`, scaled into a small
// corner panel (a lounge/entrance-corner photo op is smaller than the couple's
// own stage backdrop) — a reasonable fallback, not bespoke geometry.
/* ════════════════════════════════════════════════════════════════════════════
 * THE CELEBRATION LAYERS · feast · program · booths (2026-09-06).
 *
 * Three zones drawn into space the room was not using: the back-left floor
 * (the feast), the back-right floor (the program), and the left wall above it
 * (the booth row). Measured against a rendered grid before a line was written,
 * so nothing overlaps the backdrop (x 330–635), the couple's stage
 * (x 325–640), the guest-table clusters (x 75–230 and x 660–890, y 390–560),
 * the aisle polygon, the photo wall (x 786–916, y 92–200) or the welcome table
 * (x 26–118, y 588–634).
 *
 * 🪤 EVERY ONE OF THESE RETURNS '' FOR 'none' AND FOR AN EMPTY SELECTION. The
 * default design selects 'none' on all three, so a couple who has never opened
 * these zones gets a room whose bytes are unchanged — asserted, not assumed.
 * ════════════════════════════════════════════════════════════════════════════ */

/** Back-left floor: the buffet line, the grazing table, the stations — as
 *  ONE floor item, so a table between the feast and the viewer paints over
 *  it and a couple's own program on the far side of the room does not. */
function feastFloorItem(
  service: string,
  stations: string[],
  P: (i: number) => string,
  decor?: DecorLayers,
): FloorItem | null {
  const x = 24,
    y = 300,
    w = 288;
  let out = '';
  let lineBottom = 0;
  if (service !== 'none' && service !== '') {
    const top = y + 34;
    if (service === 'plated') {
      // No line to draw — plated service IS the guest tables, already drawn.
      out += '';
    } else if (service === 'lechon') {
      out += `<rect x="${x + 70}" y="${top}" width="140" height="34" rx="3" fill="${LINEN}" stroke="${shade(LINEN, -18)}" stroke-width="1"/>`;
      out += `<ellipse cx="${x + 140}" cy="${top - 4}" rx="46" ry="14" fill="${shade('#B06A3B', 6)}"/>`;
      out += `<ellipse cx="${x + 140}" cy="${top - 7}" rx="30" ry="8" fill="${shade('#B06A3B', 26)}" opacity="0.7"/>`;
      lineBottom = top + 34;
    } else {
      // buffet / family_style / grazing all read as a long dressed table.
      out += `<rect x="${x}" y="${top}" width="${w}" height="30" rx="3" fill="${LINEN}" stroke="${shade(LINEN, -18)}" stroke-width="1"/>`;
      out += `<rect x="${x}" y="${top + 22}" width="${w}" height="14" fill="${P(1)}" opacity="0.5"/>`;
      const n = service === 'grazing' ? 9 : 6;
      for (let i = 0; i < n; i++) {
        const cx = x + 22 + i * ((w - 44) / (n - 1));
        if (service === 'grazing') {
          out += `<circle cx="${cx.toFixed(1)}" cy="${top + 8}" r="7" fill="${[P(3), P(0), P(2)][i % 3]}" opacity="0.9"/>`;
        } else {
          out += `<rect x="${(cx - 11).toFixed(1)}" y="${top - 9}" width="22" height="14" rx="2" fill="${SILVER}" stroke="${shade(SILVER, -22)}" stroke-width="1"/>`;
          out += `<rect x="${(cx - 7).toFixed(1)}" y="${top - 13}" width="14" height="5" rx="2" fill="${shade(SILVER, 16)}"/>`;
        }
      }
      lineBottom = top + 30;
    }
  }
  // Stations stand BEHIND the line (drawn first, higher up), so the food area
  // reads as one depth rather than as a second shelf floating on the wall.
  const real = stations.filter((k) => k !== 'none' && k !== '');
  const behind = real
    .map((kind, i) => station(kind, x + 14 + i * 94, y - 48, P))
    .join('');
  // Every station glyph fits within 63px of its own top (the deepest is the
  // food cart's wheels) — its own ground contact.
  const stationsBottom = real.length > 0 ? y - 48 + 63 : 0;
  const flat = behind + out;
  if (flat === '') return null;

  // 🔑 THE IMAGE REPLACES WHAT THE COUPLE CHOSE, IT NEVER INVENTS A FEAST —
  // AND THE GATE HAS TO BE THE SERVICE LINE, NOT THE WHOLE GROUP.
  //
  // 🪤 Gating on `flat === ''` looks like the same claim and is not, because
  // `feast` is the only decor zone whose flat drawing holds MORE THAN ONE
  // independently chosen object. Measured on the shipped code: a couple with
  // `service: 'plated'` who ticked a cake table got the generated BUFFET LINE
  // drawn into their room — a service they explicitly did not choose — and lost
  // the cake table they did. The whole group was non-empty, so the gate opened;
  // the image then stood in for all of it. `service: 'none'` plus any station
  // failed the same way.
  //
  // So the gate is `out` — the service line itself — and the STATIONS are drawn
  // AFTER the image rather than swallowed by it, standing in front of the
  // generated buffet. `stage` and `tables` need none of this: each of their flat
  // drawings is ONE restyled object, so replacing the whole thing costs the
  // couple a linen choice, not a supplier they booked.
  //
  // With no decor layer this is `behind + out`, character for character as
  // before — an uncovered (zone, style) cell must render byte-identically to the
  // flat drawing (MB14b's invariant). And `anchorY` stays COMPUTED from the flat
  // geometry, so the depth sort keeps placing this item at its own ground
  // contact.
  const image = out === '' ? null : decorImage('feast', decor);
  return {
    anchorY: Math.max(lineBottom, stationsBottom),
    svg: image === null ? flat : image + behind,
  };
}

/** One food-and-drink station, drawn at its own top-left corner. */
function station(kind: string, x: number, y: number, P: (i: number) => string): string {
  const table = `<rect x="${x}" y="${y + 40}" width="72" height="22" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -18)}" stroke-width="1"/>`;
  if (kind === 'cake_table') {
    let s = table;
    for (let t = 0; t < 3; t++) {
      const tw = 40 - t * 12;
      s += `<rect x="${x + 36 - tw / 2}" y="${y + 40 - (t + 1) * 12}" width="${tw}" height="12" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -22)}" stroke-width="1"/>`;
    }
    s += flower(x + 36, y + 4, 6, P(2), P(0));
    return s;
  }
  if (kind === 'dessert') {
    let s = table;
    for (let i = 0; i < 5; i++)
      s += `<circle cx="${x + 10 + i * 13}" cy="${y + 34}" r="5" fill="${[P(0), P(2), P(3)][i % 3]}" opacity="0.9"/>`;
    return s;
  }
  if (kind === 'mobile_bar' || kind === 'mocktail') {
    let s = `<rect x="${x + 4}" y="${y + 18}" width="64" height="44" rx="3" fill="${shade(P(1), 30)}" stroke="${shade(P(1), -20)}" stroke-width="1"/>`;
    s += `<rect x="${x}" y="${y + 14}" width="72" height="7" rx="2" fill="${GOLD}"/>`;
    for (let i = 0; i < 4; i++)
      s += `<rect x="${x + 10 + i * 14}" y="${y + 2}" width="7" height="12" rx="2" fill="${kind === 'mocktail' ? shade(P(3), 10) : GLASS}" opacity="0.95"/>`;
    return s;
  }
  if (kind === 'coffee') {
    let s = table + `<rect x="${x + 16}" y="${y + 20}" width="40" height="20" rx="3" fill="${SILVER}" stroke="${shade(SILVER, -25)}" stroke-width="1"/>`;
    s += `<rect x="${x + 30}" y="${y + 14}" width="12" height="7" rx="2" fill="${shade(SILVER, -12)}"/>`;
    for (let i = 0; i < 3; i++)
      s += `<circle cx="${x + 14 + i * 10}" cy="${y + 46}" r="3.5" fill="${LINEN}" stroke="${shade(LINEN, -25)}" stroke-width="1"/>`;
    return s;
  }
  // food_cart — a wheeled cart with a striped awning
  let s = `<rect x="${x + 6}" y="${y + 24}" width="60" height="30" rx="3" fill="${shade(WALL, -6)}" stroke="${shade(WALL, -26)}" stroke-width="1"/>`;
  s += `<path d="M ${x + 2} ${y + 24} L ${x + 70} ${y + 24} L ${x + 62} ${y + 12} L ${x + 10} ${y + 12} Z" fill="${P(0)}" opacity="0.85"/>`;
  s += `<circle cx="${x + 18}" cy="${y + 58}" r="5" fill="${shade(WALL, -34)}"/><circle cx="${x + 54}" cy="${y + 58}" r="5" fill="${shade(WALL, -34)}"/>`;
  return s;
}

/** Back-right floor: the band's riser, the host's spot, the dance floor. */
/**
 * The dance floor — drawn on the AISLE polygon, and drawn EARLY.
 *
 * 🪤 THE FIRST DRAFT PUT IT ON THE BACK-RIGHT FLOOR AND DREW IT LAST, WHICH
 * PAINTED IT STRAIGHT OVER THE RIGHT-HAND GUEST TABLES. Caught by rendering
 * the room and looking at it, not by any type or test — the polygon was
 * perfectly valid and the tables were simply underneath it.
 *
 * Two rules came out of that, and both are structural:
 *  • The room's only uncommitted floor is the OPEN CENTRE — the aisle polygon
 *    `380,372 580,372 760,640 200,640`. Both guest-table clusters
 *    (x 75–230 and x 660–890) sit on the rest of it. So the dance floor IS the
 *    open centre; anywhere else is on top of somebody's table.
 *  • A floor treatment must be drawn immediately after the background, before
 *    the tables, the people and the entrance florals — so they stand ON it.
 */
function danceFloor(floor: string, P: (i: number) => string): string {
  if (floor === 'none' || floor === '') return '';
  // Slightly inset from the aisle so the runner still reads at its edges.
  const pts = '392,378 568,378 726,616 234,616';
  if (floor === 'led') {
    let out = `<polygon points="${pts}" fill="${shade(P(1), -30)}" opacity="0.8"/>`;
    for (let r = 0; r < 4; r++) {
      const y = 386 + r * 58;
      const half = 88 + r * 60;
      for (let c = 0; c < 5; c++) {
        const x = 480 - half + (c * 2 * half) / 5;
        out += `<rect x="${x.toFixed(1)}" y="${y}" width="${((2 * half) / 5 - 4).toFixed(1)}" height="48" fill="${shade(P(2), 40)}" opacity="${(0.14 + r * 0.05).toFixed(2)}"/>`;
      }
    }
    return out;
  }
  let out = `<polygon points="${pts}" fill="${shade(GOLD, 40)}" opacity="0.45"/>`;
  for (let i = 1; i < 6; i++) {
    const t = i / 6;
    out += `<line x1="${(392 + t * 176).toFixed(1)}" y1="378" x2="${(234 + t * 492).toFixed(1)}" y2="616" stroke="${shade(GOLD, -10)}" stroke-width="1" opacity="0.3"/>`;
  }
  if (floor === 'monogram')
    out += `<ellipse cx="480" cy="500" rx="52" ry="26" fill="none" stroke="${shade(GOLD, -20)}" stroke-width="3" opacity="0.7"/>`;
  return out;
}

/**
 * The band's riser + figures and the host's spot — as ONE floor item.
 *
 * 🪤 THIS IS THE ZONE RV2 SHIPPED AND DREW LAST, AND THE SECOND TIME THIS
 * FILE PAINTED A CELEBRATION LAYER OVER THE GUEST TABLES IT WAS SUPPOSED TO
 * STAND BEHIND. The riser sits at x 664–~940 (real.length up to 3), which
 * reaches into the same x-range as the back-right guest table (cx 720) — a
 * range the zone-layout note above `feastDecor` said nothing overlapped,
 * because it was measured against the table SPOTS, not against a table's own
 * tall centrepiece reaching up past the table's y. `anchorY` is the riser's
 * own shadow ellipse — its literal ground contact — so `compositeFloorItems`
 * can put it behind whichever table actually sits closer to the viewer,
 * instead of behind (or in front of) all of them by convention.
 */
function programFloorItem(
  performers: string[],
  host: string,
  P: (i: number) => string,
): FloorItem | null {
  let out = '';
  let anchorY = 0;
  // Performers, on a low riser against the back-right wall.
  const real = performers.filter((k) => k !== 'none' && k !== '');
  if (real.length > 0) {
    // 🪤 THE RISER IS SIZED TO THE BAND, NOT TO THE WALL. A fixed 288-wide bar
    // under one performer draws an empty shelf running off to the corner —
    // which is what the first render showed. It ends where the last group does.
    const x = 664,
      y = 316,
      w = real.length * 92 + 16;
    out += `<rect x="${x}" y="${y + 46}" width="${w}" height="14" rx="2" fill="${shade(WALL, -22)}"/>`;
    out += `<ellipse cx="${x + w / 2}" cy="${y + 62}" rx="${w / 2}" ry="4" fill="${shade(WALL, -26)}" opacity="0.3"/>`;
    real.forEach((kind, i) => {
      out += performer(kind, x + 46 + i * 92, y, P);
    });
    anchorY = Math.max(anchorY, y + 62); // the riser's own shadow ellipse
  }
  if (host !== 'none' && host !== '') {
    out += hostSpot(host, 596, 330, P);
    anchorY = Math.max(anchorY, 330 + 55); // the host spot's own ground line
  }
  if (out === '') return null;
  return { anchorY, svg: out };
}

/** One performer group, drawn at its own anchor on the riser. */
function performer(kind: string, x: number, y: number, P: (i: number) => string): string {
  const figure = (cx: number) =>
    `<circle cx="${cx}" cy="${y + 16}" r="6" fill="${SKIN}"/>` +
    `<rect x="${cx - 7}" y="${y + 23}" width="14" height="23" rx="5" fill="${shade(P(1), -30)}"/>`;
  if (kind === 'dj') {
    let s = `<rect x="${x - 26}" y="${y + 26}" width="52" height="20" rx="2" fill="${shade(WALL, -14)}" stroke="${shade(WALL, -32)}" stroke-width="1"/>`;
    s += `<circle cx="${x - 12}" cy="${y + 36}" r="5" fill="${SILVER}"/><circle cx="${x + 12}" cy="${y + 36}" r="5" fill="${SILVER}"/>`;
    s += figure(x);
    return s;
  }
  if (kind === 'live_band') {
    let s = figure(x - 16) + figure(x + 16);
    s += `<rect x="${x + 30}" y="${y + 28}" width="16" height="18" rx="2" fill="${shade(P(0), -20)}"/>`; // amp
    // The cymbal belongs to the kit. Drawn at x-30 in the first pass it landed
    // beside the HOST's podium, a hundred pixels from any drummer.
    s += `<ellipse cx="${x - 34}" cy="${y + 36}" rx="8" ry="8" fill="none" stroke="${GOLD}" stroke-width="2"/>`;
    s += `<rect x="${x - 40}" y="${y + 36}" width="12" height="10" rx="2" fill="${shade(WALL, -18)}"/>`; // drum
    return s;
  }
  if (kind === 'string_quartet') {
    let s = '';
    for (let i = 0; i < 3; i++) s += figure(x - 18 + i * 18);
    s += `<path d="M ${x + 26} ${y + 44} q 6 -14 0 -20" fill="none" stroke="${shade('#8A5A2B', 0)}" stroke-width="3"/>`;
    return s;
  }
  if (kind === 'choir') {
    let s = '';
    for (let i = 0; i < 4; i++) s += figure(x - 24 + i * 16);
    return s;
  }
  // singer — one figure at a standing mic
  return (
    figure(x) +
    `<line x1="${x + 14}" y1="${y + 46}" x2="${x + 14}" y2="${y + 18}" stroke="${shade(WALL, -40)}" stroke-width="2"/>` +
    `<circle cx="${x + 14}" cy="${y + 16}" r="3" fill="${shade(WALL, -46)}"/>`
  );
}

/** The host's spot, at the near edge of the stage. */
function hostSpot(kind: string, x: number, y: number, P: (i: number) => string): string {
  if (kind === 'podium')
    return (
      `<path d="M ${x} ${y + 54} L ${x + 34} ${y + 54} L ${x + 30} ${y + 16} L ${x + 4} ${y + 16} Z" fill="${shade(P(1), 20)}" stroke="${shade(P(1), -24)}" stroke-width="1"/>` +
      `<rect x="${x - 2}" y="${y + 12}" width="38" height="6" rx="2" fill="${GOLD}"/>`
    );
  if (kind === 'host_table')
    return (
      `<rect x="${x - 4}" y="${y + 34}" width="44" height="20" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -20)}" stroke-width="1"/>` +
      `<rect x="${x + 6}" y="${y + 28}" width="20" height="7" rx="2" fill="${shade(P(2), 10)}"/>`
    );
  // standing_mic
  return (
    `<line x1="${x + 16}" y1="${y + 54}" x2="${x + 16}" y2="${y + 18}" stroke="${shade(WALL, -40)}" stroke-width="2"/>` +
    `<circle cx="${x + 16}" cy="${y + 15}" r="4" fill="${shade(WALL, -46)}"/>` +
    `<ellipse cx="${x + 16}" cy="${y + 55}" rx="10" ry="3" fill="${shade(WALL, -34)}"/>`
  );
}

/** The booth row, against the upper-left wall. */
function boothsFloorItem(kinds: string[], P: (i: number) => string): FloorItem | null {
  const real = kinds.filter((k) => k !== 'none' && k !== '');
  if (real.length === 0) return null;
  const y = 132;
  const svg = real.map((kind, i) => booth(kind, 28 + i * 96, y, P)).join('');
  // `booth()`'s own shadow ellipse sits at y + h + 1 (h = 108) — its ground.
  return { anchorY: y + 108 + 1, svg };
}

/** One guest booth: a common bay, then the thing that makes it that booth. */
function booth(kind: string, x: number, y: number, P: (i: number) => string): string {
  const w = 84,
    h = 108;
  // 🪤 THE FIRST DRAFT DREW A PLAIN OUTLINED RECT AND THE THREE BOOTHS READ AS
  // FRAMED PICTURES HUNG ON THE WALL. A booth is read from three things — a
  // canopy over it, a counter across its front, and a shadow under it — so the
  // bay draws all three and never an outline around the whole thing.
  const bay =
    `<rect x="${x + 4}" y="${y + 14}" width="${w - 8}" height="${h - 30}" rx="3" fill="${shade(WALL, 6)}"/>` +
    // canopy
    `<path d="M ${x - 4} ${y + 16} L ${x + w + 4} ${y + 16} L ${x + w - 6} ${y} L ${x + 6} ${y} Z" fill="${shade(P(1), 12)}"/>` +
    `<path d="M ${x - 4} ${y + 16} L ${x + w + 4} ${y + 16} L ${x + w + 4} ${y + 21} L ${x - 4} ${y + 21} Z" fill="${shade(P(1), -14)}"/>` +
    // counter across the front, and the shadow that grounds it
    `<rect x="${x}" y="${y + h - 16}" width="${w}" height="13" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -20)}" stroke-width="1"/>` +
    `<ellipse cx="${x + w / 2}" cy="${y + h + 1}" rx="${w / 2 - 2}" ry="4" fill="${shade(WALL, -26)}" opacity="0.35"/>`;
  const mid = x + w / 2;
  if (kind === 'photo_booth')
    return (
      bay +
      `<rect x="${mid - 22}" y="${y + 16}" width="44" height="52" rx="4" fill="${shade(P(1), -40)}"/>` +
      `<circle cx="${mid}" cy="${y + 42}" r="12" fill="${GLASS}" stroke="${shade(WALL, -30)}" stroke-width="2"/>` +
      `<rect x="${mid - 16}" y="${y + 74}" width="32" height="8" rx="2" fill="${P(0)}"/>`
    );
  if (kind === 'arcade')
    return (
      bay +
      `<rect x="${mid - 20}" y="${y + 14}" width="40" height="62" rx="4" fill="${shade(P(2), -30)}"/>` +
      `<rect x="${mid - 13}" y="${y + 22}" width="26" height="20" rx="2" fill="${GLASS}"/>` +
      `<circle cx="${mid - 7}" cy="${y + 54}" r="4" fill="${P(0)}"/><circle cx="${mid + 7}" cy="${y + 54}" r="4" fill="${P(3)}"/>`
    );
  if (kind === 'caricature')
    return (
      bay +
      `<path d="M ${mid} ${y + 14} L ${mid - 18} ${y + 78} L ${mid + 18} ${y + 78} Z" fill="none" stroke="${shade('#8A5A2B', 0)}" stroke-width="3"/>` +
      `<rect x="${mid - 15}" y="${y + 24}" width="30" height="24" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -25)}" stroke-width="1"/>`
    );
  if (kind === 'henna')
    return (
      bay +
      `<rect x="${mid - 22}" y="${y + 54}" width="44" height="16" rx="2" fill="${shade(P(1), 20)}"/>` +
      `<path d="M ${mid} ${y + 24} q 12 12 0 24 q -12 -12 0 -24" fill="${shade('#7A4A22', 0)}" opacity="0.85"/>`
    );
  if (kind === 'massage')
    return (
      bay +
      `<path d="M ${mid - 20} ${y + 74} L ${mid - 20} ${y + 44} q 0 -10 12 -10 L ${mid + 6} ${y + 34}" fill="none" stroke="${shade(P(1), -30)}" stroke-width="9" stroke-linecap="round"/>` +
      `<path d="M ${mid + 2} ${y + 74} L ${mid + 20} ${y + 74}" stroke="${shade(P(1), -30)}" stroke-width="7" stroke-linecap="round"/>`
    );
  if (kind === 'nail_bar')
    return (
      bay +
      `<rect x="${mid - 24}" y="${y + 50}" width="48" height="14" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -22)}" stroke-width="1"/>` +
      [0, 1, 2, 3].map((i) => `<rect x="${mid - 20 + i * 11}" y="${y + 36}" width="7" height="13" rx="3" fill="${[P(0), P(2), P(3), P(1)][i]}"/>`).join('')
    );
  if (kind === 'perfume')
    return (
      bay +
      `<rect x="${mid - 24}" y="${y + 56}" width="48" height="12" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -22)}" stroke-width="1"/>` +
      [0, 1, 2, 3, 4].map((i) => `<rect x="${mid - 21 + i * 9}" y="${y + 40}" width="6" height="15" rx="2" fill="${GLASS}" stroke="${shade(GOLD, -10)}" stroke-width="1"/>`).join('')
    );
  if (kind === 'tarot')
    return (
      bay +
      `<ellipse cx="${mid}" cy="${y + 62}" rx="26" ry="10" fill="${shade(P(1), -20)}"/>` +
      [0, 1, 2].map((i) => `<rect x="${mid - 18 + i * 13}" y="${y + 44}" width="10" height="15" rx="2" fill="${LINEN}" stroke="${shade(GOLD, -14)}" stroke-width="1" transform="rotate(${-8 + i * 8} ${mid - 13 + i * 13} ${y + 51})"/>`).join('')
    );
  // engraving
  return (
    bay +
    `<rect x="${mid - 24}" y="${y + 54}" width="48" height="14" rx="2" fill="${LINEN}" stroke="${shade(LINEN, -22)}" stroke-width="1"/>` +
    `<rect x="${mid - 10}" y="${y + 30}" width="20" height="22" rx="3" fill="${SILVER}" stroke="${shade(SILVER, -26)}" stroke-width="1"/>` +
    `<line x1="${mid}" y1="${y + 52}" x2="${mid}" y2="${y + 60}" stroke="${GOLD}" stroke-width="2"/>`
  );
}

function photoWallDecor(styles: string[], P: (i: number) => string): string {
  return styles.map((style) => photoWallDecorLayer(style, P)).join('');
}
function photoWallDecorLayer(style: string, P: (i: number) => string): string {
  if (style === 'none') return '';
  const x = 786,
    y = 92,
    w = 130,
    h = 108;
  const panel = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${shade(WALL, 4)}" stroke="${shade(WALL, -20)}" stroke-width="1"/>`;
  if (style === 'floral_wall') {
    let s = panel;
    for (let r = 0; r < 3; r++) for (let c = 0; c < 4; c++) s += flower(x + 16 + c * 32, y + 16 + r * 32, 10, P(2), P(0));
    return s;
  }
  if (style === 'greenery_wall') {
    let s = panel + `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${shade(LEAF, 50)}" opacity="0.35"/>`;
    for (let i = 0; i < 20; i++) s += leaf(x + 10 + ((i * 23) % (w - 20)), y + 10 + ((i * 17) % (h - 20)), 8, (i * 41) % 180);
    return s;
  }
  if (style === 'balloon_garland') {
    let s = panel;
    for (let i = 0; i < 12; i++) {
      const bx = x + 10 + ((i * 31) % (w - 20));
      const by = y + 10 + ((i * 19) % (h - 20));
      s += `<circle cx="${bx.toFixed(1)}" cy="${by.toFixed(1)}" r="${6 + (i % 3) * 2}" fill="${[P(0), P(1), P(2)][i % 3]}" opacity="0.9"/>`;
    }
    return s;
  }
  if (style === 'neon_backdrop') {
    let s = `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="8" fill="${shade(P(0), -70)}"/>`;
    s += `<path d="M ${x + 16} ${y + h - 22} q 16 -38 32 0 q 16 38 32 0" fill="none" stroke="${shade(P(2), 60)}" stroke-width="4" stroke-linecap="round" opacity="0.95"/>`;
    return s;
  }
  // step_repeat (default) — a dotted grid standing in for a logo/monogram tile
  let s = panel;
  for (let r = 0; r < 5; r++)
    for (let c = 0; c < 6; c++)
      s += `<circle cx="${(x + 12 + c * 20).toFixed(1)}" cy="${(y + 12 + r * 20).toFixed(1)}" r="5" fill="${shade(P(1), 10)}" opacity="0.5"/>`;
  return s;
}

// ---- welcome & signage — the welcome table near the entrance ----
/** The table is drawn ONCE; every selected item then stands on it, nudged
 *  sideways so a sign, a seating chart and a guestbook read as three things
 *  side by side rather than one glyph stacked on another. This is the zone
 *  that argues the cap up to three — a real welcome area carries all three. */
function welcomeSignageDecor(styles: string[], P: (i: number) => string): string {
  const x = 26,
    y = 588,
    w = 92,
    h = 46;
  const table = `<rect x="${x}" y="${y + h - 12}" width="${w}" height="12" rx="2" fill="${LINEN}"/>`;
  const n = styles.length;
  return (
    table +
    styles
      .map((style, i) => welcomeSignageItem(style, x + w / 2 + (i - (n - 1) / 2) * 30, y, h, P))
      .join('')
  );
}
function welcomeSignageItem(
  style: string,
  mid: number,
  y: number,
  h: number,
  P: (i: number) => string,
): string {
  if (style === 'minimal') return '';
  if (style === 'easel_sign') {
    return (
      `<rect x="${mid - 3}" y="${y}" width="6" height="${h - 12}" fill="${shade('#A9824E', -10)}"/>` +
      `<rect x="${mid - 20}" y="${y}" width="40" height="26" rx="2" fill="${shade(WALL, 10)}" stroke="${P(0)}" stroke-width="1.4"/>`
    );
  }
  if (style === 'framed_seating_chart') {
    let s = `<rect x="${mid - 22}" y="${y - 2}" width="44" height="30" rx="2" fill="#FFFFFF" stroke="${GOLD}" stroke-width="2"/>`;
    for (let i = 0; i < 4; i++)
      s += `<line x1="${mid - 16}" y1="${y + 4 + i * 6}" x2="${mid + 16}" y2="${y + 4 + i * 6}" stroke="${shade(WALL, -30)}" stroke-width="1"/>`;
    return s;
  }
  // floral_guestbook (default)
  return (
    flower(mid, y + 4, 10, P(2)) +
    `<rect x="${mid - 12}" y="${y + h - 24}" width="24" height="16" rx="1" fill="#FFFFFF" stroke="${shade(WALL, -25)}" stroke-width="1"/>`
  );
}

// ---- people ----
// Figures carry a contrast outline so they never blend into a same-toned
// backdrop (white gown on a pale wall, dark suit on a dark backdrop) — issue
// caught by the legibility-verification workflow 2026-06-09.
function figHead(cx: number, cy: number, r: number): string {
  return (
    `<circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${r.toFixed(1)}" fill="${SKIN}" stroke="${shade(SKIN, -55)}" stroke-width="0.7"/>` +
    `<path d="M ${(cx - r).toFixed(1)} ${cy.toFixed(1)} a ${r.toFixed(1)} ${r.toFixed(1)} 0 0 1 ${(2 * r).toFixed(1)} 0 Z" fill="${HAIR}"/>`
  );
}
function gownFig(cx: number, baseY: number, h: number, color: string): string {
  const w = h * 0.5;
  const ol = outlineOf(color);
  return (
    `<polygon points="${(cx - w / 2).toFixed(1)},${baseY.toFixed(1)} ${(cx + w / 2).toFixed(1)},${baseY.toFixed(1)} ${(cx + w * 0.18).toFixed(1)},${(baseY - h * 0.58).toFixed(1)} ${(cx - w * 0.18).toFixed(1)},${(baseY - h * 0.58).toFixed(1)}" fill="${color}" stroke="${ol}" stroke-width="1.3" stroke-linejoin="round"/>` +
    `<rect x="${(cx - w * 0.18).toFixed(1)}" y="${(baseY - h * 0.78).toFixed(1)}" width="${(w * 0.36).toFixed(1)}" height="${(h * 0.26).toFixed(1)}" rx="3" fill="${color}" stroke="${ol}" stroke-width="1.1"/>` +
    figHead(cx, baseY - h * 0.86, h * 0.13)
  );
}
function suitFig(cx: number, baseY: number, h: number, color: string): string {
  const w = h * 0.34;
  const ol = outlineOf(color);
  return (
    `<rect x="${(cx - w / 2).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="${w.toFixed(1)}" height="${(h * 0.72).toFixed(1)}" rx="2" fill="${color}" stroke="${ol}" stroke-width="1.2"/>` +
    `<rect x="${(cx - 1.6).toFixed(1)}" y="${(baseY - h * 0.72).toFixed(1)}" width="3.2" height="${(h * 0.5).toFixed(1)}" fill="${shade(color, 40)}" opacity="0.5"/>` +
    figHead(cx, baseY - h * 0.8, h * 0.13)
  );
}
function people(who: string, rc: RC, guestPalette: string[]): string {
  if (who === 'none') return '';
  let s = '';
  if (who === 'couple_party' || who === 'everyone') {
    s += suitFig(360, 386, 42, rc.party) + gownFig(388, 386, 42, rc.party);
    s += gownFig(572, 386, 42, rc.party) + suitFig(600, 386, 42, rc.party);
  }
  if (who === 'everyone') {
    // guests as visible standing figures flanking each table, showing their
    // dress code — cycle the guest dress-code palette so the code reads as a
    // coordinated set, not one flat color.
    const gp = guestPalette.length ? guestPalette : [rc.guest];
    let gi = 0;
    const tablePos: [number, number, number][] = [
      [150, 520, 60],
      [810, 520, 60],
      [240, 432, 44],
      [720, 432, 44],
    ];
    for (const [tx, ty, r] of tablePos) {
      const baseY = ty + r * 0.36;
      const gh = r > 50 ? 32 : 27;
      const cL = gp[gi++ % gp.length]!;
      const cR = gp[gi++ % gp.length]!;
      s += gownFig(tx - r - 5, baseY, gh, cL) + suitFig(tx + r + 5, baseY, gh, cR);
    }
  }
  // couple — focal, in front of the stage
  s += `<ellipse cx="480" cy="404" rx="46" ry="9" fill="#000" opacity="0.08"/>`;
  s += gownFig(463, 402, 62, rc.bride) + suitFig(499, 402, 60, rc.groom);
  return s;
}

/** Compose the full venue SVG for a given design + palette + role attire colors. */
const SKY = '#DCEEF2';
const SAND = '#E9D9B8';
const SEA = '#9FC3C4';

/** The scenery behind everything else — an interior room (hall/heritage/tent
 *  share one wall+floor treatment; the canopy/drape that makes a tent a tent
 *  is drawn by `wallsDecor`/`ceiling` on top of it, same as always) or open
 *  air (beach: sky + shoreline; garden: hedge + lawn). Only the BACKGROUND
 *  changes by scene — every dressable part still draws over it exactly as
 *  before, gated only where `venueZoneApplies` says so. */
function sceneBackground(scene: VenueSceneFamily, W: number, H: number, aisleTint: string): string {
  if (scene === 'beach') {
    return `
      <rect width="${W}" height="372" fill="${SKY}"/>
      <rect y="330" width="${W}" height="42" fill="${SEA}"/>
      <line x1="0" y1="330" x2="${W}" y2="330" stroke="${shade(SEA, -20)}" stroke-width="1" opacity="0.6"/>
      <rect y="372" width="${W}" height="${H - 372}" fill="${SAND}"/>
      <polygon points="380,372 580,372 760,640 200,640" fill="${aisleTint}" opacity="0.45"/>`;
  }
  if (scene === 'garden') {
    const hedge = shade(LEAF, 30);
    let bumps = '';
    for (let x = 20; x <= W - 20; x += 60) bumps += `<circle cx="${x}" cy="30" r="34" fill="${hedge}"/>`;
    return `
      <rect width="${W}" height="372" fill="${shade(hedge, 55)}"/>
      <g aria-hidden="true">${bumps}</g>
      <rect y="372" width="${W}" height="${H - 372}" fill="${shade(LEAF, 62)}"/>
      <polygon points="380,372 580,372 760,640 200,640" fill="${aisleTint}" opacity="0.5"/>`;
  }
  // hall / heritage / tent — one shared interior treatment
  return `
    <defs>
      <linearGradient id="rwall" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(WALL, 10)}"/><stop offset="1" stop-color="${WALL}"/></linearGradient>
      <linearGradient id="rfloor" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${shade(FLOOR, 10)}"/><stop offset="1" stop-color="${shade(FLOOR, -8)}"/></linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="url(#rwall)"/>
    <rect y="372" width="${W}" height="${H - 372}" fill="url(#rfloor)"/>
    <polygon points="380,372 580,372 760,640 200,640" fill="${aisleTint}" opacity="0.55"/>`;
}

/* ════════════════════════════════════════════════════════════════════════════
 * MB14b · COMPOSITE-WITH-FALLBACK — the AI decor layers finally reach the room.
 *
 * The 2026-09-03 pilot generated ten decor drawings (backdrop × 5 styles,
 * ceiling × 5) and `lib/reception-decor-layers.ts` has been able to CHOOSE one
 * since that day. Nothing ever DREW one: `renderVenueSvg` had no way to accept
 * a chosen layer, so the whole pipeline terminated in a value nobody consumed.
 * This is the consumer.
 *
 * ── 🔑 THE SAFETY PROPERTY IS BYTE-IDENTITY, NOT "LOOKS THE SAME" ───────────
 * Four surfaces render this string today — the couple's Reception Designer,
 * the vendor read-only board, the concept PDF, and the paid render's control
 * image — and only ten (zone, style) pairs out of the whole product have an
 * asset. EVERY other combination must come out of this function EXACTLY as it
 * did before this change: same bytes, not merely the same picture. A "nearly
 * identical" flat render is a silently different control image for a paid
 * photoreal render, and a diff no reviewer would catch.
 *
 * That is why the fallback is written as `decorImage(zone) ?? <the call that
 * was already there>`: with no layer for a zone, the original expression is
 * evaluated unchanged and the surrounding array join is untouched. Byte
 * identity is a property of the SHAPE of this code, not of a test that hopes
 * to notice. `reception-scene.test.ts` pins it anyway, and the sabotage that
 * proves the pin is a near-miss substitution in `resolveDecorLayer`.
 *
 * ── WHAT A LAYER IS, AND WHAT IT IS NOT ─────────────────────────────────────
 * An href, already retinted by whoever resolved it —
 * `renderDecorLayerDataUrl` on the server (sharp), the Recolor Studio's canvas
 * on the client. No pixel work happens here; this module stays pure and
 * DOM-free, exactly as its own header promises.
 * ════════════════════════════════════════════════════════════════════════════
 */

/** Where a composited decor image sits, per zone. A zone absent from this map
 *  can never composite, whatever a caller passes — the geometry IS the
 *  permission. Keys are pinned equal to `PILOT_DECOR_ZONES` by
 *  `reception-scene.test.ts` (asserted there, not imported here, so this file
 *  keeps its one-way dependency on nothing). */
const DECOR_SLOTS: Partial<Record<PartId, { x: number; y: number; w: number; h: number; rx: number }>> = {
  // The same panel `backdropStyleLayer` draws — BD, with its rx 10 corners.
  backdrop: { ...BD, rx: 10 },
  // The overhead band every `ceilingLayer` treatment hangs inside: the draped
  // swags reach y 96 at their lowest, the fairy-light rows end at y 70.
  ceiling: { x: 0, y: 0, w: 960, h: 100, rx: 0 },
  // The couple's spot: the flat `stage()` draws its riser as a 300-wide rect at
  // y 372 with an ellipse platform at cy 392, so the furniture standing on it
  // occupies x 330–630 above that line. The box is that footprint plus the
  // height a sweetheart table or clad riser needs; the 16:9 sources are
  // centre-weighted, so `slice` crops sky and floor rather than the table.
  stage: { x: 330, y: 262, w: 300, h: 132, rx: 8 },
  // RA1 · the guest-table FIELD, not one table. `tables` draws FOUR of them at
  // (150,520,r60) (810,520,r60) (240,432,r44) (720,432,r44), so unlike every
  // other decor zone its geometry has to span scattered objects with the aisle
  // running between them — 88..872 × 386..586 is their combined extent.
  //
  // 🔑 THIS ONLY WORKS BECAUSE `tables` IS A SCENE ZONE. Its drawing's own
  // background is knocked out before it reaches here, so the floor, the aisle
  // runner and the dance floor all show through BETWEEN the tables. Composited
  // opaque this rect would blank the entire lower half of the room.
  tables: { x: 88, y: 386, w: 784, h: 200, rx: 0 },
  // RA1 · the feast line and its stations. `feastFloorItem` draws at x 24,
  // y 300, w 288: the service line occupies y 334..364 and the stations stand
  // BEHIND it from y 252. 24..312 × 250..366 is that combined extent, clear of
  // the guest-table band (y 386..586) below it.
  feast: { x: 24, y: 250, w: 288, h: 116, rx: 0 },
};

/** Zone → the href of its already-retinted decor image. A zone absent from the
 *  map falls back to the flat SVG, which is what almost every zone does. */
export type DecorLayers = Partial<Record<PartId, string>>;

const APP_SERVED_DECOR = /^\/moodboard-seed\/[A-Za-z0-9/_.-]+\.(?:svg|png|jpg|jpeg|webp)$/;
const RETINTED_DATA_URI = /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/;

/**
 * 🪤 AN href IS ATTACKER-SHAPED INPUT UNTIL IT IS CHECKED. It arrives from a
 * database column (`moodboard_library_assets.storage_path`) and is
 * interpolated into markup four surfaces serve. Only two shapes are ever
 * legitimate — an app-served seed path, or a data: URI this app just built —
 * and anything else FALLS BACK rather than being escaped and drawn, because a
 * row we cannot recognise is a row we should not composite.
 *
 * `..` is rejected SEPARATELY, not left to the character class: `[A-Za-z0-9/_.-]`
 * admits a dot, so it admits a dot-dot, so `/moodboard-seed/../../../etc/x.svg`
 * matches the shape above. The same predicate gates the filesystem read in
 * `reception-decor-layers-server.ts`, so one rule covers markup and disk.
 */
export function isCompositableDecorHref(href: string): boolean {
  if (href.includes('..')) return false;
  return APP_SERVED_DECOR.test(href) || RETINTED_DATA_URI.test(href);
}

/** One zone's composited decor image, or null to fall back to the flat SVG. */
function decorImage(zone: PartId, layers: DecorLayers | undefined): string | null {
  const href = layers?.[zone];
  if (!href) return null;
  const slot = DECOR_SLOTS[zone];
  if (!slot) return null;
  if (!isCompositableDecorHref(href)) return null;
  const clip = `decor-${zone}`;
  return (
    `<defs><clipPath id="${clip}"><rect x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}" rx="${slot.rx}"/></clipPath></defs>` +
    // 🪤 `xmlns:xlink` IS DECLARED ON THE ELEMENT, NOT ON THE ROOT <svg>.
    // Putting it on the root would change the first bytes of EVERY render this
    // function has ever produced, including the ones with no decor layer at
    // all — the exact regression this whole design exists to prevent. A
    // namespace declaration is legal on any element, so it rides along with
    // the only element that needs it. `href` is the SVG2 spelling browsers
    // use; `xlink:href` is what librsvg (our server rasteriser) still reads.
    `<image xmlns:xlink="http://www.w3.org/1999/xlink" clip-path="url(#${clip})"` +
    ` x="${slot.x}" y="${slot.y}" width="${slot.w}" height="${slot.h}"` +
    ` preserveAspectRatio="xMidYMid slice" href="${href}" xlink:href="${href}"/>`
  );
}

/**
 * Compose the full venue SVG for a given design + palette + role attire
 * colors — the couple's own room, re-drawn live in their own colours.
 *
 * @param venueSetting `events.venue_setting`, when the caller has one.
 *   Reshapes the scenery (`sceneBackground`) and GATES ceiling/walls per
 *   `venueZoneApplies` — a beach or garden reception is drawn honestly,
 *   never with a ceiling or walls it does not have. OMITTING IT draws the
 *   original hall-shaped room with nothing gated, so every pre-venue-aware
 *   caller (a stale server render, a test) is unchanged.
 */
export function renderVenueSvg(
  design: ReceptionDesign,
  palette: string[],
  roleColors?: RoleColors,
  venueSetting?: string | null,
  decor?: DecorLayers,
): string {
  const P = paletteFn(palette);
  const rc: RC = {
    bride: clampHex(roleColors?.bride || DEFAULT_ROLE.bride),
    groom: clampHex(roleColors?.groom || DEFAULT_ROLE.groom),
    party: clampHex(roleColors?.party || DEFAULT_ROLE.party),
    guest: clampHex(roleColors?.guest || DEFAULT_ROLE.guest),
  };
  const guestPalette = (roleColors?.guestPalette ?? []).filter((c) =>
    /^#[0-9a-fA-F]{6}$/.test(c),
  );
  const W = 960,
    H = 640;
  const scene = venueSceneFamily(venueSetting);
  const aisleTint = selAll(design, 'entrance', 'runner').includes('fabric') ? P(1) : shade(P(1), 70);
  const bg = sceneBackground(scene, W, H, aisleTint);

  // ── ONE DEPTH RULE for everything that stands on the floor ───────────────
  // The guest tables are always here; the celebration zones (2026-09-06) join
  // only when the venue allows them and the couple actually chose something —
  // each helper returns `null` for "nothing to draw", same as the empty
  // strings this list replaced. `compositeFloorItems` then sorts all of them
  // by ground-contact `y` — ascending, so whichever one actually touches the
  // floor nearer the viewer paints last — instead of by which line happened
  // to be appended to this array last.
  const floorItems: FloorItem[] = [
    tableFloorItem(
      sel(design, 'tables', 'shape'),
      sel(design, 'tables', 'chairs'),
      sel(design, 'tables', 'linen'),
      sel(design, 'tables', 'centerpiece'),
      sel(design, 'tables', 'place'),
      P,
      decor,
    ),
  ];
  if (venueZoneApplies(venueSetting, 'feast')) {
    const item = feastFloorItem(
      sel(design, 'feast', 'service'),
      selAll(design, 'feast', 'stations'),
      P,
      decor,
    );
    if (item) floorItems.push(item);
  }
  if (venueZoneApplies(venueSetting, 'program')) {
    const item = programFloorItem(
      selAll(design, 'program', 'performers'),
      sel(design, 'program', 'host'),
      P,
    );
    if (item) floorItems.push(item);
  }
  if (venueZoneApplies(venueSetting, 'booths')) {
    const item = boothsFloorItem(selAll(design, 'booths', 'kinds'), P);
    if (item) floorItems.push(item);
  }

  return [
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}">`,
    bg,
    // The dance floor is a FLOOR TREATMENT, so it goes down before anything
    // that stands on it — see `danceFloor`'s note on the draft that painted it
    // over the guest tables.
    venueZoneApplies(venueSetting, 'program')
      ? danceFloor(sel(design, 'program', 'floor'), P)
      : '',
    decorImage('backdrop', decor) ??
      backdrop(selAll(design, 'backdrop', 'style'), selAll(design, 'backdrop', 'florals'), P),
    // The stage image REPLACES the flat furniture, exactly as backdrop and
    // ceiling do — and, like them, an uncovered (zone, style) falls straight
    // back to the flat drawing. `people` is composited after this, so the
    // couple still stands in front of whichever version is drawn.
    decorImage('stage', decor) ??
      stage(sel(design, 'stage', 'setup'), selAll(design, 'stage', 'florals'), P),
    // The venue gate stays OUTERMOST on purpose: a beach reception has no
    // ceiling, so it gets no ceiling decor image either, however well the
    // couple's style family is covered.
    venueZoneApplies(venueSetting, 'ceiling')
      ? (decorImage('ceiling', decor) ?? ceiling(selAll(design, 'ceiling', 'treatment'), P))
      : '',
    // `walls` is behind everything standing IN the room, same as ceiling and
    // backdrop — it dresses the room's own shell, never furniture, so it
    // keeps a fixed slot ahead of the floor group rather than competing with
    // it on ground-contact `y`.
    venueZoneApplies(venueSetting, 'walls') ? wallsDecor(selAll(design, 'walls', 'treatment'), P) : '',
    // Everything that stands ON the floor — guest tables, the band's riser
    // and figures, the host's spot, the booth row, the feast — composited by
    // the ONE depth rule above, not by which line comes last in this array.
    compositeFloorItems(floorItems),
    people(sel(design, 'people', 'who'), rc, guestPalette),
    entrance(selAll(design, 'tunnel', 'style'), selAll(design, 'entrance', 'runner'), P),
    scene === 'beach' || scene === 'garden'
      ? ''
      : `<line x1="0" y1="372" x2="${W}" y2="372" stroke="${shade(WALL, -18)}" stroke-width="1" opacity="0.5"/>`,
    photoWallDecor(selAll(design, 'photo_wall', 'style'), P),
    welcomeSignageDecor(selAll(design, 'welcome_signage', 'style'), P),
    `</svg>`,
  ].join('');
}

/** Assemble a stylist-brief prompt from the design — drives the AI render. */
/**
 * What the caller knows about the couple's RECEPTION venue.
 *
 * ── WHY THIS IS NOT JUST A STRING ───────────────────────────────────────────
 * `buildPrompt` drives a PAID photoreal render, and `events.venue_setting` is a
 * column where "the couple chose a ballroom" and "the couple never answered"
 * are the SAME BYTES. Not because of a column default — that was dropped in
 * 20260521080000 — but because both writers stamp `banquet_hall` when nothing
 * was picked (`create-event/actions.ts`'s `?? 'banquet_hall'`, and
 * `onboarding/wedding/actions.ts`'s `DEFAULT_VENUE`, whose comment says "the
 * couple refines it later"). Meanwhile `events_wedding_fields_consistency`
 * forbids NULL on a wedding row, so there is nowhere for "unknown" to live.
 *
 * So a caller that has only read the column cannot honestly claim a ballroom.
 * `receptionVenuePhrase` refuses that one value unless `chosen` is passed, and
 * `chosen` is a claim about EVIDENCE — a submission in this same request, or a
 * surface that showed the couple the venue and had it confirmed — never just
 * "I read the row."
 */
export type ReceptionVenue = {
  /** `events.venue_setting` as stored. */
  setting: string | null | undefined;
  /** True only with positive evidence the couple actually picked it. */
  chosen?: boolean;
};

/**
 * @param venue The reception venue, when the caller has one. OMITTING IT keeps
 *   the exact brief this function produced before venues existed here, so every
 *   existing call site is unchanged — and so is the output for any venue that
 *   cannot be honestly asserted.
 */
export function buildPrompt(
  design: ReceptionDesign,
  palette: string[],
  roleColors?: RoleColors,
  venue?: ReceptionVenue,
): string {
  const phrases: string[] = [];
  for (const part of RECEPTION_PARTS) {
    // A zone the venue does not have (a beach's ceiling, a garden's walls)
    // is excluded here too — never described to the renderer just because a
    // stale choice from before the venue changed is still sitting in storage.
    if (!venueZoneApplies(venue?.setting, part.id)) continue;
    for (const attr of part.attributes) {
      // EVERY selection, not just the primary — a brief that describes one of
      // the couple's two ceiling treatments would render a room they didn't
      // design, and would read as a success while doing it.
      for (const id of selAll(design, part.id, attr.id)) {
        const opt = attr.options.find((o) => o.id === id);
        if (opt?.prompt) phrases.push(opt.prompt);
      }
    }
  }
  // People clause — injected with the actual role attire colors so one render
  // shows the venue AND everyone in their attire.
  const rc: RC = {
    bride: roleColors?.bride || DEFAULT_ROLE.bride,
    groom: roleColors?.groom || DEFAULT_ROLE.groom,
    party: roleColors?.party || DEFAULT_ROLE.party,
    guest: roleColors?.guest || DEFAULT_ROLE.guest,
  };
  const who = sel(design, 'people', 'who');
  if (who !== 'none') {
    let people = `the bride in a ${rc.bride} gown and the groom in a ${rc.groom} suit standing at the center stage`;
    if (who === 'couple_party' || who === 'everyone')
      people += `, bridesmaids and groomsmen in ${rc.party} attire beside them`;
    if (who === 'everyone') {
      const dress = (roleColors?.guestPalette ?? [])
        .filter((c) => /^#[0-9a-fA-F]{6}$/.test(c))
        .slice(0, 4);
      const dressClause = dress.length
        ? `a coordinated ${dress.join(', ')} dress code`
        : `${rc.guest} attire`;
      people += `, and well-dressed guests in ${dressClause} around the tables`;
    }
    phrases.push(people);
  }
  // 5, not 4: the reception palette became a five-color set on 2026-09-03
  // (PALETTE_LIMITS.reception), so a 4-cap silently dropped every theme's
  // Accent 2 from the prompt — the render would come back missing a color the
  // couple can see in their own swatch strip.
  const colors = palette.filter((c) => /^#[0-9a-fA-F]{6}$/.test(c)).slice(0, 5);
  const colorClause = colors.length ? ` Venue color palette: ${colors.join(', ')}.` : '';
  // THE RECEPTION VENUE — this function referenced it zero times until
  // 2026-09-03, so a garden wedding and a ballroom wedding produced a
  // byte-identical brief and the couple paid for whichever room the model felt
  // like. `receptionVenuePhrase` returns null rather than guess (see
  // ReceptionVenue above), and a null simply restores the generic opening this
  // line has always had — the render is less specific, never wrong.
  const venuePhrase = receptionVenuePhrase(venue?.setting, { chosen: venue?.chosen });
  const venueClause = venuePhrase ? ` ${venuePhrase}` : '';
  return (
    `Photorealistic editorial photograph of an elegant Filipino wedding reception${venueClause}. ` +
    `Recreate the exact layout and structure of the reference image as a real photo, featuring ` +
    phrases.join(', ') +
    `.${colorClause} Soft warm lighting, refined, high detail.`
  );
}
