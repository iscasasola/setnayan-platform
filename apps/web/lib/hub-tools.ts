/**
 * hub-tools.ts — the ONE shared Hub tool library, the approved per-category seed, and the pure reader the supplier
 * Hub will use (owner 2026-10-28, DECISION_LOG "HUB TOOLS BY SERVICE — THE FULL LIST IS THE SEED; ONE SHARED LIBRARY,
 * NEVER PER-SERVICE COPIES" + "HUB TOOLS BY SERVICE — APPROVED AS THE STARTING SET"; the scan modes from 2026-10-03
 * "SUPPLIER SCAN = ALL FIVE MODES").
 *
 * 🔑 A TOOL IS CODE; A SWITCH CANNOT INVENT ONE. The library below is generated from the approved prototype
 * (`prototypes/hub_tools_by_service_2026-10-28/index.html` — 43 tools, 80 services). Admin › Categories › Hub tools
 * stores which tool RECORDS are on per category (`category_hub_tool_switches`) and the default scan mode
 * (`category_hub_settings`); the tools themselves are records in `hub_tools` (key · name · template), seeded from here; a category nobody has
 * saved reads its seed row, matched by name; a category the seed does not name reads the seed's "Everything else".
 *
 * ⏳ NOT BUILT HERE: the supplier-side Hub that DRAWS these tools. `hubToolsFor` is the reader it will call. The three
 * privacy picks (Medic health notes · Mobile Bar adult/minor · Insurance names) still wait for the owner's yes — they
 * are switches here, never data.
 *
 * Pure: no React, no database.
 */

export type ScanMode = 'once' | 'ordered_received' | 'unlimited' | 'group_session' | 'roaming';

/** The five scan modes, in the order the owner listed them (2026-10-03). */
export const SCAN_MODES: ReadonlyArray<{ key: ScanMode; label: string }> = [
  { key: 'once', label: 'Once' },
  { key: 'ordered_received', label: 'Ordered → Received' },
  { key: 'unlimited', label: 'Unlimited' },
  { key: 'group_session', label: 'Group session' },
  { key: 'roaming', label: 'Roaming' },
];

export function isScanMode(v: unknown): v is ScanMode {
  return typeof v === 'string' && SCAN_MODES.some((m) => m.key === v);
}

/**
 * THE EIGHT TEMPLATES (owner-approved 2026-10-28, `prototypes/hub_tools_working_2026-10-28/` +
 * `admin_tool_maker_2026-10-28/`). EVERY tool is one of these — a tool is a RECORD (key · name · template), never a
 * hand-built screen, so the later Tool maker adds a tool by adding a record. Neither the templates' screens nor the
 * maker is built here; this only fixes the shape so that later build fits.
 * ⚖ Which template each seed tool takes is the builder's reading of the tool's name (the prototype lists the eight
 * but does not assign them) — admin will be able to change it in the Tool maker.
 */
export const HUB_TOOL_TEMPLATES = [
  { key: 'checklist', label: 'Checklist', what: 'tick items' },
  { key: 'per_person', label: 'Per-person sheet', what: 'a row per person' },
  { key: 'live_timeline', label: 'Live timeline', what: 'runs on the day' },
  { key: 'counter', label: 'Counter', what: '＋ / − count' },
  { key: 'ordered_list', label: 'Ordered list', what: 'drag to order' },
  { key: 'plan', label: 'Plan', what: 'tables / floor' },
  { key: 'media', label: 'Media', what: 'photos & video' },
  { key: 'log', label: 'Log', what: 'time-stamped notes' },
] as const;
export type HubToolTemplate = (typeof HUB_TOOL_TEMPLATES)[number]['key'];

/** One tool as a record — what `hub_tools` holds and what the Tool maker will write. */
export type HubToolRecord = { key: string; label: string; template: HubToolTemplate };

type HubToolsSeedRow = { group: string; category: string; tools: readonly string[]; scan: ScanMode };

/* ── GENERATED from the approved prototype (do not hand-edit the lists — regenerate) ── */
export const HUB_TOOL_LIBRARY = [
  { key: "fittings_and_measurements", label: "Fittings & measurements", template: "per_person", shipped: false },
  { key: "delivery_and_drop_off", label: "Delivery & drop-off", template: "checklist", shipped: false },
  { key: "entourage", label: "Entourage", template: "per_person", shipped: false },
  { key: "looks_per_person", label: "Looks per person", template: "per_person", shipped: false },
  { key: "chair_schedule", label: "Chair schedule", template: "ordered_list", shipped: false },
  { key: "photo_upload", label: "Photo upload (Photo by · credits)", template: "media", shipped: false },
  { key: "personalisation_list", label: "Personalisation list", template: "per_person", shipped: false },
  { key: "wellness_plan", label: "Wellness plan", template: "plan", shipped: false },
  { key: "queue_counter", label: "Queue counter", template: "counter", shipped: false },
  { key: "papic_camera", label: "Papic camera", template: "media", shipped: true },
  { key: "quantity_vs_guests", label: "Quantity vs guests", template: "counter", shipped: false },
  { key: "dietary_and_allergies", label: "Dietary & allergies", template: "per_person", shipped: false },
  { key: "load_in_and_venue_access", label: "Load-in & venue access", template: "checklist", shipped: false },
  { key: "pick_up_times_and_routes", label: "Pick-up times & routes", template: "live_timeline", shipped: false },
  { key: "headcount", label: "Headcount", template: "counter", shipped: true },
  { key: "itinerary", label: "Itinerary", template: "live_timeline", shipped: false },
  { key: "tables_and_seating", label: "Tables & seating", template: "plan", shipped: false },
  { key: "serving_times", label: "Serving times", template: "live_timeline", shipped: false },
  { key: "crew_roster", label: "Crew roster", template: "per_person", shipped: false },
  { key: "floor_command", label: "Floor Command", template: "live_timeline", shipped: true },
  { key: "run_of_show", label: "Run of show (live)", template: "live_timeline", shipped: true },
  { key: "march", label: "March (read)", template: "live_timeline", shipped: true },
  { key: "paperwork_checklist", label: "Paperwork checklist", template: "checklist", shipped: false },
  { key: "reservation_slots", label: "Reservation slots", template: "ordered_list", shipped: false },
  { key: "remembrance_schedule", label: "Remembrance schedule", template: "live_timeline", shipped: false },
  { key: "emcee_script", label: "Emcee script", template: "live_timeline", shipped: true },
  { key: "march_cue_sheet", label: "March cue sheet (live)", template: "live_timeline", shipped: false },
  { key: "song_desk", label: "Song Desk", template: "ordered_list", shipped: true },
  { key: "set_list", label: "Set list", template: "ordered_list", shipped: false },
  { key: "tech_rider", label: "Tech rider", template: "checklist", shipped: false },
  { key: "ceremony_details", label: "Ceremony details", template: "checklist", shipped: false },
  { key: "live_studio", label: "Live Studio", template: "media", shipped: true },
  { key: "rehearsal_and_cues", label: "Rehearsal & cues", template: "live_timeline", shipped: false },
  { key: "insured_people_list", label: "Insured people list", template: "per_person", shipped: false },
  { key: "proofs_and_approval", label: "Proofs & approval", template: "checklist", shipped: false },
  { key: "incident_log", label: "Incident log", template: "log", shipped: false },
  { key: "brackets_and_scoring", label: "Brackets & scoring", template: "ordered_list", shipped: false },
  { key: "shot_list", label: "Shot list", template: "checklist", shipped: false },
  { key: "photo_delivery", label: "Photo delivery", template: "media", shipped: false },
  { key: "reveal_cue", label: "Reveal cue", template: "live_timeline", shipped: false },
  { key: "floor_plan", label: "Floor plan", template: "plan", shipped: false },
  { key: "safety_permit_and_cue", label: "Safety permit & cue", template: "checklist", shipped: false },
  { key: "room_list", label: "Room list", template: "per_person", shipped: false },
] as const;

export const HUB_TOOLS_SEED: ReadonlyArray<HubToolsSeedRow> = [
  { group: "Attire, hair & make-up", category: "Bride's Attire", tools: ["fittings_and_measurements", "delivery_and_drop_off", "entourage"], scan: "once" },
  { group: "Attire, hair & make-up", category: "Groom's Attire", tools: ["fittings_and_measurements", "delivery_and_drop_off"], scan: "once" },
  { group: "Attire, hair & make-up", category: "Filipiniana & Barongs", tools: ["fittings_and_measurements", "entourage", "delivery_and_drop_off"], scan: "once" },
  { group: "Attire, hair & make-up", category: "Men's Attire", tools: ["fittings_and_measurements", "entourage"], scan: "once" },
  { group: "Attire, hair & make-up", category: "Women's Attire", tools: ["fittings_and_measurements", "entourage"], scan: "once" },
  { group: "Attire, hair & make-up", category: "HMUA", tools: ["looks_per_person", "chair_schedule", "entourage", "photo_upload"], scan: "ordered_received" },
  { group: "Attire, hair & make-up", category: "Grooming", tools: ["chair_schedule", "entourage"], scan: "ordered_received" },
  { group: "Attire, hair & make-up", category: "Jewelleries & Accessories", tools: ["delivery_and_drop_off", "personalisation_list"], scan: "once" },
  { group: "Attire, hair & make-up", category: "Wellness & Fitness", tools: ["wellness_plan"], scan: "unlimited" },
  { group: "Booths, carts & bars", category: "Photo Booth", tools: ["photo_upload", "queue_counter", "papic_camera"], scan: "group_session" },
  { group: "Booths, carts & bars", category: "Mobile Bar", tools: ["queue_counter", "quantity_vs_guests", "dietary_and_allergies"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Mocktail", tools: ["queue_counter", "quantity_vs_guests"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Coffee / Espresso", tools: ["queue_counter", "quantity_vs_guests"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Dessert", tools: ["quantity_vs_guests", "dietary_and_allergies"], scan: "once" },
  { group: "Booths, carts & bars", category: "Food Cart", tools: ["quantity_vs_guests", "dietary_and_allergies"], scan: "once" },
  { group: "Booths, carts & bars", category: "Food Truck", tools: ["queue_counter", "dietary_and_allergies", "load_in_and_venue_access"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Arcade / Games", tools: ["queue_counter"], scan: "unlimited" },
  { group: "Booths, carts & bars", category: "Caricature / Calligraphy / Painting", tools: ["queue_counter", "personalisation_list", "photo_upload"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Engraving / Embroidery", tools: ["personalisation_list", "queue_counter"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Henna / Tattoo", tools: ["queue_counter"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Massage Chair", tools: ["queue_counter"], scan: "unlimited" },
  { group: "Booths, carts & bars", category: "Mini Nail Bar", tools: ["queue_counter"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Perfume Bar", tools: ["queue_counter", "personalisation_list"], scan: "ordered_received" },
  { group: "Booths, carts & bars", category: "Tarot / Astrology / Palmistry", tools: ["queue_counter"], scan: "ordered_received" },
  { group: "Cars & transport", category: "Bridal Car", tools: ["pick_up_times_and_routes", "entourage"], scan: "once" },
  { group: "Cars & transport", category: "Guest Shuttle", tools: ["pick_up_times_and_routes", "headcount"], scan: "unlimited" },
  { group: "Cars & transport", category: "Transfers & Rentals", tools: ["pick_up_times_and_routes", "itinerary"], scan: "once" },
  { group: "Cars & transport", category: "Escort", tools: ["pick_up_times_and_routes"], scan: "unlimited" },
  { group: "Catering & cake", category: "Catering", tools: ["headcount", "dietary_and_allergies", "tables_and_seating", "serving_times"], scan: "ordered_received" },
  { group: "Catering & cake", category: "Cake", tools: ["delivery_and_drop_off", "serving_times"], scan: "once" },
  { group: "Catering & cake", category: "Stations", tools: ["headcount", "dietary_and_allergies", "serving_times", "queue_counter"], scan: "unlimited" },
  { group: "Catering & cake", category: "Crew Meals", tools: ["crew_roster", "serving_times"], scan: "once" },
  { group: "Coordinators & planners", category: "Coordinator / Planner", tools: ["floor_command", "run_of_show", "march", "entourage"], scan: "roaming" },
  { group: "Coordinators & planners", category: "Date & Feng-shui Specialist", tools: ["paperwork_checklist"], scan: "once" },
  { group: "Coordinators & planners", category: "Paperwork & Government", tools: ["paperwork_checklist"], scan: "once" },
  { group: "Coordinators & planners", category: "Travel & Honeymoon", tools: ["itinerary", "paperwork_checklist"], scan: "once" },
  { group: "Dining extras", category: "Restaurant (Reservation)", tools: ["reservation_slots", "headcount", "dietary_and_allergies"], scan: "once" },
  { group: "Funeral homes & farewell", category: "Funeral Home", tools: ["remembrance_schedule", "headcount", "paperwork_checklist"], scan: "unlimited" },
  { group: "Funeral homes & farewell", category: "Memorial Park", tools: ["remembrance_schedule", "pick_up_times_and_routes", "paperwork_checklist"], scan: "once" },
  { group: "Funeral homes & farewell", category: "Cremation", tools: ["remembrance_schedule", "paperwork_checklist"], scan: "once" },
  { group: "Guest experiences", category: "Tour Guide", tools: ["itinerary", "headcount"], scan: "unlimited" },
  { group: "Guest experiences", category: "Tours & Activities", tools: ["itinerary", "headcount", "reservation_slots"], scan: "once" },
  { group: "Hosts, music & program", category: "Host / MC", tools: ["emcee_script", "run_of_show", "entourage"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Live Band", tools: ["march_cue_sheet", "song_desk", "set_list", "tech_rider"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Wedding Singer", tools: ["march_cue_sheet", "song_desk", "set_list"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Choir", tools: ["march_cue_sheet", "set_list", "ceremony_details"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Orchestra", tools: ["march_cue_sheet", "set_list", "tech_rider"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "DJ", tools: ["song_desk", "set_list", "run_of_show", "tech_rider"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "AV / Production", tools: ["tech_rider", "run_of_show", "live_studio", "load_in_and_venue_access"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Choreographer", tools: ["rehearsal_and_cues", "entourage"], scan: "once" },
  { group: "Hosts, music & program", category: "Performers", tools: ["run_of_show", "tech_rider"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Kids' Entertainer", tools: ["headcount", "run_of_show"], scan: "unlimited" },
  { group: "Hosts, music & program", category: "Speakers / Talent", tools: ["run_of_show", "tech_rider"], scan: "unlimited" },
  { group: "Insurance & protection", category: "Event Insurance", tools: ["insured_people_list", "paperwork_checklist"], scan: "once" },
  { group: "Insurance & protection", category: "Personal Accident", tools: ["insured_people_list"], scan: "once" },
  { group: "Insurance & protection", category: "Travel Insurance", tools: ["insured_people_list", "itinerary"], scan: "once" },
  { group: "Invites, prints & souvenirs", category: "Printing", tools: ["proofs_and_approval", "personalisation_list", "delivery_and_drop_off"], scan: "once" },
  { group: "Invites, prints & souvenirs", category: "Souvenir / Giveaways", tools: ["quantity_vs_guests", "personalisation_list", "delivery_and_drop_off"], scan: "once" },
  { group: "Invites, prints & souvenirs", category: "Trophies & Awards", tools: ["personalisation_list", "proofs_and_approval", "run_of_show"], scan: "once" },
  { group: "Logistics & safety", category: "Medic / First-aid", tools: ["incident_log", "headcount"], scan: "roaming" },
  { group: "Logistics & safety", category: "Referees / Officials", tools: ["brackets_and_scoring", "run_of_show"], scan: "unlimited" },
  { group: "Logistics & safety", category: "Everything else", tools: ["delivery_and_drop_off"], scan: "unlimited" },
  { group: "Photo & video", category: "Photo & Video", tools: ["shot_list", "entourage", "photo_upload", "photo_delivery", "papic_camera"], scan: "roaming" },
  { group: "Photo & video", category: "Editorial", tools: ["shot_list", "photo_upload", "photo_delivery"], scan: "roaming" },
  { group: "Photo & video", category: "Livestream", tools: ["live_studio", "run_of_show", "tech_rider"], scan: "unlimited" },
  { group: "Specialty", category: "Reveal Element", tools: ["reveal_cue", "run_of_show"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Stylist / Decorator", tools: ["floor_plan", "load_in_and_venue_access", "tables_and_seating"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Florist", tools: ["delivery_and_drop_off", "entourage", "load_in_and_venue_access"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Lights & Sound", tools: ["tech_rider", "load_in_and_venue_access", "run_of_show"], scan: "unlimited" },
  { group: "Styling, flowers & lights", category: "LED Wall", tools: ["tech_rider", "load_in_and_venue_access", "run_of_show"], scan: "unlimited" },
  { group: "Styling, flowers & lights", category: "Chairs & tents", tools: ["floor_plan", "headcount", "load_in_and_venue_access"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Dance Floor", tools: ["floor_plan", "load_in_and_venue_access"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Fireworks", tools: ["safety_permit_and_cue", "run_of_show"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Outdoor", tools: ["floor_plan", "load_in_and_venue_access"], scan: "once" },
  { group: "Styling, flowers & lights", category: "Digital Services", tools: ["run_of_show", "delivery_and_drop_off"], scan: "unlimited" },
  { group: "Venues & churches", category: "Reception", tools: ["floor_plan", "tables_and_seating", "headcount", "load_in_and_venue_access"], scan: "unlimited" },
  { group: "Venues & churches", category: "Ceremony", tools: ["ceremony_details", "paperwork_checklist", "headcount"], scan: "once" },
  { group: "Venues & churches", category: "Accommodation", tools: ["room_list", "headcount"], scan: "once" },
  { group: "Venues & churches", category: "Officiants", tools: ["ceremony_details", "paperwork_checklist"], scan: "once" },
  { group: "Venues & churches", category: "Counseling & Seminars", tools: ["paperwork_checklist", "reservation_slots"], scan: "once" },
];

export type HubToolKey = (typeof HUB_TOOL_LIBRARY)[number]['key'];

const LIBRARY_KEYS: ReadonlySet<string> = new Set(HUB_TOOL_LIBRARY.map((t) => t.key));

/** A key of the CODE seed library (the database library may hold more once the Tool maker exists). */
export function isHubToolKey(v: unknown): v is HubToolKey {
  return typeof v === 'string' && LIBRARY_KEYS.has(v);
}

/** The code library as records — the SEED of `hub_tools` (migration 20271293237246 inserts exactly these). */
export const HUB_TOOL_RECORDS: readonly HubToolRecord[] = HUB_TOOL_LIBRARY.map((t) => ({ key: t.key, label: t.label, template: t.template }));

export function isHubToolTemplate(v: unknown): v is HubToolTemplate {
  return typeof v === 'string' && HUB_TOOL_TEMPLATES.some((t) => t.key === v);
}

/** The seed's catch-all row — what a category the prototype does not name starts with. */
export const HUB_TOOLS_FALLBACK = HUB_TOOLS_SEED.find((r) => r.category === 'Everything else')!;

/** Names compare loosely: case, "&"/"and", punctuation and spacing never decide a match. */
export function nameKey(s: string): string {
  return s
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

const SEED_BY_NAME: ReadonlyMap<string, HubToolsSeedRow> = new Map(HUB_TOOLS_SEED.map((r) => [nameKey(r.category), r]));

/** The seed row for a category's name, or the catch-all. `matched` says which. */
export function seedFor(categoryLabel: string): { row: HubToolsSeedRow; matched: boolean } {
  const hit = SEED_BY_NAME.get(nameKey(categoryLabel));
  return hit ? { row: hit, matched: true } : { row: HUB_TOOLS_FALLBACK, matched: false };
}

/**
 * What an admin saved for one category: its scan default (`category_hub_settings` — the row's presence IS "saved")
 * and the tools switched on (`category_hub_tool_switches`, one row per tool record).
 */
export type HubToolsSaved = { scan_default: string | null; tools: readonly string[] };

export type HubToolsAnswer = {
  /** Tool keys switched on, in LIBRARY order (never the stored order). */
  tools: string[];
  scan: ScanMode;
  /** saved = an admin saved this category · seed = the approved starting set · fallback = "Everything else". */
  source: 'saved' | 'seed' | 'fallback';
};

/**
 * THE READER — what a booked supplier of this category gets in their Hub.
 * `library` = the ACTIVE tool records (`hub_tools` where is_active; the code seed when not given). A tool switched
 * off in the library (Turn off keeps data) simply drops out — its switches stay stored for when it comes back.
 */
export function hubToolsFor(
  categoryLabel: string,
  saved: HubToolsSaved | null | undefined,
  library: readonly HubToolRecord[] = HUB_TOOL_RECORDS,
): HubToolsAnswer {
  const inOrder = (on: ReadonlySet<string>) => library.filter((t) => on.has(t.key)).map((t) => t.key);
  if (saved) {
    return {
      tools: inOrder(new Set(saved.tools ?? [])),
      scan: isScanMode(saved.scan_default) ? saved.scan_default : 'once',
      source: 'saved',
    };
  }
  const { row, matched } = seedFor(categoryLabel);
  return { tools: inOrder(new Set(row.tools)), scan: row.scan, source: matched ? 'seed' : 'fallback' };
}

/**
 * The save's input, validated against the ACTIVE library — the action's whole decision lives here so a test can CALL
 * it. Refuses (null) an unknown scan mode or a tool the library does not hold: a switch can only name a tool record.
 */
export function parseHubToolsSave(
  input: { categoryId: unknown; tools: readonly unknown[]; scan: unknown },
  library: readonly HubToolRecord[] = HUB_TOOL_RECORDS,
): { categoryId: string; tools: string[]; scan: ScanMode } | null {
  const categoryId = typeof input.categoryId === 'string' ? input.categoryId.trim() : '';
  if (!categoryId || categoryId.length > 120) return null;
  if (!isScanMode(input.scan)) return null;
  const known = new Set(library.map((t) => t.key));
  if (!input.tools.every((t) => typeof t === 'string' && known.has(t))) return null;
  const on = new Set(input.tools as string[]);
  return { categoryId, tools: library.filter((t) => on.has(t.key)).map((t) => t.key), scan: input.scan };
}
