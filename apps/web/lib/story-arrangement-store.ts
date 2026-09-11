/**
 * THE ARRANGEMENT'S READS AND ITS ONE WRITE — `10_WHAT_IS_LEFT_SESSIONS_2026-09-10.md` step 3.
 *
 * The shape and the rules live in `story-arrangement.ts`; this module fetches what they need
 * and hands it over. It takes the admin client as a PARAMETER (type-only import) so its guard
 * can run it against a stand-in — the house pattern from `story-cover.ts`.
 *
 * 🔒 SERVICE-ROLE READS ARE OUTSIDE EVERY RLS RULE. `/[slug]` renders with the admin client,
 * so `loadStoryArrangement` is the whole fence there, and it builds the fence itself rather
 * than trusting a caller to: the story's audience is read off the SAME row as the arrangement,
 * the guests' layer is asked of it (S3), and every capture goes through the consent veto (S14)
 * before it can reach a page. A caller supplies only who is looking.
 *
 * ── WHY A COLUMN AND NOT A KEY IN `draft_json` ───────────────────────────────
 * The step's pre-answer was "one key in `event_editorial.draft_json`, through `saveEditorial`".
 * Measured before deciding: THREE writers rewrite that whole document from a copy read moments
 * earlier — `saveEditorial`, the cover step, and What's Next (`{ ...base, key: value }`). An
 * arrangement that autosaves on every change would be silently put back by whichever of them
 * finished second, including the story's own Save button in the same tab. So it has its own
 * column on the same row (`arrangement`, with `arrangement_version`), which none of them name
 * and so none of them can overwrite — and one database function that writes it with a version
 * check (`save_story_arrangement`).
 */

import type { SupabaseClient } from '@supabase/supabase-js';

import {
  loadConsentVetoedPapicIds,
  publicKeyForCapture,
} from '@/app/[slug]/_components/editorial/consent-veto';
import { resolvePlayRef, resolveStillRef } from './papic-display-ref';
import { PUBLIC_SAFE_MODERATION_STATE, filterPublicSafeRows } from './public-media-visibility';
import { plannedInstant } from './run-of-show';
import { DEFAULT_EVENT_TZ } from './schedule';
import {
  ARRANGEMENT_PROBLEM_MESSAGE,
  type ArrangementProblem,
  type PoolItem,
  type ResolvedArrangement,
  type RunOfShowMoment,
  dropNamesThatAreLabels,
  isRunOfShowMomentId,
  keepOnlyRefs,
  mentionedRefsOf,
  placedRefsOf,
  readStoredArrangement,
  resolveArrangementForViewer,
  runOfShowMomentId,
  sanitizeArrangementForSave,
} from './story-arrangement';
import { storyDayWindow, type StoryDayWindow } from './story-day-window';
import { storyAudienceOf, type StoryViewer } from './who-can-see-your-story';

function asString(v: unknown): string | null {
  if (typeof v === 'string') {
    const t = v.trim();
    return t.length ? t : null;
  }
  return null;
}

/**
 * How many of the day's captures one read takes. It is PostgREST's own row ceiling, so a
 * larger number here would be a promise the server silently breaks; `poolTruncated` says when
 * it was reached. A capture already on a page is fetched by id on top of this, so a hand
 * arrangement never loses a photograph to the ceiling.
 */
export const ARRANGEMENT_POOL_CAP = 1_000;

/** Ids per `in (…)` — a thousand uuids in one query string is a request some proxies refuse. */
const IN_CHUNK = 150;

function chunks<T>(list: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < list.length; i += size) out.push(list.slice(i, i + size));
  return out;
}

/* ══════════════════════════════════════════════════════════════════════════
   THE RUN OF SHOW
   ══════════════════════════════════════════════════════════════════════════ */

/**
 * The run of show, as moments.
 *
 * 🔒 PUBLIC BLOCKS ONLY — `is_public`, and never a coordinator's unreleased prep block. The
 * same rule the story's chapter names and venue state already follow: a block the couple kept
 * off the guest schedule is not named on a story page. And as with `fetchPublicScheduleBlocks`,
 * a staged `coordinator_only` block is excluded in app code because the admin client passes
 * straight through the RLS that would otherwise hide it.
 *
 * ⚠ THE WALL-CLOCK TRAP. `start_at` holds the venue's wall clock in a timestamptz column;
 * `plannedInstant` lifts it to a real instant before any capture is compared with it, and a
 * block whose time cannot be read is SKIPPED rather than guessed at.
 *
 * `failed` — the read was refused. That is not "no run of show": an editor must not re-sort a
 * story because a query failed.
 */
export async function loadRunOfShowMoments(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ moments: RunOfShowMoment[]; failed: boolean }> {
  try {
    const { data, error } = await admin
      .from('event_schedule_blocks')
      .select('public_id, label, start_at, sort_order')
      .eq('event_id', eventId)
      .eq('is_public', true)
      .neq('visibility', 'coordinator_only')
      .order('start_at', { ascending: true })
      .order('sort_order', { ascending: true });
    if (error) return { moments: [], failed: true };
    const moments: RunOfShowMoment[] = [];
    for (const r of (data ?? []) as Array<Record<string, unknown>>) {
      const publicId = asString(r.public_id);
      const label = asString(r.label);
      const startAt = asString(r.start_at);
      if (!publicId || !label || !startAt) continue;
      const startMs = plannedInstant(startAt, DEFAULT_EVENT_TZ);
      if (startMs === null) continue;
      moments.push({ id: runOfShowMomentId(publicId), label, startMs });
    }
    // Start order, and the database's own order for a tie (the query's second key).
    moments.sort((a, b) => a.startMs - b.startMs);
    return { moments, failed: false };
  } catch {
    return { moments: [], failed: true };
  }
}

/* ══════════════════════════════════════════════════════════════════════════
   THE POOL — every capture a page may carry, through every gate
   ══════════════════════════════════════════════════════════════════════════ */

const POOL_COLUMNS =
  'photo_id, photo_type, captured_at, r2_object_key, display_r2_key, thumb_r2_key, poster_r2_key, clip_web_r2_key, full_res_dropped_at, moderation_state';

/**
 * The captures the arrangement may use — Papic's photos AND snippets (owner 2026-09-10: "they
 * will pic from papic photos and snippets").
 *
 * The gates, in the order they apply, each the one the story already uses:
 *   • screened clean — `moderation_state = 'clean'`, in the query AND re-checked on the rows
 *   • not hidden by the host — `hidden_at IS NULL`
 *   • the event's own days — the same `storyDayWindow` bound the story's timeline reads use,
 *     so a prenup shoot from four months earlier is not sorted into the first moment
 *   • 🔑 THE CONSENT VETO (S14) — `publicKeyForCapture`, the ONE gate every public surface asks.
 *     A photo that tags a guest who took their photo back is dropped, or — where a blurred copy
 *     was baked — shown blurred, exactly as everywhere else on the story (owner 2026-08-17). A
 *     SNIPPET that is vetoed is dropped outright: the blurred copy is a still, and a snippet
 *     that silently became a photograph would be a different thing than the host placed.
 *   • the veto unresolved → NO captures at all (`failed`). Fail closed, like every reader of it.
 */
export async function loadArrangementPool(
  admin: SupabaseClient,
  args: { eventId: string; window: StoryDayWindow | null; alsoRefs?: readonly string[] },
): Promise<{ items: PoolItem[]; failed: boolean; truncated: boolean }> {
  const empty = { items: [], failed: true, truncated: false };
  const rows: Array<Record<string, unknown>> = [];
  let truncated = false;
  try {
    let q = admin
      .from('papic_photos')
      .select(POOL_COLUMNS)
      .eq('event_id', args.eventId)
      .in('photo_type', ['photo', 'clip'])
      .is('hidden_at', null)
      .eq('moderation_state', PUBLIC_SAFE_MODERATION_STATE);
    if (args.window) {
      q = q.gte('captured_at', args.window.startIso).lte('captured_at', args.window.endIso);
    }
    const { data, error } = await q
      .order('captured_at', { ascending: true })
      .limit(ARRANGEMENT_POOL_CAP);
    if (error) return empty;
    rows.push(...((data ?? []) as Array<Record<string, unknown>>));
    truncated = rows.length >= ARRANGEMENT_POOL_CAP;

    // What is already on a page but not in that read — past the ceiling, or outside the days.
    const have = new Set(rows.map((r) => asString(r.photo_id)));
    const missing = [...new Set(args.alsoRefs ?? [])].filter((r) => !have.has(r));
    for (const ids of chunks(missing, IN_CHUNK)) {
      const { data: more, error: moreError } = await admin
        .from('papic_photos')
        .select(POOL_COLUMNS)
        .eq('event_id', args.eventId)
        .in('photo_type', ['photo', 'clip'])
        .is('hidden_at', null)
        .eq('moderation_state', PUBLIC_SAFE_MODERATION_STATE)
        .in('photo_id', ids);
      if (moreError) return empty;
      rows.push(...((more ?? []) as Array<Record<string, unknown>>));
    }
  } catch {
    return empty;
  }

  let veto: Awaited<ReturnType<typeof loadConsentVetoedPapicIds>>;
  try {
    veto = await loadConsentVetoedPapicIds(admin, args.eventId);
  } catch {
    return empty;
  }
  if (veto.failed) return empty;

  const items: PoolItem[] = [];
  const seen = new Set<string>();
  for (const r of filterPublicSafeRows(rows)) {
    const ref = asString(r.photo_id)?.toLowerCase() ?? null;
    if (!ref || seen.has(ref)) continue;
    const isClip = r.photo_type === 'clip';
    const display = {
      photo_type: isClip ? 'clip' : 'photo',
      r2_object_key: asString(r.r2_object_key),
      display_r2_key: asString(r.display_r2_key),
      thumb_r2_key: asString(r.thumb_r2_key),
      poster_r2_key: asString(r.poster_r2_key),
      clip_web_r2_key: asString(r.clip_web_r2_key),
      full_res_dropped_at: asString(r.full_res_dropped_at),
    };
    const capturedMs = Date.parse(asString(r.captured_at) ?? '');
    const capturedAtMs = Number.isFinite(capturedMs) ? capturedMs : null;

    if (isClip) {
      if (veto.ids.has(ref) || veto.ids.has(asString(r.photo_id) ?? '')) continue;
      const playKey = resolvePlayRef(display);
      if (!playKey) continue;
      seen.add(ref);
      items.push({ ref, media: 'snippet', capturedAtMs, stillKey: resolveStillRef(display), playKey });
      continue;
    }
    const stillKey = publicKeyForCapture(veto, asString(r.photo_id), resolveStillRef(display));
    if (!stillKey) continue;
    seen.add(ref);
    items.push({ ref, media: 'photo', capturedAtMs, stillKey, playKey: null });
  }
  return { items, failed: false, truncated };
}

/* ══════════════════════════════════════════════════════════════════════════
   THE ONE READ
   ══════════════════════════════════════════════════════════════════════════ */

export type ArrangementSource = 'arrangement' | 'run_of_show' | 'pool';

export type LoadedArrangement = ResolvedArrangement & {
  /** The version a save must name to change it. 0 = never saved. */
  version: number;
  /**
   * ⚠ WHAT COULD NOT BE READ. An unreadable source looks exactly like an empty one — every
   * photo gone from every page — so an editor MUST NOT save while this is non-empty: it would
   * write "no photos" over a story that has them. A public reader simply shows less.
   */
  unreadable: ArrangementSource[];
  /** The day had more captures than one read takes; the rest are not in the tray. */
  poolTruncated: boolean;
  /**
   * The run of show this read sorted by — handed back so the host's editor can re-derive
   * Automatic with the SAME `resolveArrangement` and the same blocks, instead of reading them a
   * second time and risking a second answer. Public blocks only (see `loadRunOfShowMoments`);
   * EMPTY for a reader the guests' layer does not admit, who is not given the day's shape.
   */
  runOfShow: RunOfShowMoment[];
};

/**
 * The arrangement, as THIS viewer may have it — the read steps 4, 5 and 7 are built on.
 *
 * `viewer` is the same `StoryViewer` the page already resolves for `redactStoryLayers`. The
 * audience is NOT taken from the caller: it is read here, off the arrangement's own row, so the
 * layer rule is asked of the story it is actually guarding.
 */
export async function loadStoryArrangement(
  admin: SupabaseClient,
  eventId: string,
  viewer: StoryViewer,
): Promise<LoadedArrangement> {
  const unreadable: ArrangementSource[] = [];

  let storedRaw: unknown = null;
  let version = 0;
  let statusRaw: unknown = null;
  try {
    const { data, error } = await admin
      .from('event_editorial')
      .select('status, arrangement, arrangement_version')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) unreadable.push('arrangement');
    const row = (data as Record<string, unknown> | null) ?? null;
    storedRaw = row?.arrangement ?? null;
    statusRaw = row?.status ?? null;
    const v = Number(row?.arrangement_version);
    version = Number.isInteger(v) && v >= 0 ? v : 0;
  } catch {
    unreadable.push('arrangement');
  }
  // An unreadable status fails CLOSED to 'draft' — a stranger then gets nothing.
  const status = storyAudienceOf(statusRaw);
  const stored = readStoredArrangement(storedRaw);

  const runOfShow = await loadRunOfShowMoments(admin, eventId);
  if (runOfShow.failed) unreadable.push('run_of_show');

  // Nothing guest-made is fetched at all for a reader the guests' layer does not admit.
  const withheld = resolveArrangementForViewer({
    stored,
    runOfShow: runOfShow.moments,
    pool: [],
    status,
    viewer,
  });
  if (withheld.withheld) {
    return { ...withheld, version, unreadable, poolTruncated: false, runOfShow: [] };
  }

  let window: StoryDayWindow | null = null;
  let poolReadable = true;
  try {
    const { data, error } = await admin
      .from('events')
      .select('event_date, event_end_date')
      .eq('event_id', eventId)
      .maybeSingle();
    if (error) poolReadable = false;
    const ev = (data as Record<string, unknown> | null) ?? null;
    window = storyDayWindow(asString(ev?.event_date), asString(ev?.event_end_date));
  } catch {
    poolReadable = false;
  }

  let pool: Awaited<ReturnType<typeof loadArrangementPool>> = {
    items: [],
    failed: true,
    truncated: false,
  };
  if (poolReadable) {
    pool = await loadArrangementPool(admin, {
      eventId,
      window,
      alsoRefs: placedRefsOf(stored),
    });
  }
  if (pool.failed) unreadable.push('pool');

  const resolved = resolveArrangementForViewer({
    stored,
    runOfShow: runOfShow.moments,
    pool: pool.items,
    status,
    viewer,
  });
  return {
    ...resolved,
    version,
    unreadable,
    poolTruncated: pool.truncated,
    runOfShow: runOfShow.moments,
  };
}

/* ══════════════════════════════════════════════════════════════════════════
   THE ONE WRITE
   ══════════════════════════════════════════════════════════════════════════ */

export type SaveArrangementResult =
  /** `adjusted` — what was kept differs from what was sent; the editor should re-read. */
  | { ok: true; version: number; adjusted: boolean }
  | { ok: false; reason: 'conflict'; version: number; message: string }
  | { ok: false; reason: 'invalid'; problem: ArrangementProblem; message: string }
  | { ok: false; reason: 'failed'; message: string };

/** Said when somebody else's save got there first. */
export const ARRANGEMENT_CONFLICT_MESSAGE =
  'This story was just changed somewhere else — in another tab or on another device. ' +
  'Your last change here was not saved. Reload to see the newest version.';

const FAILED_MESSAGE = 'Could not save. Please try again.';

/**
 * Save a whole arrangement, if nobody else has saved one since `expectedVersion`.
 *
 * ⚠ AUTHORITY IS THE CALLER'S. This proves nothing about who is asking; the server action
 * proves the host (`hostUserId`) before it calls this. What it DOES enforce is the document:
 *
 *   1. the shape (`sanitizeArrangementForSave`) — a photo in two moments, a repeated id, no
 *      moments at all: REFUSED, nothing written;
 *   2. every capture id must be one of THIS celebration's — anything else is taken out (a
 *      capture that was hidden or taken back is kept: the READ drops it, and keeping it here
 *      is what lets it come back if it is released);
 *   3. a run-of-show "name" that is only the block's label is not stored as a rename;
 *   4. then ONE write, `save_story_arrangement`, which only lands if the stored version is
 *      still `expectedVersion`.
 *
 * ── WHAT HAPPENS WHEN TWO TABS SAVE ───────────────────────────────────────────
 * Both hold version 7. The first save lands and makes it 8. The second names 7, the database
 * refuses it, and it comes back `conflict` with the version that won — the losing tab's change
 * is NOT written and nothing it did overwrites the other tab's work. The editor says so
 * (`ARRANGEMENT_CONFLICT_MESSAGE`) and reloads the newest version.
 *
 * 🔑 AND A SAVE THAT IS SENT TWICE IS NOT A CONFLICT. When the stored document is already
 * exactly the one being sent — a retried request, or two tabs that made the same change — it
 * answers `ok` with the current version. That is what makes an autosave safe to retry.
 */
export async function saveStoryArrangement(
  admin: SupabaseClient,
  args: { eventId: string; input: unknown; expectedVersion: unknown },
): Promise<SaveArrangementResult> {
  // A number, and only a number — `Number(null)` is 0, which would read a request that named no
  // version at all as one built on "never saved".
  const expected = typeof args.expectedVersion === 'number' ? args.expectedVersion : Number.NaN;
  if (!Number.isInteger(expected) || expected < 0) {
    return {
      ok: false,
      reason: 'invalid',
      problem: 'not_an_arrangement',
      message: ARRANGEMENT_PROBLEM_MESSAGE.not_an_arrangement,
    };
  }

  const clean = sanitizeArrangementForSave(args.input);
  if (!clean.ok) {
    return {
      ok: false,
      reason: 'invalid',
      problem: clean.problem,
      message: ARRANGEMENT_PROBLEM_MESSAGE[clean.problem],
    };
  }
  let doc = clean.doc;

  // 2 · Only this celebration's captures. A refused read refuses the save — an id we could not
  // check is not an id we may store.
  const refs = mentionedRefsOf(doc);
  if (refs.length > 0) {
    const known = new Set<string>();
    try {
      for (const ids of chunks(refs, IN_CHUNK)) {
        const { data, error } = await admin
          .from('papic_photos')
          .select('photo_id')
          .eq('event_id', args.eventId)
          .in('photo_id', ids);
        if (error) return { ok: false, reason: 'failed', message: FAILED_MESSAGE };
        for (const r of (data ?? []) as Array<Record<string, unknown>>) {
          const id = asString(r.photo_id);
          if (id) known.add(id.toLowerCase());
        }
      }
    } catch {
      return { ok: false, reason: 'failed', message: FAILED_MESSAGE };
    }
    doc = keepOnlyRefs(doc, known);
  }

  // 3 · A label is not a rename. Only asked when a run-of-show moment carries a name at all.
  if (doc.moments.some((m) => isRunOfShowMomentId(m.id) && m.name !== undefined)) {
    const runOfShow = await loadRunOfShowMoments(admin, args.eventId);
    if (!runOfShow.failed) doc = dropNamesThatAreLabels(doc, runOfShow.moments);
  }

  const adjusted = JSON.stringify(doc) !== JSON.stringify(clean.doc);

  // 4 · The one write.
  try {
    const { data, error } = await admin.rpc('save_story_arrangement', {
      p_event_id: args.eventId,
      p_expected: expected,
      p_doc: doc,
    });
    if (error) return { ok: false, reason: 'failed', message: FAILED_MESSAGE };
    const row = (Array.isArray(data) ? data[0] : data) as Record<string, unknown> | null;
    const outcome = asString(row?.outcome);
    const version = Number(row?.saved_version);
    if ((outcome === 'saved' || outcome === 'unchanged') && Number.isInteger(version)) {
      return { ok: true, version, adjusted };
    }
    if (outcome === 'conflict' && Number.isInteger(version)) {
      return { ok: false, reason: 'conflict', version, message: ARRANGEMENT_CONFLICT_MESSAGE };
    }
    return { ok: false, reason: 'failed', message: FAILED_MESSAGE };
  } catch {
    return { ok: false, reason: 'failed', message: FAILED_MESSAGE };
  }
}
