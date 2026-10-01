import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';
import { eventWordsFromProfile } from '@/app/[slug]/_lib/event-words';
import { GENERIC_PROFILE, resolveProfile } from '@/lib/event-type-profile';
import { readHubDraft } from '@/lib/hub-draft-store';
import { resolveMoments } from '@/lib/love-story-moments';
import { parsePrintDetails } from '@/lib/print-pieces';
import { hasPalette, parentGuestsForEvent, readPrintEvent, readRsvpHosts, type PrintEventRow } from '@/lib/print-set.server';
import { logQueryError } from '@/lib/supabase/error-detect';
import {
  FREE_PRINT_KEYS,
  LOOK_ITEM_KEYS,
  WORDS_ITEM_KEYS,
  detailsItemApplies,
  type DetailsItemKey,
} from '@/lib/maker-details-items';
import { parentsOffered, yourEventPresentKeys, type YourEventFacts, type YourEventKind } from '@/lib/details-your-event';
import {
  guidedPlanFromFacts,
  wordsAndPlansInputFrom,
  type GuidedDoneFacts,
  type GuidedPlan,
} from '@/lib/details-guided-flow';
import { readYourEventFacts } from './details-your-event-facts';
import { hubSetupApplies, hubSetupRound, type HubSetupFacts, type HubSetupRound } from '@/lib/hub-setup-steps';
import type { DetailsItemContext } from '@/lib/maker-details-items';
import { readGuestsReply } from '@/lib/rsvp-ask';
import { sanitizeGroupAttire } from '@/lib/role-group-dress-code';
import { sanitizeRoleAttire } from '@/lib/role-dress-code';

/* ══ 🧭 "FINISH YOUR EVENT HUB" — THE SETUP'S FACTS (lib/hub-setup-steps.ts) ══
   ONE derivation, read by the Maker (its What's left) and by Home (the once-
   offer and the slim card), so the three doors count the same steps. Every
   fact is a field that already exists — no setup-only column. */

/** The Mood Board carries a dress code — a headline, a line, a do/don't, or any group's or role's style. */
export function dressCodeIsSet(raw: unknown): boolean {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return false;
  const c = raw as Record<string, unknown>;
  const said = (v: unknown) => typeof v === 'string' && v.trim() !== '';
  const listed = (v: unknown) => Array.isArray(v) && v.some(said);
  if (said(c.title) || said(c.description) || listed(c.dos) || listed(c.donts)) return true;
  if (Object.keys(sanitizeGroupAttire(c.groups)).length > 0) return true;
  return Object.keys(sanitizeRoleAttire(c.roles, () => true)).length > 0;
}

/** A schedule moment as the setup reads it. */
export type SetupScheduleBlock = { block_type?: string | null; is_public?: boolean | null; parent_block_id?: string | null };

/**
 * THE SETUP'S FACTS — each "as the couple is editing it" where the Maker drafts
 * it (the draft's value, else live), and null where its read failed (no claim).
 */
export function hubSetupFactsFrom(input: {
  /** `rsvp_ask_config` as edited — onboarding's "How do guests get in?" lives in it. */
  rsvpAsk: unknown;
  /** Top-level schedule moments; null = unread. */
  schedule: readonly SetupScheduleBlock[] | null;
  /** Which venues hold a confirmed (locked) booking; null = unread. */
  venuesLocked: { ceremony: boolean; reception: boolean } | null;
  /** The Love Story's moments as edited; null = unread. */
  loveStoryMoments: number | null;
  /** `dress_code_config` as edited; undefined = unread. */
  dressCode: unknown;
  /** `guest_list_edit_deadline`; undefined = unread. */
  replyBy: string | null | undefined;
  /** Guests besides the couple; null = unread. */
  guests: number | null;
}): HubSetupFacts {
  return {
    guestList: readGuestsReply(input.rsvpAsk),
    arrival: input.schedule
      ? input.schedule.some((b) => !b.parent_block_id && b.block_type === 'pre_ceremony' && b.is_public !== false)
      : null,
    venuesLocked: input.venuesLocked,
    loveStoryMoments: input.loveStoryMoments,
    wear: input.dressCode === undefined ? null : dressCodeIsSet(input.dressCode),
    replyBy: input.replyBy === undefined ? null : Boolean(input.replyBy),
    guests: input.guests,
  };
}

/**
 * The setup round for the plan built from saved facts (`guidedPlanFromFacts`):
 * over the items this event has — `present`, then the type's own rule — exactly
 * the items that plan draws.
 */
export function setupRoundFor(facts: HubSetupFacts | null, present: ReadonlySet<DetailsItemKey>, ctx: DetailsItemContext): HubSetupRound | null {
  if (!facts) return null;
  return hubSetupRound(facts, new Set([...present].filter((k) => detailsItemApplies(k, ctx))));
}

/** Guests on the list besides the couple themselves (the commit seeds the two of them). */
export async function countSetupGuests(admin: SupabaseClient, eventId: string): Promise<number | null> {
  const res = await admin
    .from('guests')
    .select('guest_id', { count: 'exact', head: true })
    .eq('event_id', eventId)
    .is('deleted_at', null)
    .or('role.is.null,role.not.in.(bride,groom)');
  if (res.error) {
    logQueryError('HubSetup.guests', res.error, { event_id: eventId }, 'graceful_degrade');
    return null;
  }
  return res.count ?? 0;
}

/**
 * 🪜 THE GUIDED FLOW'S "DONE", FOR THE PAGES THAT DECIDE BEFORE DETAILS DRAWS
 * (Details part 5): the Maker, which opens an unfinished event on What's left,
 * and Home, which says "Round N · x of y · Continue".
 *
 * Details draws each step's ✓ / ○ from its navigator rows. These pages decide
 * before it draws, so they read the same saved facts through the SAME
 * derivations: `guidedFactsFrom` is the one place "the couple is editing it"
 * (the draft over live) is resolved for the theme, the Mood Board, the logo,
 * the hero, the special message and the Love Story — and the launch page hands
 * ITS answers to Details' rows too, so the Maker's navigator and its decision
 * to open the flow cannot disagree. Home re-reads the same columns with the
 * same helpers (`readPrintEvent`, `readHubDraft`, `readYourEventFacts`,
 * `parentGuestsForEvent`, `readRsvpHosts`).
 */

/** The events columns the derivation needs — `readPrintEvent`'s row carries them all. */
type GuidedEventRow = Pick<
  PrintEventRow,
  | 'invite_theme'
  | 'role_palette'
  | 'monogram_custom_svg'
  | 'monogram_uploaded_svg'
  | 'landing_page_hero_image_url'
  | 'landing_page_hero_video_r2_key'
  | 'special_message'
  | 'pabuya_message'
  | 'print_details'
>;

/**
 * THE ONE DERIVATION of the facts each guided step's done is read from —
 * every column "as the couple is editing it" (the draft's value where the draft
 * holds that column, else live). The launch page passes what it already read.
 */
export function guidedFactsFrom(input: {
  event: GuidedEventRow;
  /** The draft's `events` keys — `{}` when there is no draft or it could not be read. */
  drafted: Record<string, unknown>;
  /** The live Love Story; `undefined` when its read failed. */
  liveLoveStory: unknown;
  yourEvent: { facts: YourEventFacts; kind: YourEventKind } | null;
  storyApplies: boolean;
  /** Top-level schedule moments; null when unread (never "0"). */
  scheduleMoments: number | null;
  /** 🪑 The Seat plan is arranged (a guest is seated) — never whether guests can see it; null when unread, absent where no seat plan was read. */
  seatPlanArranged?: boolean | null;
}): GuidedDoneFacts & {
  /** The Love Story as edited — null when it could not be read (Details then says so). */
  story: Record<string, unknown> | null;
  specialMessage: string | null;
  themeSaved: unknown;
} {
  const d = input.drafted;
  const col = <K extends keyof GuidedEventRow>(k: K): unknown => (k in d ? d[k] : input.event[k]);
  const themeSaved = col('invite_theme');
  const specialMessage = ('special_message' in d ? (d.special_message as string | null) : input.event.special_message) ?? null;
  const storyRaw = 'love_story' in d ? d.love_story : input.liveLoveStory === undefined ? null : input.liveLoveStory;
  const story: Record<string, unknown> | null =
    input.liveLoveStory === undefined && storyRaw == null
      ? null
      : storyRaw && typeof storyRaw === 'object' && !Array.isArray(storyRaw)
        ? (storyRaw as Record<string, unknown>)
        : {};
  return {
    themeSaved,
    specialMessage,
    story,
    yourEvent: input.yourEvent?.facts ?? null,
    kind: input.yourEvent?.kind ?? null,
    themeChosen: themeSaved !== null && themeSaved !== undefined,
    palette: hasPalette(input.event.role_palette),
    logo: Boolean(col('monogram_custom_svg') || col('monogram_uploaded_svg')),
    hero: Boolean(col('landing_page_hero_image_url') || col('landing_page_hero_video_r2_key')),
    seatPlanArranged: input.seatPlanArranged ?? null,
    words: wordsAndPlansInputFrom({
      specialMessage,
      pabuyaMessage: input.event.pabuya_message,
      stored: parsePrintDetails(input.event.print_details),
      // As Details' row counts it: no Love Story here → 0; unread → null.
      loveStoryMoments: input.storyApplies ? (story ? resolveMoments(story).length : null) : 0,
      scheduleMoments: input.scheduleMoments,
    }),
  };
}

/** The items the Maker's Details draws that a guided step can show. */
export function guidedPresent(input: {
  yourEvent: { kind: YourEventKind; namesWritable: boolean } | null;
  storyApplies: boolean;
  hasSlug: boolean;
  /** 🪑 The Seat plan was read for this event (Details part 4 draws its item); the type's own rule still applies. */
  seatPlan?: boolean;
}): Set<DetailsItemKey> {
  return new Set<DetailsItemKey>([
    'theme',
    ...LOOK_ITEM_KEYS,
    ...(input.yourEvent ? yourEventPresentKeys(input.yourEvent.kind, input.yourEvent.namesWritable) : []),
    ...WORDS_ITEM_KEYS,
    ...(input.storyApplies ? (['love-story'] as const) : []),
    ...(input.seatPlan ? (['seating'] as const) : []),
    'schedule',
    'rsvp',
    'download',
    // The event QR needs an address (`freePrints`).
    ...FREE_PRINT_KEYS.filter((k) => k !== 'event-qr' || input.hasSlug),
  ]);
}

/**
 * HOME's read — the whole plan for one event, from the same columns and the
 * same helpers the Maker reads. Null when the event row cannot be read (Home
 * then draws nothing — never a "0 of 7" it did not measure).
 */
export async function readGuidedPlan({
  supabase,
  admin,
  eventId,
}: {
  supabase: SupabaseClient;
  admin: SupabaseClient;
  eventId: string;
}): Promise<{ plan: GuidedPlan; setupOffered: boolean } | null> {
  const [event, hosts, parents, drafted, scheduleRes, seatDoorRes] = await Promise.all([
    readPrintEvent(admin, eventId),
    readRsvpHosts(eventId),
    parentGuestsForEvent(eventId),
    readHubDraft(supabase, eventId)
      .then((dr) => (dr ? (dr.events as Record<string, unknown>) : {}))
      .catch((e: unknown) => {
        console.error('[hub-draft] home could not read the draft:', e instanceof Error ? e.message : e);
        return {} as Record<string, unknown>;
      }),
    supabase
      .from('event_schedule_blocks')
      .select('block_type, is_public, parent_block_id')
      .eq('event_id', eventId)
      .is('parent_block_id', null),
    // 🪑 Is the seat plan ARRANGED (a guest seated)? The same count the Maker's
    // Seat plan row reads — never whether guests can see it yet.
    supabase.from('event_seat_assignments').select('guest_id', { count: 'exact', head: true }).eq('event_id', eventId),
  ]);
  if (seatDoorRes.error) logQueryError('HomeGuide.seatArranged', seatDoorRes.error, { event_id: eventId }, 'graceful_degrade');
  if (!event) return null;
  if (scheduleRes.error) logQueryError('HomeGuide.scheduleMoments', scheduleRes.error, { event_id: eventId }, 'graceful_degrade');
  const [profile, ye] = await Promise.all([
    resolveProfile(event.event_type ?? '').catch(() => GENERIC_PROFILE),
    readYourEventFacts({ admin, eventId, parentCount: parents.length, hostCount: hosts.length, drafted }),
  ]);
  const ctx = { profile, solemn: eventWordsFromProfile(profile).solemn };
  const storyApplies = detailsItemApplies('love-story', ctx);
  const scheduleRows = scheduleRes.error ? null : ((scheduleRes.data ?? []) as SetupScheduleBlock[]);
  const facts = guidedFactsFrom({
    event,
    drafted,
    liveLoveStory: event.love_story,
    yourEvent: ye ? { facts: ye.facts, kind: ye.kind } : null,
    storyApplies,
    scheduleMoments: scheduleRows ? scheduleRows.length : null,
    seatPlanArranged: seatDoorRes.error ? null : (seatDoorRes.count ?? 0) > 0,
  });
  /* 🧭 The setup round — only where it is drawn (a wedding), and only then its
     two extra reads (the reply-by date, the guests' count). */
  let setup: HubSetupFacts | null = null;
  if (hubSetupApplies(event.event_type)) {
    const [deadlineRes, guests] = await Promise.all([
      admin.from('events').select('guest_list_edit_deadline').eq('event_id', eventId).maybeSingle(),
      countSetupGuests(admin, eventId),
    ]);
    if (deadlineRes.error) logQueryError('HomeGuide.replyBy', deadlineRes.error, { event_id: eventId }, 'graceful_degrade');
    const offered = ye ? (ye.bookings.offered ?? { ceremony: ye.bookings.ceremony, reception: ye.bookings.reception }) : null;
    setup = hubSetupFactsFrom({
      rsvpAsk: 'rsvp_ask_config' in drafted ? drafted.rsvp_ask_config : event.rsvp_ask_config,
      schedule: scheduleRows,
      venuesLocked: offered ? { ceremony: offered.ceremony !== null, reception: offered.reception !== null } : null,
      loveStoryMoments: storyApplies ? (facts.story ? resolveMoments(facts.story).length : null) : 0,
      dressCode: 'dress_code_config' in drafted ? drafted.dress_code_config : event.dress_code_config,
      replyBy: deadlineRes.error ? undefined : ((deadlineRes.data as { guest_list_edit_deadline?: string | null } | null)?.guest_list_edit_deadline ?? null),
      guests,
    });
  }
  const present = guidedPresent({
    yourEvent: ye ? { kind: ye.kind, namesWritable: ye.namesWritable } : null,
    storyApplies,
    hasSlug: Boolean(event.slug),
    seatPlan: detailsItemApplies('seating', ctx),
  });
  const plan = guidedPlanFromFacts({
    ctx,
    present,
    facts,
    parentsOffered: ye ? parentsOffered(ye.kind) : false,
    setup: setupRoundFor(setup, present, ctx),
  });
  /* The once-offer after onboarding ("Start / Later") is for an event the
     setup-card onboarding made — it leaves its answers in
     `style_preferences.setup` (`setupColumns`). Older events reach the same
     steps from the slim card and the Maker's What's left. */
  const prefs = event.style_preferences;
  const setupOffered =
    setup !== null && Boolean(prefs && typeof prefs === 'object' && !Array.isArray(prefs) && (prefs as Record<string, unknown>).setup);
  return { plan, setupOffered };
}
