/**
 * lib/event-needs.ts — WHAT THIS EVENT NEEDS (Level 1 onboarding, owner 2026-10-08).
 *
 * ⚖ DECISION_LOG 2026-10-08 "ONBOARDING FOLLOWS WHAT THE EVENT NEEDS — NOT EVERY EVENT WALKS THE
 * WHOLE PATH", owner verbatim: *"some events just need papic and no suppliers. some events does not
 * need guests and suppliers. one QR for all open invitation. but some needs some details."* — amended
 * the same day into Level 1 for the twenty types that ship ("ROADMAP AMENDED: ONBOARDING FOR THE EVENT
 * TYPES WE ALREADY HAVE MOVES INTO LEVEL 1"). Design: corpus `EVENT_COVERAGE_MATRIX_2026-10-08_fable.md`
 * §2 (the presets) · §3 (the one screen) and `prototypes/event_needs_onboarding_2026-10-08_fable.html`
 * frame 3 ("What do you need?") and frame 2 (a hangout after the Simple preset).
 *
 * 🔑 ONE HOME PER ANSWER (owner 2026-10-02). Three needs are stored, each in its own `events` column —
 * `guest_list_on` · `suppliers_on` · `hub_details_on` — NULL = never asked = ON, so every event made
 * before this reads exactly as it did (the `papic_on` shape, `lib/event-answers.ts`). "One QR for
 * everyone" is NOT stored here: it is the reply/entry the setup already writes (`rsvp_ask_config`,
 * `setupColumns`), so this module only maps the row onto those answers.
 *
 * 🔒 A NEED THAT IS OFF IS ABSENT, NEVER GREYED (matrix §2): Home, the Maker's stages and the Studio
 * tiles each drop what is off (the helpers at the bottom), and Home keeps ONE "Switch on more" row so
 * nothing is lost. ⚖ NOT THE BOTTOM BAR (owner 22 Oct 2026, "Fix both"): every event wears the
 * wedding's bar, whatever it left off — `lib/event-menu-gates.ts`.
 *
 * Pure and client-safe: no I/O, no React.
 */

/** The four presets that ship in Level 1 (matrix §2). "Organiser / expo" is Level 2 — never offered. */
export const NEED_PRESETS = ['simple', 'open', 'list', 'full'] as const;
export type NeedPreset = (typeof NEED_PRESETS)[number];

/** The dropdown's words (prototype frame 3: "Simple event · Papic + one QR"). */
export const NEED_PRESET_LABEL: Readonly<Record<NeedPreset, string>> = {
  simple: 'Simple event · Papic + one QR',
  open: 'Open event · one QR',
  list: 'Guest list + replies',
  full: 'Fully planned',
};

/** What the person picked, row by row. Papic has no switch — it is always on (frame 3: "always on"). */
export type EventNeeds = {
  /** One QR for everyone — anyone with the link gets in. */
  oneQr: boolean;
  /** Guest list & replies. */
  guestList: boolean;
  /** Suppliers (the Suppliers tab, Budget). Always false on a vendor-free type. */
  suppliers: boolean;
  /** Event Hub with details. False = "cover + photos only". */
  hubDetails: boolean;
};

export const NEEDS_OF_PRESET: Readonly<Record<NeedPreset, EventNeeds>> = {
  simple: { oneQr: true, guestList: false, suppliers: false, hubDetails: false },
  open: { oneQr: true, guestList: false, suppliers: true, hubDetails: true },
  list: { oneQr: false, guestList: true, suppliers: true, hubDetails: true },
  full: { oneQr: false, guestList: true, suppliers: true, hubDetails: true },
};

/**
 * The type's starting preset (matrix §2 "Default for"). Any type not named — a type an admin adds
 * later — starts on "Open event · one QR", the matrix's catch-all for a party.
 */
export const DEFAULT_PRESET_BY_TYPE: Readonly<Record<string, NeedPreset>> = {
  simple_event: 'simple',
  date: 'simple',
  hangout: 'simple',
  birthday: 'open',
  graduation: 'open',
  reunion: 'open',
  celebration: 'open',
  tournament: 'open',
  open_house: 'open',
  grand_opening: 'open',
  concert: 'open',
  wake: 'open',
  christening: 'list',
  anniversary: 'list',
  gender_reveal: 'list',
  corporate: 'list',
  travel: 'list',
  wedding: 'full',
  debut: 'full',
  gala_night: 'full',
};

export function defaultPresetFor(eventType: string): NeedPreset {
  return DEFAULT_PRESET_BY_TYPE[eventType] ?? 'open';
}

/** What a type can switch on at all — a vendor-free type (`marketplaceEnabled: false`) has no Suppliers row. */
export type NeedsScope = { marketplace: boolean };

/** A preset's needs for this type — Suppliers stays off where the type has no marketplace. */
export function needsForPreset(preset: NeedPreset, scope: NeedsScope): EventNeeds {
  const n = NEEDS_OF_PRESET[preset];
  return { ...n, suppliers: scope.marketplace && n.suppliers };
}

/** The type's starting needs. */
export function defaultNeedsFor(eventType: string, scope: NeedsScope): EventNeeds {
  return needsForPreset(defaultPresetFor(eventType), scope);
}

/** The rows of "What do you need?", in the prototype's order. */
export type NeedRow = 'papic' | 'oneQr' | 'guestList' | 'suppliers' | 'hubDetails';

export const NEED_ROW_LABEL: Readonly<Record<NeedRow, string>> = {
  papic: 'Photos with Papic',
  oneQr: 'One QR for everyone',
  guestList: 'Guest list & replies',
  suppliers: 'Suppliers',
  hubDetails: 'Event Hub with details',
};

/** The rows this type draws. Papic is always first and locked on. */
export function needRows(scope: NeedsScope): NeedRow[] {
  return ['papic', 'oneQr', 'guestList', ...(scope.marketplace ? (['suppliers'] as const) : []), 'hubDetails'];
}

/** Is the row on? */
export function needOn(row: NeedRow, n: EventNeeds): boolean {
  return row === 'papic' ? true : n[row];
}

/** The small word at the row's right (frame 3: "always on" · "no guest list" · "off" · "cover + photos only"). */
export function needRowSub(row: NeedRow, n: EventNeeds): string {
  switch (row) {
    case 'papic':
      return 'always on';
    case 'oneQr':
      return n.oneQr ? (n.guestList ? 'with your list' : 'no guest list') : 'off';
    case 'guestList':
      return n.guestList ? 'replies on' : 'off';
    case 'suppliers':
      return n.suppliers ? 'on' : 'off';
    case 'hubDetails':
      return n.hubDetails ? 'every page' : 'cover + photos only';
  }
}

/**
 * Tapping a row flips it alone (matrix §3). Papic never flips. Guests always have a way in: turning off
 * the last of "One QR" / "Guest list" turns the other on — an event nobody can get into is not a choice.
 */
export function toggleNeed(n: EventNeeds, row: NeedRow, scope: NeedsScope): EventNeeds {
  if (row === 'papic') return n;
  if (row === 'suppliers' && !scope.marketplace) return { ...n, suppliers: false };
  const next = { ...n, [row]: !n[row] } as EventNeeds;
  if (!next.oneQr && !next.guestList) {
    if (row === 'oneQr') next.guestList = true;
    else next.oneQr = true;
  }
  return next;
}

/**
 * The needs → the setup answers that already have a home (`setupColumns` writes them):
 *   · no guest list  → "Will guests reply? No", one QR for everyone, no "Add your guests" card;
 *   · a guest list   → replies on; with One QR as well, anyone with the link may ASK to come
 *                      ("Guest list + requests", `rsvp_ask_config.whoCanRsvp = 'anyone'`).
 * Papic is always on from this screen (frame 3).
 */
export function setupPatchFromNeeds(n: EventNeeds): {
  reply: 'yes' | 'no';
  entry: 'personal' | 'one_qr' | 'both';
  requests: boolean;
  guests?: 'later';
  papic: 'yes';
} {
  if (!n.guestList) return { reply: 'no', entry: 'one_qr', requests: false, guests: 'later', papic: 'yes' };
  return { reply: 'yes', entry: 'personal', requests: n.oneQr, papic: 'yes' };
}

/**
 * The setup answers as the needs leave them — the one merge the wizard, the Get-together form and
 * both commits share (the commits re-run it on what they re-read, never trusting the client's).
 */
export function applyNeedsToSetup<
  T extends { reply: 'yes' | 'no'; entry: 'personal' | 'one_qr' | 'both'; requests: boolean; papic: 'yes' | 'no'; guests: string | null },
>(a: T, n: EventNeeds): T {
  const patch = setupPatchFromNeeds(n);
  return {
    ...a,
    reply: patch.reply,
    entry: patch.entry,
    requests: patch.requests,
    papic: patch.papic,
    ...(patch.guests ? { guests: patch.guests } : {}),
  };
}

/** The needs → their columns. */
export function needsColumns(n: EventNeeds): { guest_list_on: boolean; suppliers_on: boolean; hub_details_on: boolean } {
  return { guest_list_on: n.guestList, suppliers_on: n.suppliers, hub_details_on: n.hubDetails };
}

export const EVENT_NEEDS_COLUMNS = ['guest_list_on', 'suppliers_on', 'hub_details_on'] as const;
export type EventNeedsColumn = (typeof EVENT_NEEDS_COLUMNS)[number];

/**
 * The Simple shape — no list, cover + photos only: the needs screen IS the whole onboarding
 * (matrix §0b AFTER: "Onboarding: ONE screen — Name · Where · When (optional) · What do you need?").
 */
export function needsAreTheWholeOnboarding(n: Pick<EventNeeds, 'guestList' | 'hubDetails'>): boolean {
  return !n.guestList && !n.hubDetails;
}

/** The wire is never trusted: three booleans or the preset's defaults. */
export function sanitizeNeeds(raw: unknown, fallback: EventNeeds, scope: NeedsScope): EventNeeds {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return fallback;
  const r = raw as Record<string, unknown>;
  const b = (k: keyof EventNeeds) => (typeof r[k] === 'boolean' ? (r[k] as boolean) : fallback[k]);
  const n: EventNeeds = { oneQr: b('oneQr'), guestList: b('guestList'), suppliers: scope.marketplace && b('suppliers'), hubDetails: b('hubDetails') };
  if (!n.oneQr && !n.guestList) n.oneQr = true;
  return n;
}

// ═══════════════════════════════════════════════════════════════════════════
// READING IT BACK — what the dashboard draws
// ═══════════════════════════════════════════════════════════════════════════

/** What an event row holds. NULL / absent = never asked = ON. */
export type EventNeedsRow = Partial<Record<EventNeedsColumn, boolean | null>>;

/** The three needs as the dashboard reads them. */
export type EventNeedsRead = { guestList: boolean; suppliers: boolean; hubDetails: boolean };

export function readEventNeeds(row: EventNeedsRow | null | undefined): EventNeedsRead {
  return {
    guestList: row?.guest_list_on !== false,
    suppliers: row?.suppliers_on !== false,
    hubDetails: row?.hub_details_on !== false,
  };
}

/**
 * The menu keys of what this event left off: Guests · Suppliers. ⚖ The BAR no longer drops them (owner
 * 22 Oct 2026 — `lib/event-menu-gates.ts`); only `/dev/bar-lab?was=1` replays the old rule with this.
 */
export function needsHiddenNavKeys(n: EventNeedsRead): string[] {
  return [...(n.guestList ? [] : ['guests']), ...(n.suppliers ? [] : ['explore'])];
}

/**
 * The Maker's stages this event drops (matrix §3 table + §0b AFTER):
 *   · Event Hub "cover + photos only" → ONE stage, The Day (cover + the Papic gallery);
 *   · no guest list → no RSVP stage and no Save the Date (there is nobody on a list to tell first).
 * Keys are the Maker's own (`MAKER_PAGE_STAGES`: save_the_date · rsvp-stage · rsvp · event · editorial).
 */
export function needsHidesStage(stage: string, n: EventNeedsRead): boolean {
  if (!n.hubDetails) return stage !== 'event';
  if (!n.guestList) return stage === 'rsvp-stage' || stage === 'save_the_date';
  return false;
}

/**
 * The Studio tiles this event drops (`studioTiles` keys): "cover + photos only" keeps Info · Look
 * (prototype frame 2: "two Studio tiles (Info · Look/colours)"); no guest list drops RSVP.
 */
export function needsHidesStudioTile(tile: string, n: EventNeedsRead): boolean {
  if (!n.hubDetails) return tile !== 'info' && tile !== 'look';
  if (!n.guestList) return tile === 'rsvp';
  return false;
}

/** Home's "Switch on more" — the needs that are off, in the prototype's words (frame 2). */
export type SwitchOnNeed = 'guests' | 'suppliers' | 'hub';

export const SWITCH_ON_LABEL: Readonly<Record<SwitchOnNeed, string>> = {
  guests: 'Guest list',
  suppliers: 'Suppliers',
  hub: 'Invitation',
};

export function switchOnRows(n: EventNeedsRead, scope: NeedsScope): SwitchOnNeed[] {
  return [
    ...(n.guestList ? [] : (['guests'] as const)),
    ...(n.suppliers || !scope.marketplace ? [] : (['suppliers'] as const)),
    ...(n.hubDetails ? [] : (['hub'] as const)),
  ];
}

/** The column a "Switch on" writes, and where it lands next (matrix §2: the shipped setup for that need). */
export const SWITCH_ON: Readonly<Record<SwitchOnNeed, { column: EventNeedsColumn; to: (base: string) => string }>> = {
  guests: { column: 'guest_list_on', to: (base) => `${base}/guests` },
  suppliers: { column: 'suppliers_on', to: (base) => `${base}/vendors` },
  hub: { column: 'hub_details_on', to: (base) => `${base}/launch` },
};

export function isSwitchOnNeed(v: unknown): v is SwitchOnNeed {
  return v === 'guests' || v === 'suppliers' || v === 'hub';
}

// ═══════════════════════════════════════════════════════════════════════════
// PER TYPE — the limit line and the dress default
// ═══════════════════════════════════════════════════════════════════════════

/**
 * The one plain sentence a type says about what it cannot do yet (matrix §1b "The limit line …
 * honest, never apologetic"). Words are the matrix's; the three it does not word are marked.
 */
export const LIMIT_LINE_BY_TYPE: Readonly<Record<string, string>> = {
  wedding: 'Everything is here. Cord, coins and arrhae are not tracked as items yet.',
  debut: '18 Roses · Candles · Treasures are guest roles; the dance order is not timed.',
  birthday: 'One QR for everyone by default. Face tagging is on — turn it off for a child’s party if you prefer.',
  christening: 'Ninong and Ninang are on the list. No sponsor letters or counts yet.',
  anniversary: 'Yearly by itself — the years are counted for you.',
  corporate: 'Replies and seats work. No name badges or check-in desk beyond the QR.',
  celebration: 'A party with one QR. Switch on a guest list or suppliers any time.',
  hangout: 'Name, place, Papic. That’s it — switch more on if the night grows.',
  simple_event: 'Name, place, Papic. No suppliers, no list.',
  gender_reveal: 'Photos and a short list. The reveal is not tied to a camera moment yet.',
  reunion: 'One QR; a list if you want a headcount. No batch import.',
  graduation: 'Photos and a Hub. The ceremony itself is the school’s.',
  tournament: 'Fixtures are schedule rows. No brackets, scores or teams.',
  concert: 'Open crowd, one free QR. No tickets, no gates, no capacity.',
  open_house: 'One QR is the door. No lead capture, no promos.',
  grand_opening: 'One QR is the door. No lead capture, no promos.',
  wake: 'Quiet camera, no countdown. Pasiyam rows and a gift of sympathy are here.',
  travel: 'Days, not a date. No Live, no seats, no itinerary beyond the schedule.',
  // ⚠ Not worded in §1b for the type itself — `date` takes its Valentine's label line (§1b seasons table),
  // `gala_night` the limits column of §1 ("No awards/winners part; no table-sponsor sale; no ticketing").
  date: 'Two people, one camera. Nothing to plan.',
  gala_night: 'No awards part, no table-sponsor sale, no ticketing.',
};

export function limitLineFor(eventType: string): string | null {
  return LIMIT_LINE_BY_TYPE[eventType] ?? null;
}

/**
 * The Mood Board's level per type (matrix §1 "Dress"; the owner's 2026-10-08 ruling *"If no dress
 * code, no need for complicated moodboards. just the colors will do."*): `full` = figures, attire by
 * role, Do's & Don'ts · `colours` = the five colours only · `none` = no dress code at all.
 */
export type MoodLevel = 'full' | 'colours' | 'none';

export const DRESS_DEFAULT_BY_TYPE: Readonly<Record<string, MoodLevel>> = {
  wedding: 'full',
  debut: 'full',
  gala_night: 'full',
  birthday: 'colours',
  christening: 'colours',
  anniversary: 'colours',
  reunion: 'colours',
  celebration: 'colours',
};

export function dressDefaultFor(eventType: string): MoodLevel {
  return DRESS_DEFAULT_BY_TYPE[eventType] ?? 'none';
}
