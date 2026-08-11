import type { SupabaseClient } from '@supabase/supabase-js';
import { isYouTubeVideoId } from '@/lib/panood-watch';
import { liveStudioRoamEnabled, type RoamManifest, type RoamZoneStatus } from '@/lib/live-studio-roam';
import { canPublishMultiCam, limitPublishedManifest } from '@/lib/live-studio-publish';
// ⚠ `lib/panood-youtube.ts` and `lib/live-studio-channel-grants.ts` are imported
// DYNAMICALLY inside provisionRoamBroadcasts, not here. Both carry
// `import 'server-only'`, and a static edge to either would drag it into this
// module's graph — which would make `buildRoamManifest`, `checkoutPoolChannel`
// and the rest of this file unrunnable under `tsx --test` (the repo's unit
// runner does not resolve `server-only`). Same reason
// lib/live-studio-window-server.ts documents for taking its client as a
// parameter instead of constructing one. They are only needed on the real
// provisioning path, which never executes in a unit test.

/**
 * apps/web/lib/live-studio-roam-provision.ts
 *
 * The provisioning SPINE for Live Studio ROAM (2026-07-23 owner design session;
 * `Live_Studio_Cast_and_Roam_2026-07-23.md`). Three concerns, all flag-dark
 * (`NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED`) and isolated from CAST:
 *
 *   1. CHANNEL POOL lifecycle — check a Setnayan-owned channel out of the pool
 *      for an event's window, return it after (the owner-locked "our own channel"
 *      model; one channel per event isolates concurrency + copyright-strike blast
 *      radius).
 *   2. MANIFEST MIRROR — build the PUBLIC picker manifest from the (control-plane)
 *      zones + (service-role) streams and write it to events.live_studio_roam_manifest,
 *      exactly as CAST mirrors its watch URL into events.panood_watch_url. This is
 *      what makes the event-page picker light up.
 *   3. YOUTUBE BROADCAST creation (N per event) — see provisionRoamBroadcasts
 *      below. ⭐ WIRED IN WAVE 9 (2026-07-26). It reuses the CAST YouTube lifecycle
 *      (lib/panood-youtube.ts createYoutubeBroadcast/Stream/bind) and draws the POOL
 *      CHANNEL's own OAuth token from lib/live-studio-channel-grants.ts — the
 *      platform-level, channel-keyed grant the owner confirmed at § 4h. Still inert
 *      until the owner completes G1 (create + verify the Setnayan channel, enable
 *      live streaming — the 24h wait applies to Setnayan, once) and connects it.
 *
 * DB functions take a SupabaseClient so they are testable and callable from either
 * a control-room session or the service-role admin client. buildRoamManifest is
 * pure (unit-tested). Graceful-degrade on a missing/legacy table/column (42P01 /
 * 42703) so a pre-migration DB never crashes — matches panood-camera-seats.ts.
 */

const UNDEFINED_TABLE = '42P01';
const UNDEFINED_COLUMN = '42703';

// ── Row shapes (the fields these helpers read) ──────────────────────────────

export type RoamZoneRow = {
  id: number;
  zone_index: number;
  label: string;
  venue_label: string | null;
  is_featured: boolean;
  // Unified Live Studio (2026-07-25): the zone currently cut to the directed Main
  // Stage. Optional so a pre-unified read (before the is_main_stage column) still
  // type-checks; absent → no cut → the viewer falls back to the featured zone.
  is_main_stage?: boolean | null;
  status: RoamZoneStatus;
};

export type RoamStreamRow = {
  zone_id: number | null;
  broadcast_id: string; // YouTube liveBroadcast id == the public videoId
  status: 'ready' | 'testing' | 'live' | 'complete' | 'errored';
};

export type RoamChannelRow = {
  id: number;
  youtube_channel_id: string;
  label: string | null;
  status: 'available' | 'checked_out' | 'maintenance' | 'retired';
  verified: boolean;
  concurrent_cap: number;
};

/** A stream still eligible to appear in the picker (not finished/broken). */
function isLiveableStream(s: RoamStreamRow): boolean {
  return s.status !== 'complete' && s.status !== 'errored';
}

/**
 * Build the PUBLIC picker manifest from a zone set + its streams. PURE +
 * exported so it is unit-tested and shared by the mirror writer.
 *
 * A zone appears ONLY when it has an active (non-complete/errored) stream whose
 * broadcast_id is a real 11-char YouTube video id — so a planned-but-not-yet-live
 * zone, or one whose stream failed, is silently omitted rather than rendering a
 * dead tile. This is the WRITE-side injection barrier (parseRoamManifest is the
 * READ-side one). Output is ordered by zone_index.
 */
export function buildRoamManifest(zones: RoamZoneRow[], streams: RoamStreamRow[]): RoamManifest {
  // Newest-eligible stream per zone (later rows win; provisioning inserts in order).
  const streamByZone = new Map<number, RoamStreamRow>();
  for (const s of streams) {
    if (s.zone_id == null || !isLiveableStream(s)) continue;
    if (!isYouTubeVideoId(s.broadcast_id)) continue;
    streamByZone.set(s.zone_id, s);
  }

  const out: RoamManifest = [];
  for (const z of zones) {
    if (z.status === 'disabled') continue; // couple turned this zone off
    const stream = streamByZone.get(z.id);
    if (!stream) continue; // no live video for this zone → omit
    out.push({
      zoneIndex: z.zone_index,
      label: z.label,
      venueLabel: z.venue_label,
      videoId: stream.broadcast_id,
      featured: z.is_featured === true,
      mainStage: z.is_main_stage === true,
      status: z.status,
    });
  }
  return out.sort((a, b) => a.zoneIndex - b.zoneIndex);
}

/**
 * Rebuild + persist events.live_studio_roam_manifest from the current zones + streams.
 * Call after any provisioning / go-live / zone change so the public picker
 * reflects reality. Service-role (admin) — reads the secret-bearing streams table.
 * Returns the number of zones written, or 0 on a pre-migration DB.
 *
 * ⭐ THIS IS THE PAYWALL (owner-locked 2026-07-25 · § 4d "rehearse free, pay to
 * broadcast"). This column is the ONLY thing that makes a MULTI-channel stream
 * guest-visible, and this function is its ONLY writer — so gating here gates
 * publication itself, with no action to replay and no second door. Rehearsal
 * (adding cameras, naming them, cutting between them) writes
 * live_studio_roam_zones and is free precisely because zones are not published;
 * this mirror is the moment they would become public, and the moment the
 * entitlement is asked for.
 *
 * FAIL-CLOSED: canPublishMultiCam resolves to false on any error, and false means
 * "publish the one on-air channel". A free host's mirror therefore still produces a
 * real working single-camera stream — the free tier is not punished, it is bounded.
 */
export async function mirrorRoamManifest(admin: SupabaseClient, eventId: string): Promise<number> {
  if (!eventId) return 0;
  try {
    const [{ data: zones, error: zErr }, { data: streams, error: sErr }] = await Promise.all([
      admin
        .from('live_studio_roam_zones')
        .select('id, zone_index, label, venue_label, is_featured, is_main_stage, status')
        .eq('event_id', eventId),
      admin.from('live_studio_roam_streams').select('zone_id, broadcast_id, status').eq('event_id', eventId),
    ]);
    if (zErr?.code === UNDEFINED_TABLE || sErr?.code === UNDEFINED_TABLE) return 0;
    if (zErr || sErr) return 0;

    const built = buildRoamManifest(
      (zones ?? []) as RoamZoneRow[],
      (streams ?? []) as RoamStreamRow[],
    );
    // Only ask the entitlement when there is actually something to gate — a
    // zero-or-one-channel mirror is the free livestream and costs no lookup.
    const owned = built.length > 1 ? await canPublishMultiCam(admin, eventId) : true;
    const manifest = limitPublishedManifest(built, owned);

    const { error: upErr } = await admin
      .from('events')
      .update({ live_studio_roam_manifest: manifest })
      .eq('event_id', eventId);
    if (upErr?.code === UNDEFINED_COLUMN || upErr) return 0;
    return manifest.length;
  } catch {
    return 0;
  }
}

/**
 * Check a Setnayan-owned channel out of the pool for an event's live window.
 *
 * Idempotent: if the event already holds a channel, that one is returned. Else
 * the first available + verified channel is claimed (status → 'checked_out'). The
 * partial unique index live_studio_roam_channel_pool_one_per_event is the hard backstop
 * against a race binding two channels to one event. Service-role (admin).
 *
 * Returns the claimed channel, or null when the pool is empty / all busy — the
 * caller surfaces "no Roam channel available, add one" rather than crashing.
 */
export async function checkoutPoolChannel(
  admin: SupabaseClient,
  eventId: string,
): Promise<RoamChannelRow | null> {
  if (!eventId) return null;
  const SELECT = 'id, youtube_channel_id, label, status, verified, concurrent_cap';
  try {
    // Already holding one? (idempotent re-provision)
    const { data: existing, error: exErr } = await admin
      .from('live_studio_roam_channel_pool')
      .select(SELECT)
      .eq('checked_out_event_id', eventId)
      .eq('status', 'checked_out')
      .maybeSingle();
    if (exErr?.code === UNDEFINED_TABLE) return null;
    if (existing) return existing as RoamChannelRow;

    // Claim the first available, verified channel.
    //
    // BOUNDED RETRY (Wave 9). The lost-update guard below is correct — Postgres
    // re-evaluates `status='available'` after the row lock, so the loser of a race
    // updates zero rows and gets null — but on its own it made a LOSER report "no
    // channel available" while other channels sat free. Two weddings starting in
    // the same second is not exotic on a Saturday. Retrying re-reads the pool, so
    // the loser takes the next free channel instead of being turned away.
    // Bounded, not a spin: after 4 attempts the pool is genuinely contended and
    // "none available" is the honest answer.
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const { data: free, error: freeErr } = await admin
        .from('live_studio_roam_channel_pool')
        .select(SELECT)
        .eq('status', 'available')
        .eq('verified', true)
        .order('id', { ascending: true })
        .limit(1)
        .maybeSingle();
      if (freeErr || !free) return null; // pool genuinely empty

      const { data: claimed, error: claimErr } = await admin
        .from('live_studio_roam_channel_pool')
        .update({
          status: 'checked_out',
          checked_out_event_id: eventId,
          checked_out_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', (free as RoamChannelRow).id)
        .eq('status', 'available') // lost-update guard: only if still free
        .select(SELECT)
        .maybeSingle();
      if (claimErr) return null;
      if (claimed) return claimed as RoamChannelRow;
      // Lost the race for THIS channel — loop and look for another.
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Return the event's checked-out channel to the pool (recycle after the event +
 * after the recording has been pulled). Best-effort + idempotent. Service-role.
 */
export async function returnPoolChannel(admin: SupabaseClient, eventId: string): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { error } = await admin
      .from('live_studio_roam_channel_pool')
      .update({
        status: 'available',
        checked_out_event_id: null,
        checked_out_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq('checked_out_event_id', eventId)
      .eq('status', 'checked_out');
    return !error;
  } catch {
    return false;
  }
}

/**
 * Return the event's channel to the pool ONLY IF nothing is still riding on it.
 *
 * The plain `returnPoolChannel` above is unconditional and correct after an event
 * is over. This one is the SAFE release for a failure path: it refuses while any
 * stream for the event is still `ready`/`testing`/`live`, so a partially-successful
 * provisioning run cannot hand the channel to the next wedding while three live
 * broadcasts of this one are still on it.
 *
 * Returns true when the channel was released (or was never held).
 */
export async function releasePoolChannelIfIdle(
  admin: SupabaseClient,
  eventId: string,
): Promise<boolean> {
  if (!eventId) return false;
  try {
    const { data, error } = await admin
      .from('live_studio_roam_streams')
      .select('id')
      .eq('event_id', eventId)
      .not('status', 'in', '("complete","errored")')
      .limit(1);
    if (error?.code === UNDEFINED_TABLE) return returnPoolChannel(admin, eventId);
    if (error) return false; // unknown state → do NOT release; an admin can force it
    if ((data ?? []).length > 0) return false; // still carrying traffic
    return await returnPoolChannel(admin, eventId);
  } catch {
    return false;
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   ⭐ WAVE 9 — YOUTUBE BROADCAST PROVISIONING on a SETNAYAN-OWNED pool channel
   (owner-confirmed 2026-07-26 · Live_Studio_Unified_Spec_2026-07-25.md § 4h)
   ══════════════════════════════════════════════════════════════════════════════

   WHAT CHANGED. The block that used to live here said "NOT WIRED YET — needs the
   pool channel's own OAuth token, and that token model is gated on G1 + the
   OAuth-path decision". The owner has now taken that decision: ONE Setnayan
   account, Internal consent, `live_studio_channel_grants` keyed by pool channel
   (lib/live-studio-channel-grants.ts). So this is wired.

   🚫 NO SECOND PAYWALL HERE — the instruction the old block left, honoured.
   `mirrorRoamManifest` (§ 4d) is the publish gate and it stays the ONLY one.
   Creating a YouTube broadcast is a cost SETNAYAN pays; it is not a guest-visible
   act. Provisioning N broadcasts for a free host and publishing ONE of them is the
   intended shape — the free host simply never gets a second entry into the
   manifest, because the mirror at the end of this function asks
   `canPublishMultiCam` exactly as it does on every other write. A gate added here
   would be a second rule that can disagree with the first, and the way it would
   disagree is a paying couple's cameras missing on one surface and present on
   another.

   ⚠⚠ THE HONEST LIMIT, and it is not a detail. Provisioning creates the
   broadcast CONTAINER and its RTMP ingestion endpoint. It does NOT put video into
   it. Browsers cannot push RTMP and the native capture app was scoped but never
   built (§ 4c), so something must still ENCODE the program output — today that is
   the couple's own OBS window-capturing `/panood/program/[eventId]`. Wave 9
   removes the requirement that the couple own or authorise a YOUTUBE ACCOUNT. It
   does not remove the encoder. A provisioned broadcast with nothing pushing to it
   shows as `ready`, never `live`, and the readiness copy
   (lib/live-studio-readiness.ts) says exactly that in words.
   ══════════════════════════════════════════════════════════════════════════════ */

/**
 * The token for the channel this event ALREADY holds — READ-ONLY, claims nothing.
 *
 * The distinction from `resolveEventBroadcastToken` below matters: ending a
 * broadcast must never be able to check a channel OUT of the pool. A host pressing
 * "End" on an event that holds nothing would otherwise consume pool inventory as a
 * side effect of stopping.
 */
export async function getHeldChannelAccessToken(
  admin: SupabaseClient,
  eventId: string,
): Promise<string | null> {
  if (!eventId || !liveStudioRoamEnabled()) return null;
  try {
    const { data, error } = await admin
      .from('live_studio_roam_channel_pool')
      .select('id')
      .eq('checked_out_event_id', eventId)
      .eq('status', 'checked_out')
      .maybeSingle();
    if (error || !data) return null;
    const { getPoolChannelAccessToken } = await import('@/lib/live-studio-channel-grants');
    return await getPoolChannelAccessToken(admin, (data as { id: number }).id);
  } catch {
    return null;
  }
}

/**
 * ⭐ THE ONE THAT ACTUALLY REMOVES THE COUPLE'S GOOGLE ACCOUNT.
 *
 * Resolve an access token for this event's broadcast from the SETNAYAN pool —
 * checking a channel out for the event if it does not already hold one.
 *
 * This is what `goLivePanood` consults before falling back to the couple's own
 * BYO grant. Wave 9's headline promise ("the couple never connects a Google
 * account") is not delivered by provisioning the ROAM picker alone: the single
 * directed broadcast — the one the program output actually feeds — goes out
 * through `goLivePanood`, and until this existed that path returned "Connect your
 * YouTube channel first" and stopped.
 *
 * Returns null when the flag is off, the pool is empty, or the channel is not
 * connected — and in the last case it RELEASES the channel again, so a pool
 * misconfiguration cannot quietly consume its own inventory one go-live at a time.
 * A null means "fall back to BYO", never "fail".
 */
export async function resolveEventBroadcastToken(
  admin: SupabaseClient,
  eventId: string,
): Promise<{ accessToken: string; channelPoolId: number; source: 'pool' } | null> {
  if (!eventId || !liveStudioRoamEnabled()) return null;
  const channel = await checkoutPoolChannel(admin, eventId);
  if (!channel) return null;
  const { getPoolChannelAccessToken } = await import('@/lib/live-studio-channel-grants');
  const accessToken = await getPoolChannelAccessToken(admin, channel.id);
  if (!accessToken) {
    await releasePoolChannelIfIdle(admin, eventId);
    return null;
  }
  return { accessToken, channelPoolId: channel.id, source: 'pool' };
}

export type ProvisionFailure =
  | 'flag_off'
  | 'no_zones'
  | 'no_channel_available'
  | 'channel_not_connected'
  | 'youtube_error';

export type ProvisionResult = {
  ok: boolean;
  /** Null when nothing could be claimed. */
  channelPoolId: number | null;
  /** Broadcasts created by THIS run (0 on a fully idempotent re-run). */
  created: number;
  /** Zones that already had an active stream and were left alone. */
  reused: number;
  /** Zones skipped because the pool channel's concurrent_cap was reached. */
  skippedOverCap: number;
  /** Entries in the manifest AFTER the § 4d publish gate. 1 for a free host. */
  published: number;
  reason: ProvisionFailure | null;
  /**
   * ⚠ ADMIN-ONLY. Never contains a token or stream key, but it DOES name admin
   * screens and env flags ("Connect or release one in Admin → Live Studio
   * channels.", "…(NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED)."). It is not host copy
   * and must not be shown to a couple — see `provisionFailureSentence`.
   */
  detail: string | null;
  /**
   * ⚠ THE CAMERAS THAT WERE NEITHER STARTED, REUSED, NOR CAPPED — i.e. the ones
   * the break-the-loop path silently abandons. `skippedOverCap` counts the cap;
   * nothing counted these until now, which is why a refusal reached the host as
   * a plain green tick.
   */
  notStarted: number;
  /**
   * ⚠ THE DROPPED-CAMERA SENTENCE — plain English, host-safe, null when nothing
   * was dropped. See `cameraDropNotice` below for why this is on the RESULT and
   * not merely derivable from `skippedOverCap`.
   */
  notice: string | null;
};

function failure(
  reason: ProvisionFailure,
  detail: string,
  channelPoolId: number | null = null,
  notStarted = 0,
): ProvisionResult {
  return {
    ok: false,
    channelPoolId,
    created: 0,
    reused: 0,
    skippedOverCap: 0,
    published: 0,
    reason,
    detail,
    notStarted,
    notice: null,
  };
}

/**
 * ⚠ SOMEBODY IS TOLD WHEN A CAMERA IS DROPPED.
 *
 * `provisionRoamBroadcasts` has always counted the zones it refused because the
 * pool channel's `concurrent_cap` was already full — and then thrown the number
 * away. Its only caller (`goLivePanood`) discarded the whole result. So a host
 * could name six camera channels, hand six QR codes to six people, press Go
 * live, see a green success, and two of those operators would simply never
 * appear. Nothing errored, nothing was logged, nothing was shown.
 *
 * This turns that count into the sentence the host reads. PURE, so the wording
 * is unit-testable and cannot drift between the two screens that show it (the
 * setup card and the controller's transport row).
 *
 * Returns null when nothing was dropped — a "0 cameras were left out" banner on
 * a perfectly good broadcast is noise, and noise is how a real warning gets
 * skimmed past.
 *
 * `carried` is passed rather than assumed equal to `cap`: a zone that already
 * had a stream is counted as reused BEFORE the cap check, so the number actually
 * riding the channel can sit one or two above the cap. The denominator the host
 * reads must be the cameras they really set up, not a number we inferred.
 */
export function cameraDropNotice(input: {
  /** ProvisionResult.skippedOverCap. */
  skippedOverCap: number;
  /** created + reused — the channels that DID make it onto the channel. */
  carried: number;
  /** The pool channel's concurrent_cap. */
  cap: number;
}): string | null {
  const dropped = Math.trunc(input.skippedOverCap);
  if (!Number.isFinite(dropped) || dropped <= 0) return null;
  const total = Math.max(dropped + Math.max(0, Math.trunc(input.carried)), dropped);
  const cap = Math.max(0, Math.trunc(input.cap));
  const wasWere = dropped === 1 ? 'is' : 'are';
  const cameraWord = cap === 1 ? 'camera' : 'cameras';
  return (
    `${dropped} of your ${total} cameras ${wasWere} not being broadcast — ` +
    `this channel carries ${cap} ${cameraWord} at a time. ` +
    `Turn off the cameras you don't need, then go live again.`
  );
}

/**
 * ⚠ `detail` IS ADMIN COPY. THIS IS THE HOST'S.
 *
 * The first repair of the dropped-camera silence folded `provisioned.detail`
 * into the host's notice VERBATIM, on the grounds that it was "already written
 * host-safe". It is not, and the type says so one screen up: `detail` is
 * documented "safe to show an admin". Two of the five strings prove it —
 *
 *   'No verified Setnayan channel is free right now. Connect or release one in
 *    Admin → Live Studio channels.'
 *   'Live Studio is not enabled (NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED).'
 *
 * — an internal screen the couple cannot open, and an environment flag. Sending
 * a couple to Admin → Live Studio channels is worse than the silence it
 * replaced: silence leaves them asking, an impossible instruction leaves them
 * trying.
 *
 * 🔑 SO THE HOST SENTENCE IS BUILT FROM THE REASON AND A COUNT, NOT FROM COPY.
 * Same shape as `cameraDropNotice` directly above: numbers in, one plain
 * sentence out, nothing to keep in sync with an admin string and nothing that
 * changes behaviour when someone rewords a log line.
 *
 * ⚠ `no_zones` and `flag_off` return null ON PURPOSE. They mean the host never
 * set up multi-camera at all, so nothing of theirs went missing — and the roam
 * flag is on for EVERY host, so folding them would ride a warning on top of
 * every ordinary single-camera go-live. Noise is how a real warning gets skimmed
 * past; that is the same reason `cameraDropNotice` refuses to emit for zero.
 *
 * ⏭ KNOWN, NOT FIXED HERE: `no_zones` is overloaded upstream — the zones read
 * returns it BOTH for "this event has no camera channels yet" AND for a failed
 * read of that table, so a DB read failure is suppressed with the empty case.
 * Splitting them needs a new `ProvisionFailure` member; keying the split off the
 * two `detail` strings instead would make behaviour depend on copy, which is the
 * exact mistake this function exists to undo.
 */
export function provisionFailureSentence(
  reason: ProvisionFailure | null,
  notStarted: number,
): string | null {
  // How many cameras this costs the host, worded for someone who is about to
  // hand out QR codes. 0 means we could not tell — never claim a number then.
  const n = Number.isFinite(notStarted) && notStarted > 0 ? Math.floor(notStarted) : 0;
  const cameras = n === 0 ? 'Some cameras' : n === 1 ? '1 camera' : `${n} cameras`;

  switch (reason) {
    // Deliberate silence — see the header.
    case 'no_zones':
    case 'flag_off':
    case null:
      return null;
    // ⚠ "YOUR STREAM IS NOT RUNNING" WAS FALSE AT BOTH OF THESE SITES, and it
    // is the most alarming thing we could have told a host mid-show. Both are
    // reached from the go-live action AFTER the single-camera broadcast is
    // already persisted and its watch URL written — that ordering is deliberate
    // and pinned by a test ("the free single-cam livestream is a published
    // promise, and a multi-cam provisioning hiccup must never be the reason it
    // did not go out"). So the show IS on air; what failed is the EXTRA cameras
    // joining it. transport-row.tsx renders this as role="status", not "alert",
    // for exactly that reason — the banner's own markup already knew.
    // A host reading "your stream is not running" while it runs either stops a
    // working broadcast or spends the ceremony trying to fix nothing.
    case 'no_channel_available':
      return `${cameras} could not start — Setnayan has no broadcast channel free right now. Your stream is still on air from the camera you started with. Try Go live again in a few minutes, and tell Setnayan if it keeps happening.`;
    case 'channel_not_connected':
      return `${cameras} could not start — this event's Setnayan broadcast channel needs reconnecting. Your stream is still on air from the camera you started with. Tell Setnayan so they can reconnect it.`;
    case 'youtube_error':
      return `${cameras} did not start. Anyone shooting on ${n === 1 ? 'it' : 'them'} will not appear in the stream — check your camera list before you begin.`;
    default: {
      // An unhandled reason must never fall through to silence: silence is the
      // whole bug. TypeScript makes this unreachable; a new union member added
      // without a sentence lands here instead of disappearing.
      const _exhaustive: never = reason;
      void _exhaustive;
      return `${cameras} could not start. Check your camera list before you begin, and tell Setnayan if anyone is missing.`;
    }
  }
}

/**
 * The one place a ProvisionResult becomes the single sentence a host reads, so
 * neither way of losing a camera — the cap, or the refusal that breaks the loop
 * — can be wired up without the other.
 */
export function hostNoticeFromProvision(
  provisioned: Pick<ProvisionResult, 'ok' | 'notice' | 'reason' | 'notStarted'>,
): string | null {
  const parts: string[] = [];

  const dropped = provisioned.notice?.trim();
  if (dropped) parts.push(dropped);

  if (provisioned.ok === false) {
    const failed = provisionFailureSentence(provisioned.reason, provisioned.notStarted);
    if (failed) parts.push(failed);
  }

  return parts.length === 0 ? null : parts.join(' ');
}

/**
 * ⭐ Provision one YouTube broadcast per camera zone on a Setnayan-owned pool
 * channel, then re-mirror the public manifest through the § 4d publish gate.
 *
 * END TO END:
 *   1. flag check — dark unless NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED=true.
 *   2. read the event's non-disabled zones (the host's camera channels).
 *   3. check a channel out of the pool (idempotent — an event that already holds
 *      one keeps it; a partial unique index stops two events sharing a channel).
 *   4. get THAT CHANNEL's access token. No token → nothing is created and the
 *      channel is released again, so a mis-configured pool cannot silently eat
 *      its own inventory.
 *   5. for each zone with no active stream: liveBroadcasts.insert →
 *      liveStreams.insert → liveBroadcasts.bind → row in live_studio_roam_streams.
 *      Zones that already have one are REUSED, not duplicated.
 *   6. mirrorRoamManifest → the publish gate decides how many of them guests see.
 *
 * IDEMPOTENT BY CONSTRUCTION at three layers: the pool checkout is a no-op for an
 * event that already holds a channel; each zone is skipped when it already has a
 * non-complete stream; and `live_studio_roam_streams_one_active_per_zone` (a
 * partial unique index) is the database backstop if two runs race — a 23505 is
 * caught and counted as `reused`, not as an error. A double-clicked provision
 * cannot double-spend YouTube quota.
 *
 * Pass a SERVICE-ROLE client: it reads the secret-bearing streams + grants tables
 * and `orders` (whose RLS is purchaser-scoped).
 */
export async function provisionRoamBroadcasts(
  admin: SupabaseClient,
  eventId: string,
  opts?: { titlePrefix?: string; scheduledStartTime?: string },
): Promise<ProvisionResult> {
  if (!eventId) return failure('no_zones', 'No event id.');
  if (!liveStudioRoamEnabled()) {
    return failure('flag_off', 'Live Studio is not enabled (NEXT_PUBLIC_LIVE_STUDIO_ROAM_ENABLED).');
  }

  // ── 2. zones ──────────────────────────────────────────────────────────────
  let zones: RoamZoneRow[] = [];
  try {
    const { data, error } = await admin
      .from('live_studio_roam_zones')
      .select('id, zone_index, label, venue_label, is_featured, is_main_stage, status')
      .eq('event_id', eventId)
      .neq('status', 'disabled')
      .order('zone_index', { ascending: true });
    if (error) return failure('no_zones', 'Could not read camera channels for this event.');
    zones = (data ?? []) as RoamZoneRow[];
  } catch {
    return failure('no_zones', 'Could not read camera channels for this event.');
  }
  if (zones.length === 0) {
    return failure('no_zones', 'This event has no camera channels yet.');
  }

  // ── 3. pool channel ───────────────────────────────────────────────────────
  const channel = await checkoutPoolChannel(admin, eventId);
  if (!channel) {
    return failure(
      'no_channel_available',
      'No verified Setnayan channel is free right now. Connect or release one in Admin → Live Studio channels.',
      null,
      zones.length,
    );
  }

  // ── 4. that channel's token ───────────────────────────────────────────────
  // Loaded here rather than at module scope — see the import block at the top.
  const [{ getPoolChannelAccessToken }, { bindYoutubeBroadcast, createYoutubeBroadcast, createYoutubeStream }] =
    await Promise.all([
      import('@/lib/live-studio-channel-grants'),
      import('@/lib/panood-youtube'),
    ]);

  const accessToken = await getPoolChannelAccessToken(admin, channel.id);
  if (!accessToken) {
    // Nothing was created, so releasing is safe AND necessary: leaving the channel
    // checked out on a credential failure would strand pool inventory behind a
    // problem that has nothing to do with this event.
    await releasePoolChannelIfIdle(admin, eventId);
    return failure(
      'channel_not_connected',
      'The Setnayan channel for this event is not connected to YouTube (or its access needs renewing).',
      channel.id,
      zones.length,
    );
  }

  // Which zones already have a live-able stream? Those are reused verbatim.
  const existingZoneIds = new Set<number>();
  try {
    const { data } = await admin
      .from('live_studio_roam_streams')
      .select('zone_id, status')
      .eq('event_id', eventId);
    for (const row of (data ?? []) as RoamStreamRow[]) {
      if (row.zone_id != null && isLiveableStream(row)) existingZoneIds.add(row.zone_id);
    }
  } catch {
    // A read failure here only costs idempotency, and the unique index below is
    // the real backstop — so continue rather than refusing to provision.
  }

  const cap = Number.isFinite(channel.concurrent_cap) && channel.concurrent_cap > 0
    ? channel.concurrent_cap
    : zones.length;

  let created = 0;
  let reused = 0;
  let skippedOverCap = 0;
  let youtubeError: string | null = null;
  const scheduledStartTime = opts?.scheduledStartTime ?? new Date(Date.now() + 5 * 60 * 1000).toISOString();
  const prefix = opts?.titlePrefix?.trim();

  for (const zone of zones) {
    if (existingZoneIds.has(zone.id)) {
      reused += 1;
      continue;
    }
    // The pool channel's soft concurrency cap counts EVERY stream that will be on
    // it for this event, reused ones included — the cap is about the channel, not
    // about this run.
    if (created + reused >= cap) {
      skippedOverCap += 1;
      continue;
    }

    const title = prefix ? `${prefix} · ${zone.label}` : zone.label;
    try {
      const broadcast = await createYoutubeBroadcast(accessToken, {
        title,
        scheduledStartTime,
        // UNLISTED, always. These broadcasts live on a SETNAYAN channel that other
        // couples' weddings also use, and guest-pick enforcement is by omission
        // (lib/live-studio-roam.ts applyGuestPick) — a `public` broadcast would be
        // discoverable from the channel page regardless of what we omit, which is
        // the one hole omission cannot close.
        privacyStatus: 'unlisted',
      });
      const stream = await createYoutubeStream(accessToken, { title });
      await bindYoutubeBroadcast(accessToken, broadcast.broadcastId, stream.streamId);

      const { error: insErr } = await admin.from('live_studio_roam_streams').insert({
        event_id: eventId,
        zone_id: zone.id,
        channel_pool_id: channel.id,
        broadcast_id: broadcast.broadcastId,
        stream_id: stream.streamId,
        stream_key: stream.streamName,
        ingestion_url: stream.ingestionAddress,
        status: 'ready',
      });
      if (insErr) {
        // 23505 = the partial unique index fired: a concurrent run already
        // provisioned this zone. That is the idempotency backstop doing its job,
        // not a failure.
        if (insErr.code === '23505') {
          reused += 1;
          continue;
        }
        youtubeError = 'Broadcast created but could not be recorded.';
        break;
      }
      created += 1;
    } catch (e) {
      // Never surface the raw YouTube body — it can echo request parameters.
      youtubeError = `YouTube refused a broadcast for "${zone.label}".`;
      void e;
      break;
    }
  }

  // ── 6. THE PUBLISH GATE. Not bypassed, not duplicated — the same single writer
  //       every other path uses, which asks canPublishMultiCam for itself.
  const published = await mirrorRoamManifest(admin, eventId);

  if (youtubeError && created === 0 && reused === 0) {
    // Total failure with nothing riding on the channel → give it back.
    await releasePoolChannelIfIdle(admin, eventId);
    return {
      ...failure('youtube_error', youtubeError, channel.id, zones.length - skippedOverCap),
      published,
      skippedOverCap,
    };
  }

  return {
    ok: youtubeError === null,
    channelPoolId: channel.id,
    created,
    reused,
    skippedOverCap,
    published,
    reason: youtubeError ? 'youtube_error' : null,
    detail: youtubeError,
    // Whatever the loop never reached. Zero on every clean run, including the
    // capped one — a capped zone is reported by `notice`, not abandoned.
    notStarted: zones.length - created - reused - skippedOverCap,
    // The count stops being discarded HERE. Carried on the result so the caller
    // has a sentence to show, not a number it has to decide how to word.
    notice: cameraDropNotice({ skippedOverCap, carried: created + reused, cap }),
  };
}
