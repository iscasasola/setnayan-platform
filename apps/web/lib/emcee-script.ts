/**
 * Emcee / host script generator — pure, deterministic text compiler.
 *
 * Takes the saved wedding-day program (the same `event_schedule_blocks` rows the
 * /schedule editor builds) plus the guest list's wedding-party roles, and
 * compiles a clean, formatted plain-text run-of-show an emcee or host can read
 * from on the day — names spelled out, times in order, cue lines included.
 *
 * Pure + integration-agnostic (no Supabase, no React): same blocks + guests →
 * same string. Time formatting is injectable so the output is deterministic in
 * tests; the default renders the block's wall-clock time. Nothing here calls a
 * network or a clock.
 *
 * The script has three parts:
 *   1. A header (couple + date).
 *   2. A WEDDING PARTY roster — names grouped by role, in processional order.
 *   3. The PROGRAM — every public-or-all block in time order, parents nesting
 *      their parts, each with a light emcee cue.
 */

import {
  groupScheduleBlocksByParent,
  formatBlockTimeRange,
  type ScheduleBlockRow,
} from '@/lib/schedule';
import {
  guestDisplayName,
  ROLE_LABELS,
  type GuestRole,
  type GuestRow,
} from '@/lib/guests';

export type EmceeScriptEvent = {
  displayName: string | null;
  eventDate: string | null;
};

export type EmceeScriptOptions = {
  /** Include private (non-public) schedule blocks too. Default false — the
   *  emcee usually narrates the public-facing program. */
  includePrivateBlocks?: boolean;
  /** Time formatter; defaults to the schedule module's range formatter so the
   *  script reads in the couple's wall-clock. Injectable for deterministic tests. */
  formatTime?: (startIso: string, endIso: string | null) => string;
};

export type EmceeScriptInput = {
  event: EmceeScriptEvent;
  blocks: ReadonlyArray<ScheduleBlockRow>;
  guests: ReadonlyArray<GuestRow>;
  options?: EmceeScriptOptions;
};

/**
 * Processional / billing order for the wedding-party roster. Roles not listed
 * fall to the end in enum order. This is presentation order only — it never
 * changes who's in the party.
 */
const ROLE_ORDER: GuestRole[] = [
  'bride',
  'groom',
  'bride_parents',
  'groom_parents',
  'principal_sponsor',
  'maid_of_honor',
  'matron_of_honor',
  'best_man',
  'bridesmaid',
  'groomsman',
  'bride_immediate_family',
  'groom_immediate_family',
  'veil_sponsor',
  'cord_sponsor',
  'candle_sponsor',
  'coin_sponsor',
  'ring_bearer',
  'bible_bearer',
  'coin_bearer',
  'flower_girl',
  'officiant',
  'reader_lector',
  'soloist_musician',
];

/** Roles that belong on the roster — everyone else is a plain guest. */
const PARTY_ROLES = new Set<GuestRole>(ROLE_ORDER.filter((r) => r !== 'guest'));

/** Light emcee cue keyed off the block type, so the host has a prompt to read. */
const BLOCK_CUE: Partial<Record<ScheduleBlockRow['block_type'], string>> = {
  pre_ceremony: 'Guests are seated; music sets the mood.',
  ceremony: 'All rise — the ceremony begins.',
  cocktails: 'Invite guests to enjoy cocktails and mingle.',
  reception: 'Welcome everyone into the reception hall.',
  dinner: 'Announce that dinner is served.',
  program: 'Kick off the program.',
  dancing: 'Open the floor — let the dancing begin.',
  send_off: 'Gather everyone for the send-off.',
  after_party: 'The party continues — keep the energy up.',
};

function partyRoster(guests: ReadonlyArray<GuestRow>): string[] {
  // Bucket party members by role, preserving first/last-name sort from the
  // already-sorted guest list (fetchGuestsByEvent orders by last,first).
  const byRole = new Map<GuestRole, string[]>();
  for (const g of guests) {
    if (!PARTY_ROLES.has(g.role)) continue;
    const bucket = byRole.get(g.role) ?? [];
    bucket.push(guestDisplayName(g));
    byRole.set(g.role, bucket);
  }
  if (byRole.size === 0) return [];

  const lines: string[] = ['THE WEDDING PARTY', ''];
  for (const role of ROLE_ORDER) {
    const names = byRole.get(role);
    if (!names || names.length === 0) continue;
    const label = ROLE_LABELS[role];
    // Singular roles read "Bride: Maria"; plural roles list "Bridesmaids:".
    if (names.length === 1) {
      lines.push(`  ${label}: ${names[0]}`);
    } else {
      lines.push(`  ${label}:`);
      for (const name of names) lines.push(`    • ${name}`);
    }
  }
  lines.push('');
  return lines;
}

function programSection(
  blocks: ReadonlyArray<ScheduleBlockRow>,
  options: Required<Pick<EmceeScriptOptions, 'includePrivateBlocks' | 'formatTime'>>,
): string[] {
  const visible = options.includePrivateBlocks
    ? blocks
    : blocks.filter((b) => b.is_public);
  if (visible.length === 0) {
    return ['THE PROGRAM', '', '  (No schedule blocks yet — build your timeline on the Schedule page.)', ''];
  }

  const { topLevel, childrenByParent } = groupScheduleBlocksByParent(visible);
  const lines: string[] = ['THE PROGRAM', ''];

  // An emcee narrates in TIME order. groupScheduleBlocksByParent orders by
  // sort_order; re-sort chronologically (start_at, then sort_order as the
  // tiebreak) so the script always reads front-to-back through the day.
  const byTime = (a: ScheduleBlockRow, b: ScheduleBlockRow) =>
    a.start_at < b.start_at ? -1 : a.start_at > b.start_at ? 1 : a.sort_order - b.sort_order;
  const orderedTop = [...topLevel].sort(byTime);

  for (const block of orderedTop) {
    const time = options.formatTime(block.start_at, block.end_at);
    lines.push(`  ${time} — ${block.label.toUpperCase()}`);
    const cue = BLOCK_CUE[block.block_type];
    if (cue) lines.push(`    Cue: ${cue}`);
    if (block.location) lines.push(`    Location: ${block.location}`);
    if (block.notes) lines.push(`    Note: ${block.notes}`);

    const children = [...(childrenByParent[block.block_id] ?? [])].sort(byTime);
    for (const child of children) {
      const childTime = options.formatTime(child.start_at, child.end_at);
      lines.push(`      ${childTime} · ${child.label}`);
      if (child.notes) lines.push(`        Note: ${child.notes}`);
    }
    lines.push('');
  }
  return lines;
}

function header(event: EmceeScriptEvent): string[] {
  const couple = event.displayName?.trim() || 'The Wedding';
  const lines = [
    '═══════════════════════════════════════════',
    `  EMCEE / HOST SCRIPT — ${couple}`,
  ];
  if (event.eventDate) lines.push(`  ${event.eventDate}`);
  lines.push('═══════════════════════════════════════════', '');
  return lines;
}

/**
 * Compile the full emcee/host script as a single newline-joined string.
 *
 * Deterministic given the same blocks, guests, and `formatTime`. Safe to call
 * on the server (for a download) or client (for copy-to-clipboard).
 */
export function buildEmceeScript(input: EmceeScriptInput): string {
  const options: Required<Pick<EmceeScriptOptions, 'includePrivateBlocks' | 'formatTime'>> = {
    includePrivateBlocks: input.options?.includePrivateBlocks ?? false,
    formatTime: input.options?.formatTime ?? formatBlockTimeRange,
  };

  const lines: string[] = [
    ...header(input.event),
    ...partyRoster(input.guests),
    ...programSection(input.blocks, options),
    '— End of script —',
  ];
  return lines.join('\n');
}
