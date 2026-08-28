/**
 * Run-of-Show — the free, deterministic day-of program for NON-WEDDING events.
 *
 * Weddings already get a schedule spine (buildScheduleSeed in ./schedule.ts —
 * Ceremony · Cocktails · Reception · After Party + ceremony-type parts). Every
 * OTHER event type had nothing: the schedule opened empty and the host built the
 * whole program by hand. This authors a per-type Filipino program (the real
 * beats an emcee runs — the 18s, the reveal, the jubilarian walk, the bracket
 * day's parade and awarding) and ENRICHES it from what the host captured at
 * onboarding (`signature_details`, the specialty layer): a debut with a
 * captured cotillion gets a Cotillion beat;
 * a reunion with a matching shirt gets a "wear your reunion shirt" note; an
 * anniversary that opted into a renewal gets a Renewal-of-Vows beat.
 *
 * Owner-locked 2026-07-12: Run-of-Show is FREE (not a paid Kasangga tier). And
 * Rule 1: this is 100% deterministic — authored templates + captured signals,
 * no LLM, no per-call cost. Output quality = template richness × brief richness.
 *
 * The result is a plain list of editable schedule blocks the host reshapes — a
 * head start, never a straitjacket. Seeded once on the schedule's first open
 * (see seedNonWeddingRunOfShow in the schedule server action); after that the
 * blocks are the host's to move, rename, and delete.
 */
import type { ScheduleBlockType } from './schedule';

/** One inserted schedule block, already anchored to the event date. */
export type RunOfShowSeedBlock = {
  label: string;
  block_type: ScheduleBlockType;
  start_at: string; // ISO
  end_at: string; // ISO
  sort_order: number;
  is_public: boolean;
  notes: string | null;
};

type Sig = Record<string, unknown> | null | undefined;

/** An authored program beat in local clock time; anchored to the event date at
 *  seed time. `when` gates a beat on a captured signal (a beat with no `when`
 *  always shows — it is core to the event type); `note` enriches it from the
 *  brief. */
type Beat = {
  label: string;
  type: ScheduleBlockType;
  hour: number;
  min: number;
  durMin: number;
  isPublic?: boolean; // default true
  when?: (s: Sig) => boolean;
  note?: (s: Sig) => string | null;
};

// ── signal readers (shared shape with specialty-recommendations) ──
const rows = (s: Sig, key: string): Array<Record<string, unknown>> => {
  const v = s?.[key];
  return Array.isArray(v) ? (v as Array<Record<string, unknown>>) : [];
};
const str = (s: Sig, key: string): string => {
  const v = s?.[key];
  return typeof v === 'string' ? v.trim() : '';
};
const truthy = (s: Sig, key: string): boolean => {
  const v = s?.[key];
  return v === true || v === 'true' || v === 'yes';
};
const nameList = (r: Array<Record<string, unknown>>): string =>
  r
    .map((x) => (typeof x?.name === 'string' ? x.name.trim() : ''))
    .filter(Boolean)
    .join(', ');
/** `nameList` for a roster whose item key is NOT `name` — the tournament lists
 *  key their cells `division` / `team_name` / `team_muse` (specialty-catalog). */
const cellList = (r: Array<Record<string, unknown>>, key: string): string[] =>
  r
    .map((x) => (typeof x?.[key] === 'string' ? (x[key] as string).trim() : ''))
    .filter(Boolean);
/** A multiselect field: the persisted shape is a dense string[] (see
 *  normalizeSpecialtyValues), so anything else reads as "not captured". */
const choices = (s: Sig, key: string): string[] => {
  const v = s?.[key];
  return Array.isArray(v) ? v.filter((x): x is string => typeof x === 'string' && x.trim() !== '') : [];
};
/** Humanize a captured enum token; unknown/absent tokens read as ''. */
const label = (map: Record<string, string>, token: string): string => map[token] ?? '';

// ─────────────────────────── per-type programs ───────────────────────────
// Each returns the ordered beats for that type. Core beats are unconditional;
// a few are gated on a captured signal so we never promise a beat the host
// isn't running (e.g. a cotillion, a renewal of vows, an in-memoriam).

const DEBUT: Beat[] = [
  { label: 'Guest arrival & registration', type: 'pre_ceremony', hour: 17, min: 0, durMin: 60 },
  {
    label: 'Grand entrance of the debutante',
    type: 'program',
    hour: 18,
    min: 0,
    durMin: 15,
    note: (s) => (str(s, 'grand_entrance_production') ? `Production: ${str(s, 'grand_entrance_production')}` : null),
  },
  { label: 'Dinner', type: 'dinner', hour: 18, min: 15, durMin: 60 },
  {
    label: '18 Roses',
    type: 'program',
    hour: 19,
    min: 15,
    durMin: 30,
    note: (s) => {
      const n = rows(s, 'eighteen_roses').length;
      return n ? `${n} confirmed so far.` : null;
    },
  },
  {
    label: '18 Candles',
    type: 'program',
    hour: 19,
    min: 45,
    durMin: 30,
    note: (s) => {
      const names = nameList(rows(s, 'eighteen_candles'));
      return names ? `Candles: ${names}` : null;
    },
  },
  { label: '18 Treasures', type: 'program', hour: 20, min: 15, durMin: 20 },
  {
    label: 'Cotillion de honor',
    type: 'program',
    hour: 20,
    min: 35,
    durMin: 20,
    when: (s) => rows(s, 'cotillion').length > 0,
    note: (s) => `Court of ${rows(s, 'cotillion').length}. Schedule rehearsals 4–8 weeks out.`,
  },
  {
    label: 'Father–daughter waltz',
    type: 'dancing',
    hour: 20,
    min: 55,
    durMin: 15,
    when: (s) => truthy(s, 'father_daughter_waltz') || rows(s, 'cotillion').length > 0,
  },
  { label: "Debutante's message & thank-you", type: 'program', hour: 21, min: 10, durMin: 15 },
  { label: 'Open dancing & socials', type: 'dancing', hour: 21, min: 25, durMin: 65 },
  { label: 'Send-off', type: 'send_off', hour: 22, min: 30, durMin: 15 },
];

const BIRTHDAY: Beat[] = [
  { label: 'Guest arrival', type: 'pre_ceremony', hour: 15, min: 0, durMin: 30 },
  {
    label: 'Games & program',
    type: 'program',
    hour: 15,
    min: 30,
    durMin: 30,
    note: (s) => (truthy(s, 'palabunutan') ? 'Palabunutan (raffle) planned — prepare tickets & prizes.' : null),
  },
  { label: 'Merienda / meal', type: 'dinner', hour: 16, min: 0, durMin: 30 },
  { label: 'Blowing of candles & cake', type: 'program', hour: 16, min: 30, durMin: 20 },
  { label: 'Message from the celebrant & family', type: 'program', hour: 16, min: 50, durMin: 15 },
  { label: 'Socials', type: 'dancing', hour: 17, min: 5, durMin: 55 },
];

const CHRISTENING: Beat[] = [
  { label: 'Assembly at the church', type: 'pre_ceremony', hour: 9, min: 0, durMin: 30 },
  {
    label: 'Baptism rite / Mass',
    type: 'ceremony',
    hour: 9,
    min: 30,
    durMin: 60,
    note: (s) => (str(s, 'officiant_parish') ? `Parish: ${str(s, 'officiant_parish')}` : null),
  },
  { label: 'Photos at the church', type: 'custom', hour: 10, min: 30, durMin: 30, isPublic: false },
  { label: 'Reception / handaan', type: 'reception', hour: 11, min: 0, durMin: 30 },
  { label: 'Lunch', type: 'dinner', hour: 11, min: 30, durMin: 45 },
  {
    label: 'Message from parents & ninong/ninang',
    type: 'program',
    hour: 12,
    min: 15,
    durMin: 20,
    note: (s) => {
      const n = rows(s, 'godparents_principal').length + rows(s, 'godparents_secondary').length;
      return n ? `${n} godparents invited.` : null;
    },
  },
  { label: 'Socials', type: 'dancing', hour: 12, min: 35, durMin: 55 },
];

const ANNIVERSARY: Beat[] = [
  { label: 'Guest arrival', type: 'pre_ceremony', hour: 17, min: 0, durMin: 30 },
  {
    label: 'Renewal of vows / Thanksgiving',
    type: 'ceremony',
    hour: 17,
    min: 30,
    durMin: 30,
    when: (s) => truthy(s, 'renewal_of_vows'),
  },
  { label: 'Dinner', type: 'dinner', hour: 18, min: 0, durMin: 60 },
  {
    label: 'Tribute program / “This is your life”',
    type: 'program',
    hour: 19,
    min: 0,
    durMin: 30,
    when: (s) => str(s, 'tribute_program').length > 0 || truthy(s, 'tribute_program'),
  },
  { label: "The couple's message", type: 'program', hour: 19, min: 30, durMin: 15 },
  { label: 'Socials & dancing', type: 'dancing', hour: 19, min: 45, durMin: 75 },
];

const REUNION: Beat[] = [
  {
    label: 'Registration & welcome',
    type: 'pre_ceremony',
    hour: 10,
    min: 0,
    durMin: 60,
    note: (s) => (truthy(s, 'reunion_shirt') ? 'Hand out / remind everyone to wear the reunion shirt.' : null),
  },
  { label: 'Opening program & invocation', type: 'program', hour: 11, min: 0, durMin: 30 },
  { label: 'Lunch', type: 'dinner', hour: 11, min: 30, durMin: 90 },
  {
    label: 'Awards & games',
    type: 'program',
    hour: 13,
    min: 0,
    durMin: 60,
    note: () => 'Auto-awards from the roster: came farthest · eldest · biggest family branch.',
  },
  {
    label: 'In memoriam',
    type: 'program',
    hour: 14,
    min: 0,
    durMin: 20,
    when: (s) => str(s, 'in_memoriam').length > 0 || truthy(s, 'in_memoriam'),
  },
  { label: 'Group photos & socials', type: 'dancing', hour: 14, min: 20, durMin: 100 },
];

const CORPORATE: Beat[] = [
  { label: 'Registration & cocktails', type: 'cocktails', hour: 18, min: 0, durMin: 30 },
  { label: 'Opening / AVP', type: 'program', hour: 18, min: 30, durMin: 30 },
  { label: 'Dinner', type: 'dinner', hour: 19, min: 0, durMin: 45 },
  {
    label: 'Program & awarding',
    type: 'program',
    hour: 19,
    min: 45,
    durMin: 45,
    note: (s) => (str(s, 'program_highlights') ? `Highlights: ${str(s, 'program_highlights')}` : null),
  },
  { label: 'Raffle', type: 'program', hour: 20, min: 30, durMin: 30 },
  { label: 'Socials / band', type: 'dancing', hour: 21, min: 0, durMin: 60 },
];

const GENDER_REVEAL: Beat[] = [
  { label: 'Guest arrival', type: 'pre_ceremony', hour: 15, min: 0, durMin: 30 },
  {
    label: 'Guessing game & team assignments',
    type: 'program',
    hour: 15,
    min: 30,
    durMin: 30,
    when: (s) => truthy(s, 'guessing_game'),
  },
  { label: 'Merienda', type: 'dinner', hour: 16, min: 0, durMin: 30 },
  {
    label: 'The reveal',
    type: 'program',
    hour: 16,
    min: 30,
    durMin: 30,
    note: (s) => (str(s, 'reveal_method') ? `Method: ${str(s, 'reveal_method')}. Confirm the supplier & the secret-keeper.` : 'Confirm the supplier & the secret-keeper.'),
  },
  { label: 'Celebration & socials', type: 'dancing', hour: 17, min: 0, durMin: 60 },
];

const GRADUATION: Beat[] = [
  { label: 'Guest arrival', type: 'pre_ceremony', hour: 17, min: 0, durMin: 30 },
  { label: 'Dinner', type: 'dinner', hour: 17, min: 30, durMin: 60 },
  {
    label: 'Message & dedication',
    type: 'program',
    hour: 18,
    min: 30,
    durMin: 30,
    note: (s) => (str(s, 'dedication_para_kay') ? `Dedicated to: ${str(s, 'dedication_para_kay')}` : null),
  },
  { label: 'Socials', type: 'dancing', hour: 19, min: 0, durMin: 60 },
];

// ── tournament vocabulary (mirrors onboarding/specialty-catalog.ts "tournament"
// signature_fields — sport_discipline · tournament_format · divisions · teams ·
// organizer_sponsor · opening_parade · awards. Keep these token lists in step
// with that catalog; an unrecognized token degrades to an unenriched note, never
// to a wrong one.) ──
const SPORT_LABEL: Record<string, string> = {
  basketball: 'Basketball',
  volleyball: 'Volleyball',
  esports: 'Esports',
  boxing: 'Boxing',
  billiards: 'Billiards',
  chess: 'Chess',
  badminton: 'Badminton',
  running_fun_run: 'Fun run',
  pageant: 'Pageant',
  // 'other' deliberately unmapped — we have no name for it, so we say nothing.
};
const FORMAT_LABEL: Record<string, string> = {
  single_elimination: 'Single elimination',
  double_elimination: 'Double elimination',
  round_robin: 'Round robin',
  liga_season: 'Liga season',
};
const AWARD_LABEL: Record<string, string> = {
  mvp: 'MVP',
  mythical_five: 'Mythical Five',
  champion: 'Champion',
  runner_up: 'Runner-up',
  sportsmanship: 'Sportsmanship',
  muse_of_the_league: 'Muse of the League',
  best_in_uniform: 'Best in Uniform',
};

/** "Basketball · Double elimination", or whichever half was captured. */
const disciplineLine = (s: Sig): string =>
  [label(SPORT_LABEL, str(s, 'sport_discipline')), label(FORMAT_LABEL, str(s, 'tournament_format'))]
    .filter(Boolean)
    .join(' · ');

/**
 * Tournament — a competition day, NOT a dinner party. Before this, `tournament`
 * had no authored program and fell through to GENERIC, so a liga opened its
 * schedule to "Guest arrival · Meal · Socials" while its own checklist
 * (checklist-event-type-defs.ts TOURNAMENT_TEMPLATE) already knew the day is
 * brackets · officials · medic · awards. The spine is the real shape of a
 * Filipino barangay/school meet: call time → check-in → opening → eliminations →
 * lunch → knockouts → championship → awarding → closing.
 *
 * One beat is signal-gated so we never promise something the host didn't plan:
 * the parade of teams & muses (the liga community layer — it shows only when the
 * opening parade was captured or a team named a muse). Every other beat is core
 * to any bracket event and always shows, so a host who skipped the specialty
 * form still gets a usable competition day.
 */
const TOURNAMENT: Beat[] = [
  {
    label: 'Call time: venue & equipment setup',
    type: 'pre_ceremony',
    hour: 6,
    min: 30,
    durMin: 60,
    isPublic: false, // crew beat — players don't need it on the public program
    note: () =>
      'Line the court/field, test the scoreboard & PA, and set up the first-aid station before anyone arrives.',
  },
  {
    label: 'Team check-in & registration',
    type: 'pre_ceremony',
    hour: 7,
    min: 30,
    durMin: 60,
    note: (s) => {
      const teams = cellList(rows(s, 'teams'), 'team_name').length;
      const divisions = cellList(rows(s, 'divisions'), 'division');
      const parts: string[] = [];
      if (teams) parts.push(`${teams} team${teams === 1 ? '' : 's'} registered`);
      if (divisions.length) parts.push(`divisions: ${divisions.join(', ')}`);
      parts.push('Check line-ups, IDs and waivers as each team signs in.');
      return parts.join(' · ');
    },
  },
  {
    label: 'Opening ceremony',
    type: 'ceremony',
    hour: 8,
    min: 30,
    durMin: 20,
    note: () => 'Invocation, national anthem, and the sportsmanship oath.',
  },
  {
    label: 'Parade of teams & muses',
    type: 'program',
    hour: 8,
    min: 50,
    durMin: 25,
    when: (s) => truthy(s, 'opening_parade') || cellList(rows(s, 'teams'), 'team_muse').length > 0,
    note: (s) => {
      const muses = cellList(rows(s, 'teams'), 'team_muse');
      return muses.length
        ? `${muses.length} team muse${muses.length === 1 ? '' : 's'} to introduce — brief them on the walk order.`
        : 'Set the walk order and brief each team captain before the march-in.';
    },
  },
  {
    label: 'Rules briefing & bracket draw',
    type: 'program',
    hour: 9,
    min: 15,
    durMin: 20,
    note: (s) => {
      const d = disciplineLine(s);
      const base = 'Run the rules with the officials and post the bracket where players can see it.';
      return d ? `${d}. ${base}` : base;
    },
  },
  {
    label: 'Elimination round',
    type: 'program',
    hour: 9,
    min: 35,
    durMin: 175,
    note: (s) =>
      str(s, 'tournament_format') === 'liga_season'
        ? 'A liga season runs across several game days — reshape this into one game-day template and repeat it per playdate.'
        : 'Bracket rounds. Keep a scorer at the table and a runner posted at the scoreboard.',
  },
  { label: 'Lunch break', type: 'dinner', hour: 12, min: 30, durMin: 45 },
  {
    label: 'Quarterfinals & semifinals',
    type: 'program',
    hour: 13,
    min: 15,
    durMin: 135,
    note: () => 'Re-seed from the elimination results before calling the first match.',
  },
  {
    label: 'Championship match',
    type: 'program',
    hour: 15,
    min: 30,
    durMin: 90,
    note: () => 'Confirm the officiating crew and have the trophies staged courtside before tip-off.',
  },
  {
    label: 'Awarding ceremony',
    type: 'program',
    hour: 17,
    min: 0,
    durMin: 45,
    note: (s) => {
      const awards = choices(s, 'awards').map((a) => label(AWARD_LABEL, a)).filter(Boolean);
      return awards.length
        ? `Awards to call: ${awards.join(', ')}. Have the medals and trophies engraved and on-site.`
        : 'Have the medals and trophies on-site and the awardee list finalized before the final whistle.';
    },
  },
  {
    label: 'Closing remarks & send-off',
    type: 'send_off',
    hour: 17,
    min: 45,
    durMin: 30,
    note: (s) =>
      str(s, 'organizer_sponsor')
        ? `Acknowledge ${str(s, 'organizer_sponsor')}, the officials, and the medic team.`
        : 'Acknowledge the organizer, the officials, and the medic team.',
  },
];

/** Generic fallback for any non-wedding type without an authored program — a
 *  clean, universally-true celebration spine the host reshapes. */
const GENERIC: Beat[] = [
  { label: 'Guest arrival', type: 'pre_ceremony', hour: 17, min: 0, durMin: 30 },
  { label: 'Opening & program', type: 'program', hour: 17, min: 30, durMin: 30 },
  { label: 'Meal', type: 'dinner', hour: 18, min: 0, durMin: 60 },
  { label: 'Main highlights', type: 'program', hour: 19, min: 0, durMin: 30 },
  { label: 'Socials', type: 'dancing', hour: 19, min: 30, durMin: 60 },
];

// ── Funeral — the service day, quietly. WITHOUT this entry the type falls to
// GENERIC, which seeds "Opening & program / Main highlights / Socials" (a
// 'dancing' beat) onto a funeral's schedule on day one — the travel comment's
// wrong-shaped-beats problem, with a far worse voice. Morning times: a
// Filipino funeral mass is typically mid-morning with the interment before
// the midday meal. The family re-times everything.
const FUNERAL: Beat[] = [
  { label: 'The family receives guests', type: 'pre_ceremony', hour: 8, min: 0, durMin: 60 },
  { label: 'Funeral service', type: 'ceremony', hour: 9, min: 0, durMin: 90 },
  { label: 'Procession to the resting place', type: 'custom', hour: 10, min: 30, durMin: 45 },
  { label: 'Interment', type: 'ceremony', hour: 11, min: 15, durMin: 45 },
  { label: 'A meal together', type: 'dinner', hour: 12, min: 0, durMin: 90 },
];

const PROGRAMS: Record<string, Beat[]> = {
  debut: DEBUT,
  birthday: BIRTHDAY,
  christening: CHRISTENING,
  anniversary: ANNIVERSARY,
  reunion: REUNION,
  corporate: CORPORATE,
  gender_reveal: GENDER_REVEAL,
  graduation: GRADUATION,
  tournament: TOURNAMENT,
  wake: FUNERAL,
  // Travel deliberately seeds NOTHING (ai-travel-scheduling): a trip is a
  // multi-day itinerary built from hotel night-blocks + tour time-blocks
  // (lib/schedule-travel.ts), not a single-evening party spine — the GENERIC
  // guest-arrival/meal/socials fallback would pollute the itinerary with
  // wrong-shaped beats on day one.
  travel: [],
};

/**
 * Anchor a wall-clock time to the event's date, as a stored schedule time.
 *
 * ── BUILT FROM COMPONENTS, DELIBERATELY ─────────────────────────────────────
 * A stored schedule time is the VENUE'S WALL CLOCK written into a UTC column,
 * so the digits must survive whatever timezone this code happens to run in.
 * The old form — `new Date('2026-11-14')` then `.setHours(6, 30)` then
 * `.toISOString()` — mixes a UTC parse with LOCAL setters. Under UTC it happens
 * to give the right answer, which is why it looked fine for months; run it in
 * New York and every seeded block lands at 11:30Z **on the previous day**.
 *
 * Output is byte-identical under UTC, so nothing about a seeded event changes.
 * What changes is that it is now the same everywhere.
 */
function anchorIso(eventDate: string | null, hour: number, minute: number): string {
  const m = eventDate ? /^(\d{4})-(\d{2})-(\d{2})/.exec(eventDate) : null;
  if (m) {
    const [, y, mo, d] = m;
    return `${y}-${mo}-${d}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
  }
  // No date yet — a placeholder the host re-times. Take the runtime's calendar
  // day (the only date available) and stamp the wall clock onto it by hand.
  const fallback = new Date();
  fallback.setMonth(fallback.getMonth() + 3);
  const y = fallback.getFullYear();
  const mo = String(fallback.getMonth() + 1).padStart(2, '0');
  const d = String(fallback.getDate()).padStart(2, '0');
  return `${y}-${mo}-${d}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:00.000Z`;
}

/** Shift a stored schedule time by whole minutes. Pure epoch arithmetic — no
 *  local getters, so it cannot drift with the runtime's zone. */
function addMinutesIso(iso: string, minutes: number): string {
  return new Date(new Date(iso).getTime() + minutes * 60_000).toISOString();
}

/**
 * Build the run-of-show seed for a non-wedding event. Returns [] for weddings
 * (they own a separate seed) and for an unknown type it falls back to GENERIC.
 * A beat gated by `when` is dropped when its signal is absent; `note` enriches
 * from the captured brief. Deterministic — same (type, signals, date) → same
 * blocks.
 */
export function buildRunOfShowSeed(
  eventType: string | null | undefined,
  signatureDetails: Sig,
  eventDate: string | null,
): RunOfShowSeedBlock[] {
  if (!eventType || eventType === 'wedding') return [];
  const beats = PROGRAMS[eventType] ?? GENERIC;
  const out: RunOfShowSeedBlock[] = [];
  let order = 100;
  for (const b of beats) {
    if (b.when && !b.when(signatureDetails)) continue;
    const start = anchorIso(eventDate, b.hour, b.min);
    out.push({
      label: b.label,
      block_type: b.type,
      start_at: start,
      end_at: addMinutesIso(start, b.durMin),
      sort_order: order,
      is_public: b.isPublic ?? true,
      notes: b.note ? (b.note(signatureDetails) ?? null) : null,
    });
    order += 100;
  }
  return out;
}
