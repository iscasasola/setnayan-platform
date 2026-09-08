import 'server-only';

/**
 * spine-data.ts — everything the story's clock needs that the shipped editorial
 * loader does not already carry.
 *
 * `08` step 2.1 · `01_The_Story.md` §1 + §3 + §6.
 *
 * 🔑 IT IS A SUPPLEMENT, NOT A SECOND LOADER. `editorial/data.ts` already
 * resolves the cover's names, the monogram, the metrics, the vendors, the
 * voices, the challenge answers and the day's chapters, and it is ~3,700 lines
 * of gates that have each been paid for once. Re-reading any of that here would
 * be a second opinion about the same question — the failure this repo has
 * logged three times (the two-lax-copies host check, the three answers to "is
 * this shop booked", the clone that inherited its twin's bug). This module adds
 * only what has no reader yet: the dial's bar heights, the road's dated facts,
 * the broadcast sessions, and the venue's state minute by minute.
 *
 * 🔒 SERVICE-ROLE READS ARE OUTSIDE EVERY RLS RULE. `/[slug]` renders with the
 * admin client, so the app-side gate is the whole fence. Everything here is
 * EVENT CONTENT, so nothing here is a substitute for that gate: the caller
 * hands the viewer to `drawnBins` / `redactStoryLayers` before a number reaches
 * the page. This module resolves facts; it does not decide who may read them.
 */

import { createAdminClient } from '@/lib/supabase/admin';
import { storyDayWindow, storyDayList, manilaDayOf, type StoryDayWindow } from '@/lib/story-day-window';
import { isYouTubeVideoId } from '@/lib/panood-watch';
import { plannedInstant } from '@/lib/run-of-show';
import { DEFAULT_EVENT_TZ } from '@/lib/schedule';
import {
  dialBucketMinutes,
  manilaMinuteOfDay,
  subtractWithheldFromBins,
  type BroadcastSession,
  type VenueBlock,
} from '@/lib/story-spine';
import { loadConsentVetoedPapicIds, publicKeyForCapture } from '../editorial/consent-veto';
import type { CaptureBin } from '@/lib/the-guests-layer-is-theirs-until-you-publish';

/** Local string coercion — mirrors `data.ts`'s `asString`, kept dependency-free. */
function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

function msOf(v: unknown): number | null {
  const s = asString(v);
  if (!s) return null;
  const n = Date.parse(s);
  return Number.isFinite(n) ? n : null;
}

/** One dated fact on the road — the 195 days of making the day. */
export type RoadFact = {
  /** Stable key, so the dial and the entry can point at each other. */
  key: string;
  /** When it happened, epoch ms. */
  atMs: number;
  /** The big stamp — 'AUG 3'. */
  stamp: string;
  /** The small one under it — '2025'. */
  stampSuffix: string;
  /** The entry's headline. */
  title: string;
  /** The eyebrow above the stamp. */
  kicker: string;
  /** The paragraph. Null → the entry is a marker with no write-up. */
  body: string | null;
  /** Which layer it belongs to. The road is the host's own, except the captures. */
  layer: 'host' | 'guest';
};

export type StorySpineFacts = {
  window: StoryDayWindow | null;
  /** Manila calendar dates the event covers, in order. */
  dayDates: string[];
  /** The road's span — the date being set, through the night before day one. */
  roadStartMs: number | null;
  roadEndMs: number | null;
  road: RoadFact[];
  after: RoadFact[];
  /** One per broadcast session, earliest first. §6 — never one film. */
  broadcasts: BroadcastSession[];
  /** The venue's own blocks, lifted to real instants. */
  blocks: VenueBlock[];
  /**
   * Per-bucket capture counts — the CEILING, before the viewer's layer is
   * applied. Route through `drawnBins()`; never hand these to a component.
   */
  bins: CaptureBin[];
  bucketMinutes: number;
};

export const EMPTY_SPINE_FACTS: StorySpineFacts = {
  window: null,
  dayDates: [],
  roadStartMs: null,
  roadEndMs: null,
  road: [],
  after: [],
  broadcasts: [],
  blocks: [],
  bins: [],
  bucketMinutes: 5,
};

const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

/** 'AUG 3' / '2025' from a Manila calendar date. */
function stampOf(dateStr: string): { stamp: string; stampSuffix: string } {
  const [y, m, d] = dateStr.split('-').map(Number);
  if (!y || !m || !d) return { stamp: dateStr, stampSuffix: '' };
  return { stamp: `${MONTHS[m - 1] ?? ''} ${d}`.trim(), stampSuffix: String(y) };
}

function roadFact(
  key: string,
  atMs: number | null,
  kicker: string,
  title: string,
  body: string | null,
  layer: RoadFact['layer'] = 'host',
): RoadFact | null {
  if (atMs == null || !Number.isFinite(atMs)) return null;
  const day = manilaDayOf(new Date(atMs).toISOString());
  if (!day) return null;
  const { stamp, stampSuffix } = stampOf(day);
  return { key, atMs, stamp, stampSuffix, title, kicker, body, layer };
}

/**
 * A curated showcase story's facts, WITHOUT TOUCHING THE DATABASE.
 *
 * 🔴 A SAMPLE HAS NO EVENT ROW, SO IT MUST NOT BE LOOKED UP. `sample-maria-
 * and-juan` is not a UUID; Postgres rejects every query carrying it with 22P02,
 * and a rejected query is an ABSENCE, not an error anybody sees. That exact
 * mistake ran for a fortnight on all six samples in 2026-07 — two doomed round
 * trips and two red 400s per render, on a page where nothing looked wrong.
 *
 * A fixture has no captures, so its dial has no bar HEIGHTS: it draws the day
 * with baseline ticks and a mark at each written minute, which is the honest
 * shape of "nothing was measured here" rather than a chart of invented numbers.
 */
export function sampleSpineFacts(
  eventDate: string | null,
  eventEndDate: string | null,
): StorySpineFacts {
  const window = storyDayWindow(eventDate, eventEndDate);
  if (!window) return EMPTY_SPINE_FACTS;
  return {
    ...EMPTY_SPINE_FACTS,
    window,
    dayDates: storyDayList(window),
    bucketMinutes: dialBucketMinutes(window.days),
  };
}

/**
 * Load the spine's facts.
 *
 * Best-effort by construction, like every other public read on this page: any
 * query that fails leaves its own field empty and the section it feeds simply
 * does not draw. It NEVER throws — the story is the last page a couple sees, and
 * a 500 here would take the whole celebration down over a missing broadcast row.
 */
export async function loadStorySpineFacts(args: {
  eventId: string;
  eventDate: string | null;
  eventEndDate: string | null;
  /** Written minutes' instants, so the road knows where to stop. */
  createdAtMs: number | null;
}): Promise<StorySpineFacts> {
  const window = storyDayWindow(args.eventDate, args.eventEndDate);
  if (!window) return EMPTY_SPINE_FACTS;

  const admin = createAdminClient();
  const dayDates = storyDayList(window);
  const dayOneStartMs = Date.parse(window.startIso);
  const facts: StorySpineFacts = {
    ...EMPTY_SPINE_FACTS,
    window,
    dayDates,
    roadEndMs: Number.isFinite(dayOneStartMs) ? dayOneStartMs : null,
  };

  // ── The road ──────────────────────────────────────────────────────────────
  // Every entry is a real dated fact or it is not drawn. There is no filler row
  // and no "coming soon" placeholder: an empty road on a story built the week
  // after the wedding is the truth about that story, and inventing "The team
  // comes together" for an event with no bookings is the shape that made the
  // owner pay twice to have a page rebuilt.
  const road: RoadFact[] = [];
  let eventRow: Record<string, unknown> | null = null;
  try {
    const { data } = await admin
      .from('events')
      .select(
        'created_at, mood_board_updated_at, moodboard_theme_name, moodboard_theme_description',
      )
      .eq('event_id', args.eventId)
      .maybeSingle();
    eventRow = (data as Record<string, unknown> | null) ?? null;
  } catch {
    eventRow = null;
  }

  const dateSetMs = msOf(eventRow?.created_at) ?? args.createdAtMs;
  facts.roadStartMs = dateSetMs;

  const setFact = roadFact(
    'road-date-set',
    dateSetMs,
    "Set na 'yan",
    'The date',
    'The day it stopped being someday. Everything below this line was made after it.',
  );
  if (setFact) road.push(setFact);

  const themeMs = msOf(eventRow?.mood_board_updated_at);
  const themeName = asString(eventRow?.moodboard_theme_name);
  const themeFact = roadFact(
    'road-theme',
    themeMs,
    'The look they saved',
    themeName ?? 'The look they chose',
    asString(eventRow?.moodboard_theme_description),
  );
  if (themeFact) road.push(themeFact);

  // The team. One entry for the whole team, stamped at the FIRST booking —
  // eight vendor rows would be eight road entries about paperwork.
  try {
    const { data } = await admin
      .from('event_vendors')
      .select('vendor_name, contract_signed_at, created_at, status')
      .eq('event_id', args.eventId)
      .not('contract_signed_at', 'is', null)
      .order('contract_signed_at', { ascending: true });
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const firstMs = rows.length ? msOf(rows[0]!.contract_signed_at) : null;
    if (firstMs != null) {
      const names = rows
        .map((r) => asString(r.vendor_name))
        .filter((n): n is string => Boolean(n));
      const fact = roadFact(
        'road-team',
        firstMs,
        `${rows.length} booked`,
        'The team comes together',
        names.length ? names.join(' · ') : null,
      );
      if (fact) road.push(fact);
    }
  } catch {
    /* no team entry */
  }

  // Captures made BEFORE the day — the prenup, the despedida shoot. One entry,
  // stamped at the first of them, and it belongs to the GUESTS' layer: the
  // count is what the guests made, exactly like a bar height.
  //
  // ⚠ TWO QUERIES, NOT ONE, AND THAT IS THE POINT. Pulling every pre-day row to
  // count them in memory is the exact shape `03` §3 records as the read that
  // starved: Papic cameras may shoot for six months before the day, so "just
  // select the column and take .length" is an unbounded read of hundreds of rows
  // to produce one integer. A HEAD count returns no rows at all, and the
  // earliest is a single row. Both are bounded ABOVE by the window's start —
  // the road is, by definition, everything before the day.
  try {
    const { count } = await admin
      .from('papic_photos')
      .select('captured_at', { count: 'exact', head: true })
      .eq('event_id', args.eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .lt('captured_at', window.startIso);
    const { data } = await admin
      .from('papic_photos')
      .select('captured_at')
      .eq('event_id', args.eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .lt('captured_at', window.startIso)
      .order('captured_at', { ascending: true })
      .limit(1);
    const rows = (data ?? []) as Array<Record<string, unknown>>;
    const total = typeof count === 'number' && count > 0 ? count : rows.length;
    const firstMs = rows.length ? msOf(rows[0]!.captured_at) : null;
    if (firstMs != null) {
      const fact = roadFact(
        'road-pre-captures',
        firstMs,
        `${total} before the day`,
        'The camera opens',
        'The first photographs of this celebration, taken before the day itself.',
        'guest',
      );
      if (fact) road.push(fact);
    }
  } catch {
    /* no pre-day capture entry */
  }

  // The broadcasts. Every session that went live BEFORE the day is a road
  // entry; the ones on the day are the film a minute is timecoded into.
  try {
    const { data } = await admin
      .from('panood_broadcasts')
      .select('broadcast_id, went_live_at, ended_at')
      .eq('event_id', args.eventId)
      .not('went_live_at', 'is', null)
      .order('went_live_at', { ascending: true });
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const liveAtMs = msOf(r.went_live_at);
      const rawId = r.broadcast_id;
      // 🔒 A raw column on its way to a URL is NOT free. Same barrier the
      // shipped `watchFilmEmbedUrl` puts in front of this exact column.
      if (liveAtMs == null || !isYouTubeVideoId(rawId)) continue;
      facts.broadcasts.push({ videoId: rawId, liveAtMs, endedAtMs: msOf(r.ended_at) });
      if (facts.roadEndMs != null && liveAtMs < facts.roadEndMs) {
        const fact = roadFact(
          `road-live-${rawId}`,
          liveAtMs,
          'Live, before the day',
          'On air',
          'The stream that went out before the day itself — and everyone who watched it.',
        );
        if (fact) road.push(fact);
      }
    }
  } catch {
    /* no broadcasts */
  }

  road.sort((a, b) => a.atMs - b.atMs);
  facts.road = road;

  // ── After ─────────────────────────────────────────────────────────────────
  const after: RoadFact[] = [];
  try {
    const { data } = await admin
      .from('event_editorial')
      .select('published_at, status')
      .eq('event_id', args.eventId)
      .maybeSingle();
    const row = (data as Record<string, unknown> | null) ?? null;
    if (asString(row?.status) === 'published') {
      const fact = roadFact(
        'after-published',
        msOf(row?.published_at),
        'The edition',
        'Published',
        'The day, closed and kept. From here it only gains anniversaries.',
      );
      if (fact) after.push(fact);
    }
  } catch {
    /* no after entry */
  }
  after.sort((a, b) => a.atMs - b.atMs);
  facts.after = after;

  // ── The venue, minute by minute ───────────────────────────────────────────
  //
  // ⚠⚠ THE WALL-CLOCK TRAP. `event_schedule_blocks.start_at` stores the VENUE'S
  // WALL CLOCK in a timestamptz column — prod holds `14:00+00` for a 2 PM Manila
  // ceremony. Comparing it to a capture's real instant is out by exactly the
  // venue's offset, which is how every afternoon photo once landed in the
  // morning's block. `plannedInstant` lifts it, and a block whose time will not
  // parse is SKIPPED rather than guessed at.
  //
  // 🔒 `is_public` IS PART OF THE QUERY. A block the couple marked private is
  // one they deliberately kept off the guest schedule; naming it on a public
  // story page publishes the thing they hid.
  // Who runs which block, resolved once. `responsible_vendor_ids` points at
  // `event_vendors.vendor_id`, and the shipped payload's `vendors` list carries
  // no id — so the names come from the same table the ids point into rather
  // than from a fuzzy match on a display string.
  const vendorNameById = new Map<string, string>();
  try {
    const { data } = await admin
      .from('event_vendors')
      .select('vendor_id, vendor_name')
      .eq('event_id', args.eventId);
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const id = asString(r.vendor_id);
      const name = asString(r.vendor_name);
      if (id && name) vendorNameById.set(id, name);
    }
  } catch {
    /* no supplier credits per minute */
  }

  try {
    const { data } = await admin
      .from('event_schedule_blocks')
      .select('label, block_type, start_at, end_at, location, responsible_vendor_ids')
      .eq('event_id', args.eventId)
      .eq('is_public', true);
    const raw = (data ?? []) as Array<Record<string, unknown>>;
    const lifted: VenueBlock[] = [];
    for (const b of raw) {
      const startAt = asString(b.start_at);
      if (!startAt) continue;
      const startMs = plannedInstant(startAt, DEFAULT_EVENT_TZ);
      if (startMs === null) continue;
      const endRaw = asString(b.end_at);
      const endMs = endRaw ? plannedInstant(endRaw, DEFAULT_EVENT_TZ) : null;
      const ids = Array.isArray(b.responsible_vendor_ids) ? b.responsible_vendor_ids : [];
      lifted.push({
        label: asString(b.label),
        blockType: asString(b.block_type),
        startMs,
        endMs: endMs ?? Number.NaN,
        location: asString(b.location),
        vendorNames: ids
          .map((id) => vendorNameById.get(asString(id) ?? ''))
          .filter((n): n is string => Boolean(n)),
      });
    }
    lifted.sort((a, b) => a.startMs - b.startMs);
    // Close an open block at the next one's start, or ninety minutes, whichever
    // comes first — the same rule `moments-from-the-schedule.ts` argues for, and
    // for the same reason: a block that swallows the day states nothing.
    for (let i = 0; i < lifted.length; i += 1) {
      const w = lifted[i]!;
      if (!Number.isNaN(w.endMs)) continue;
      const next = lifted[i + 1];
      const capped = w.startMs + 90 * 60_000;
      w.endMs = next ? Math.min(next.startMs, capped) : capped;
    }
    facts.blocks = lifted;
  } catch {
    /* no venue state — venueStateAt returns 'no_venue' */
  }

  // ── The dial ──────────────────────────────────────────────────────────────
  facts.bucketMinutes = dialBucketMinutes(window.days);
  facts.bins = await loadDialBins(admin, args.eventId, window, facts.bucketMinutes);

  return facts;
}

/**
 * The dial's bar heights.
 *
 * 🔴 THE DEFECT THIS FIXES, AND IT WAS LEFT HERE ON PURPOSE (session register,
 * S9). `story_dial_bucket_counts` excludes hidden and unscreened captures, but
 * A VETOED CAPTURE STILL ADDS TO A BAR'S HEIGHT. `04` rule 6 is that a guest's
 * veto beats the host's curation, and `publicKeyForCapture` is the one gate that
 * decides what a public surface may show for a capture — the counts do not go
 * through it, because the veto resolves in TypeScript against a per-guest
 * opt-out list and duplicating it in SQL would be a second opinion.
 *
 * 🔑 A BAR HEIGHT IS DATA ABOUT THE GUESTS' LAYER EXACTLY AS A PHOTOGRAPH IS.
 * A guest who withdrew from the photographs still shows up as height on the
 * chart of the minute they were in.
 *
 * The subtraction is exact, not approximate:
 *   • veto unresolved  → every bar flattens (fail closed, whole-dial)
 *   • vetoed, no bake  → `publicKeyForCapture` returns null; that capture is
 *                        shown nowhere, so it is subtracted from its bucket
 *   • vetoed + a bake  → the blurred stand-in IS shown, so it still counts
 *
 * That last arm is why the fix cannot be "subtract every vetoed id": doing so
 * would draw a shorter bar than the photographs actually on the page.
 */
async function loadDialBins(
  admin: ReturnType<typeof createAdminClient>,
  eventId: string,
  window: StoryDayWindow,
  bucketMinutes: number,
): Promise<CaptureBin[]> {
  let bins: CaptureBin[] = [];
  try {
    const { data, error } = await admin.rpc('story_dial_bucket_counts', {
      p_event_id: eventId,
      p_window_start: window.startIso,
      p_window_end: window.endIso,
      p_bucket_minutes: bucketMinutes,
    });
    if (error) return [];
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const at = msOf(r.bucket_start);
      const n = Number(r.capture_count);
      if (at == null || !Number.isFinite(n)) continue;
      bins.push({ at, captures: Math.max(0, Math.floor(n)) });
    }
  } catch {
    return [];
  }
  if (bins.length === 0) return bins;

  // The veto. Resolved once, for the whole dial.
  let veto: Awaited<ReturnType<typeof loadConsentVetoedPapicIds>>;
  try {
    veto = await loadConsentVetoedPapicIds(admin, eventId);
  } catch {
    // Could not resolve it ⇒ withhold everything, exactly like every other
    // reader of this gate. A flat dial is the same answer the page gives when
    // it withholds the captures themselves.
    return bins.map((b) => ({ at: b.at, captures: 0 }));
  }
  if (veto.failed) return bins.map((b) => ({ at: b.at, captures: 0 }));
  if (veto.ids.size === 0) return bins;

  // Only the vetoed ids are re-read, and only their times — a handful of rows
  // for the guests who opted out, never the day's whole timeline.
  const withheld: number[] = [];
  try {
    const { data, error } = await admin
      .from('papic_photos')
      .select('photo_id, r2_object_key, captured_at')
      .eq('event_id', eventId)
      .eq('photo_type', 'photo')
      .is('hidden_at', null)
      .eq('moderation_state', 'clean')
      .gte('captured_at', window.startIso)
      .lt('captured_at', window.endIso)
      .in('photo_id', [...veto.ids]);
    if (error) return bins.map((b) => ({ at: b.at, captures: 0 }));
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const id = asString(r.photo_id);
      const key = asString(r.r2_object_key);
      // The ONE gate. A vetoed capture with a baked blurred stand-in is still
      // on the page, so it keeps its height.
      if (publicKeyForCapture(veto, id, key) !== null) continue;
      const at = msOf(r.captured_at);
      if (at != null) withheld.push(at);
    }
  } catch {
    return bins.map((b) => ({ at: b.at, captures: 0 }));
  }
  if (withheld.length === 0) return bins;

  return subtractWithheldFromBins(bins, withheld, bucketMinutes);
}

/** Minute-of-day for each of a day's written minutes — the day's own clock. */
export function minutesForDay(
  dayDate: string,
  chapters: ReadonlyArray<{ atIso: string | null }>,
): number[] {
  const out: number[] = [];
  for (const c of chapters) {
    if (!c.atIso) continue;
    if (manilaDayOf(c.atIso) !== dayDate) continue;
    const m = manilaMinuteOfDay(c.atIso);
    if (m != null) out.push(m);
  }
  return out.sort((a, b) => a - b);
}
