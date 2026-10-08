'use server';

/**
 * The one server action behind /admin/hub-music — Event Hub "Our music".
 *
 * ONE EXPORT, THREE MOVES (`op`: add · edit · remove). Every exported
 * `"use server"` function is a Vercel route and the deployment is refused above
 * 2,048 of them (scripts/lint-server-action-budget.mjs), so the page's three
 * moves share one door instead of taking three.
 *
 * Each move re-proves the admin itself (`requireAdminAction` — an action can be
 * called without its page), writes through the service-role client like its
 * neighbour app/admin/background-videos/actions.ts, and leaves a line in
 * `admin_audit_log`.
 *
 * 🔑 ADD READS THE FILE, NOT ITS NAME. The upload route checks who is calling,
 * the stated type and the size; what is INSIDE an .m4a only its bytes say. The
 * owner's first batch was Opus in an .m4a wrapper — silent on some iPhones. So
 * add fetches the stored object, reads its codec and length (lib/audio-sniff.ts)
 * and refuses, in a plain sentence, anything a guest's phone cannot be relied
 * on to play. The row's `file_bytes` and `duration_seconds` are what the server
 * measured, never what the browser said.
 */

import { revalidatePath } from 'next/cache';
import { after } from 'next/server';

import { requireAdminAction } from '@/lib/admin/require-admin';
import { createAdminClient } from '@/lib/supabase/admin';
import { R2_BUCKETS, r2GetBytes, r2HeadOutcome } from '@/lib/r2';
import { retireReplacedMedia } from '@/lib/website-media-server';
import { hubMusicFileVerdict, sniffAudio } from '@/lib/audio-sniff';
import {
  HUB_MUSIC_CONTENT_TYPES,
  HUB_MUSIC_MAX_BYTES,
  cleanHubMusicTitle,
  isHubMusicKey,
  isHubMusicMood,
  type HubMusicAdminTrack,
} from '@/lib/hub-music';
import {
  HUB_MUSIC_ROW_FIELDS,
  hubMusicTrackFromRow,
  type HubMusicRow,
} from '@/lib/hub-music-server';

export type HubMusicInput =
  | { op: 'add'; key: string; title: string; mood: string | null; publish: boolean }
  | {
      op: 'edit';
      trackId: string;
      title?: string;
      mood?: string | null;
      isPublished?: boolean;
      sortOrder?: number;
    }
  | { op: 'remove'; trackId: string };

export type HubMusicResult =
  | { ok: true; track: HubMusicAdminTrack | null }
  | { ok: false; error: string };

const PAGE = '/admin/hub-music';
const NEEDS_A_MOOD = 'Pick a mood before publishing — couples find music by mood.';
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Next signals a redirect by THROWING; catching it would turn a sign-in bounce into an error line. */
function isFrameworkControlFlow(err: unknown): boolean {
  const digest = (err as { digest?: unknown } | null)?.digest;
  return typeof digest === 'string' && digest.startsWith('NEXT_');
}

type Db = ReturnType<typeof createAdminClient>;

async function audit(
  db: Db,
  entry: { action: string; trackId: string; actorUserId: string; before?: unknown; after?: unknown },
): Promise<void> {
  const { error } = await db.from('admin_audit_log').insert({
    action: entry.action,
    target_table: 'hub_music_tracks',
    target_id: entry.trackId,
    actor_user_id: entry.actorUserId,
    before_json: entry.before ?? null,
    after_json: entry.after ?? null,
  });
  // The change itself already happened; a missing audit line must be loud in
  // the log, not a reason to tell the admin their save failed.
  if (error) console.error('[hub-music audit]', error.message);
}

const READ_FAILED = { ok: false, error: 'Couldn’t read that track. Refresh and try again.' } as const;

/** One track's row. `read: false` is a refused read — never the same answer as "no such track". */
async function readRow(
  db: Db,
  trackId: string,
): Promise<{ read: true; row: HubMusicRow | null } | { read: false }> {
  const { data, error } = await db
    .from('hub_music_tracks')
    .select(HUB_MUSIC_ROW_FIELDS)
    .eq('track_id', trackId)
    .maybeSingle();
  if (error) {
    console.error('[hub-music] track read failed:', error.message);
    return { read: false };
  }
  return { read: true, row: (data as HubMusicRow | null) ?? null };
}

/** Takes an uploaded file that will not become a track back out of storage — only if nothing uses it. */
function sweep(key: string, context: string): void {
  after(async () => {
    await retireReplacedMedia({ previous: [key], next: [], context });
  });
}

async function add(
  db: Db,
  adminId: string,
  input: Extract<HubMusicInput, { op: 'add' }>,
): Promise<HubMusicResult> {
  if (!isHubMusicKey(input.key)) return { ok: false, error: 'That upload isn’t Event Hub music.' };
  const title = cleanHubMusicTitle(input.title);
  if (!title) return { ok: false, error: 'Give the track a title of up to 80 characters.' };
  const mood = input.mood === null ? null : isHubMusicMood(input.mood) ? input.mood : undefined;
  if (mood === undefined) return { ok: false, error: 'That mood isn’t on the list.' };
  if (input.publish && !mood) return { ok: false, error: NEEDS_A_MOOD };

  // A key is one track's. Asked before the file is read, so a second "add" of
  // a live track's key can never reach the sweep below.
  const { data: taken, error: takenErr } = await db
    .from('hub_music_tracks')
    .select('track_id')
    .eq('r2_key', input.key)
    .maybeSingle();
  if (takenErr) return { ok: false, error: 'Couldn’t check the music list. Try again.' };
  if (taken) return { ok: false, error: 'That file is already a track on the list.' };

  const head = await r2HeadOutcome({ bucket: R2_BUCKETS.media, key: input.key });
  if (head.kind === 'absent') {
    return { ok: false, error: 'The upload did not arrive. Add the file again.' };
  }
  if (head.kind === 'unknown') {
    return { ok: false, error: 'Storage did not answer, so the file could not be checked. Try again.' };
  }
  const size = head.head.size;
  const storedType = (head.head.contentType ?? '').split(';')[0]?.trim() ?? '';
  if (!Number.isFinite(size) || size <= 0 || size > HUB_MUSIC_MAX_BYTES) {
    sweep(input.key, 'hub-music refused upload (size)');
    return { ok: false, error: 'Event Hub music can be up to 20 MB. Add a smaller file.' };
  }
  if (!(HUB_MUSIC_CONTENT_TYPES as readonly string[]).includes(storedType)) {
    sweep(input.key, 'hub-music refused upload (type)');
    return { ok: false, error: 'Event Hub music must be an M4A, MP3 or AAC file.' };
  }

  let bytes: Uint8Array;
  try {
    ({ bytes } = await r2GetBytes({ bucket: R2_BUCKETS.media, key: input.key }));
  } catch {
    return { ok: false, error: 'Storage did not answer, so the file could not be checked. Try again.' };
  }
  const verdict = hubMusicFileVerdict(sniffAudio(bytes));
  if (!verdict.ok) {
    sweep(input.key, 'hub-music refused upload (codec)');
    return { ok: false, error: verdict.error };
  }

  const { data, error } = await db
    .from('hub_music_tracks')
    .insert({
      title,
      mood,
      r2_key: input.key,
      duration_seconds: verdict.durationSeconds,
      file_bytes: bytes.byteLength,
      is_published: input.publish,
      created_by: adminId,
    })
    .select(HUB_MUSIC_ROW_FIELDS)
    .single();
  if (error || !data) {
    if (error) console.error('[hub-music] track insert failed:', error.message);
    return { ok: false, error: 'The track could not be saved. Try again.' };
  }
  const row = data as HubMusicRow;
  await audit(db, { action: 'hub_music_track_add', trackId: row.track_id, actorUserId: adminId, after: row });
  return { ok: true, track: await hubMusicTrackFromRow(row) };
}

async function edit(
  db: Db,
  adminId: string,
  input: Extract<HubMusicInput, { op: 'edit' }>,
): Promise<HubMusicResult> {
  if (!UUID.test(input.trackId)) return { ok: false, error: 'That track isn’t on the list.' };
  const found = await readRow(db, input.trackId);
  if (!found.read) return READ_FAILED;
  const before = found.row;
  if (!before) return { ok: false, error: 'That track is no longer on the list. Refresh to see it.' };

  const patch: Record<string, unknown> = {};
  if (input.title !== undefined) {
    const title = cleanHubMusicTitle(input.title);
    if (!title) return { ok: false, error: 'Give the track a title of up to 80 characters.' };
    patch.title = title;
  }
  if (input.mood !== undefined) {
    if (input.mood !== null && !isHubMusicMood(input.mood)) {
      return { ok: false, error: 'That mood isn’t on the list.' };
    }
    patch.mood = input.mood;
  }
  if (input.sortOrder !== undefined) {
    if (!Number.isInteger(input.sortOrder) || input.sortOrder < 0 || input.sortOrder > 9999) {
      return { ok: false, error: 'The order is a whole number from 0 to 9999.' };
    }
    patch.sort_order = input.sortOrder;
  }
  if (input.isPublished !== undefined) patch.is_published = input.isPublished === true;

  const moodAfter = 'mood' in patch ? patch.mood : before.mood;
  const publishedAfter = 'is_published' in patch ? patch.is_published : before.is_published;
  if (publishedAfter && !moodAfter) return { ok: false, error: NEEDS_A_MOOD };
  if (Object.keys(patch).length === 0) return { ok: true, track: await hubMusicTrackFromRow(before) };

  const { data, error } = await db
    .from('hub_music_tracks')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('track_id', input.trackId)
    .select(HUB_MUSIC_ROW_FIELDS)
    .maybeSingle();
  if (error || !data) {
    if (error) console.error('[hub-music] track update failed:', error.message);
    return { ok: false, error: 'The change could not be saved. Try again.' };
  }
  const row = data as HubMusicRow;
  await audit(db, {
    action: 'hub_music_track_edit',
    trackId: row.track_id,
    actorUserId: adminId,
    before,
    after: row,
  });
  return { ok: true, track: await hubMusicTrackFromRow(row) };
}

async function remove(
  db: Db,
  adminId: string,
  input: Extract<HubMusicInput, { op: 'remove' }>,
): Promise<HubMusicResult> {
  if (!UUID.test(input.trackId)) return { ok: false, error: 'That track isn’t on the list.' };
  const found = await readRow(db, input.trackId);
  if (!found.read) return READ_FAILED;
  const before = found.row;
  if (!before) return { ok: true, track: null }; // already gone — the list just needs to catch up

  const { error } = await db.from('hub_music_tracks').delete().eq('track_id', input.trackId);
  if (error) {
    console.error('[hub-music] track delete failed:', error.message);
    return { ok: false, error: 'The track could not be removed. Try again.' };
  }
  await audit(db, { action: 'hub_music_track_remove', trackId: before.track_id, actorUserId: adminId, before });
  // The row is gone; its file follows, off the request path, and only once a
  // fresh read proves no other row points at it (lib/website-media-server.ts).
  sweep(before.r2_key, `hub-music track ${before.public_id} removed`);
  return { ok: true, track: null };
}

/** Add · edit · remove one Event Hub music track. */
export async function saveHubMusic(input: HubMusicInput): Promise<HubMusicResult> {
  try {
    const { userId } = await requireAdminAction();
    const db = createAdminClient();
    const result =
      input?.op === 'add'
        ? await add(db, userId, input)
        : input?.op === 'edit'
          ? await edit(db, userId, input)
          : input?.op === 'remove'
            ? await remove(db, userId, input)
            : ({ ok: false, error: 'Nothing to do.' } as const);
    if (result.ok) revalidatePath(PAGE);
    return result;
  } catch (err) {
    if (isFrameworkControlFlow(err)) throw err;
    // The thrown words name a table or an environment variable; they go to the
    // log. The person gets a sentence they can act on.
    console.error('[hub-music]', err);
    const forbidden = err instanceof Error && err.message === 'Forbidden';
    return { ok: false, error: forbidden ? 'Admin access required.' : 'Something went wrong. Try again.' };
  }
}
