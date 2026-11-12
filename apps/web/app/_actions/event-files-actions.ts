'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { logQueryError } from '@/lib/supabase/error-detect';
import { parseClientRef } from '@/lib/r2-client-ref';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { sendChatMessageCore } from '@/lib/chat-send';
import { formatCount } from '@/lib/format-number';
import { createHash } from 'node:crypto';
import { r2Copy, r2Delete, r2GetBytes } from '@/lib/r2';
import { randomUUID } from 'node:crypto';
import { parseStoredAsset } from '@/lib/uploads';
import { fileKindOf, readExifTakenAt } from '@/lib/supplier-files';

/**
 * 📁 A SUPPLIER'S FILES FOR ONE EVENT — ONE dispatcher (Piece 3b · DECISION_LOG 2026-11-12), both sides, because every
 * exported server action is one Vercel route and the budget sits at its ceiling (`scripts/lint-server-action-budget.mjs`
 * — raised by ONE for this file, same shape as `couple-photo-share-actions.ts`).
 *
 * Supplier ops (under the shop's own RLS — the database re-checks every rule, migration 20271339773560):
 *   • `known`  — "is this exact file already stored?" by its content hash → the stored copy's id, so the phone SKIPS
 *                the upload and the file becomes a link (one stored copy per photo, never uploaded twice).
 *   • `file`   — file one upload: a photo/video under a QUOTED service, or a document in "This booking". Stores the copy
 *                once (a hash already stored resolves to it — never a second row), then files it.
 *   • `map`    — "From your portfolio": each pick becomes a POINTER (grp linked) to the existing photo — no copy, keeps
 *                its own service. Only the shop's own portfolio / card photos are accepted.
 *   • `remove` — a filed row leaves this event (the stored copy stays: it may back other files).
 *   • `filechat` — 📥 Piece 3c "File under a service": a photo/video the SHOP sent in this event's chat is filed under a
 *                quoted service. The server reads the chat file's bytes, measures hash + date; bytes already stored are a
 *                link (no copy). New bytes get ONE kept copy in the shop's folder — the chat file itself is deleted by the
 *                90-day chat clean-up, so the filed photo must not lean on it.
 * Couple op:
 *   • `decide` — Show · Hide (one or many, "Approve all") through `couple_decide_supplier_file`, the couple's ONLY write;
 *                then ONE line in the supplier's chat ("Ana & Miguel approved 3 photos · shown on your shop" / "… hid 1
 *                photo · taken off your shop"), private to the shop's owner. 🔑 THE DECISION IS THE SUCCESS: a failed
 *                line is logged, never reported as a failed decision.
 *
 * Every write `.select()`s so a write refused to zero rows is never reported as saved.
 */

export type EventFilesState =
  | { status: 'idle' }
  | { status: 'known'; mediaId: string | null }
  | { status: 'done'; message: string; count?: number }
  | { status: 'error'; message: string };

const NOT_SAVED = 'We couldn’t add that file. Nothing was lost — please try again.';
const SHA = /^[0-9a-f]{64}$/;
const UUID = /^[0-9a-f-]{36}$/i;

export async function eventFilesAction(_prev: EventFilesState, fd: FormData): Promise<EventFilesState> {
  const op = String(fd.get('op') ?? '');
  const eventId = String(fd.get('event_id') ?? '');
  const path = String(fd.get('return_path') ?? '');
  if (!UUID.test(eventId)) return { status: 'error', message: 'Missing event.' };
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: 'error', message: 'Please sign in again.' };
  const done = (s: EventFilesState): EventFilesState => {
    if (s.status === 'done' && (path.startsWith('/vendor-dashboard/') || path.startsWith('/dashboard/'))) revalidatePath(path);
    return s;
  };

  if (op === 'decide') {
    const decision = String(fd.get('decision') ?? '');
    if (decision !== 'shown' && decision !== 'hidden') return { status: 'error', message: 'Show or hide.' };
    let ids: string[] = [];
    try {
      ids = (JSON.parse(String(fd.get('file_ids') ?? '[]')) as unknown[]).filter((x): x is string => typeof x === 'string' && UUID.test(x));
    } catch {
      ids = [];
    }
    if (ids.length === 0 || ids.length > 200) return { status: 'error', message: 'Pick a photo first.' };
    let n = 0;
    for (const id of ids) {
      const { error } = await supabase.rpc('couple_decide_supplier_file', { p_file_id: id, p_decision: decision });
      if (error) {
        logQueryError('eventFilesAction.decide', error, { event_id: eventId }, 'graceful_degrade');
        return { status: 'error', message: n ? `Saved ${formatCount(n)} — the rest could not be saved. Please try again.` : 'We couldn’t save that. Please try again.' };
      }
      n++;
    }
    await postDecisionLine(supabase, { eventId, fileId: ids[0]!, decision, n, coupleName: String(fd.get('couple_name') ?? '') });
    return done({
      status: 'done',
      count: n,
      message: decision === 'shown' ? `Shown on their shop · ${formatCount(n)}` : 'Taken off their shop',
    });
  }

  // ── the supplier's ops ──────────────────────────────────────────────────
  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) return { status: 'error', message: 'Only a shop files for an event.' };
  const shop = profile.vendor_profile_id;

  if (op === 'known') {
    const sha = String(fd.get('sha256') ?? '');
    if (!SHA.test(sha)) return { status: 'known', mediaId: null };
    const { data } = await supabase.from('supplier_media').select('media_id').eq('vendor_profile_id', shop).eq('content_sha256', sha).maybeSingle();
    return { status: 'known', mediaId: (data as { media_id: string } | null)?.media_id ?? null };
  }

  if (op === 'file') {
    const grp = String(fd.get('grp') ?? '');
    const name = String(fd.get('name') ?? '').trim().slice(0, 200) || 'File';
    const mime = String(fd.get('mime') ?? '').slice(0, 120);
    const size = Number(fd.get('size_bytes') ?? 0);
    const kind = fileKindOf(mime, name);
    const serviceId = String(fd.get('service_id') ?? '');
    if (grp !== 'service' && grp !== 'booking') return { status: 'error', message: NOT_SAVED };
    if (grp === 'service' && kind === 'document') return { status: 'error', message: 'A document goes in This booking, not under a service.' };
    if (grp === 'booking' && kind !== 'document') return { status: 'error', message: 'A photo or a video goes under a quoted service.' };
    if (grp === 'service' && !UUID.test(serviceId)) return { status: 'error', message: 'Pick which quoted service this is for.' };

    let mediaId = String(fd.get('media_id') ?? '');
    if (!UUID.test(mediaId)) {
      const ref = String(fd.get('r2_ref') ?? '');
      const at = parseClientRef(ref, { bucket: 'setnayan-thread-files', prefixes: [`supplier-files/${shop}/`] });
      if (!at) return { status: 'error', message: 'That file could not be kept. Upload it again.' };
      // 🔑 THE SERVER READS THE BYTES ITSELF: the hash and the photo's own date are measured here, never taken from the
      // phone — a phone that lied about either could pad a shop (count one photo twice, or fake an event-day date).
      let sha: string;
      let takenAt: string | null = null;
      try {
        const { bytes } = await r2GetBytes({ bucket: at.bucket, key: at.key });
        sha = createHash('sha256').update(bytes).digest('hex');
        if (kind === 'photo') takenAt = readExifTakenAt(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
      } catch (e) {
        console.error('[eventFilesAction.file] read failed:', e instanceof Error ? e.message : e);
        return { status: 'error', message: 'That file did not finish uploading. Please try again.' };
      }
      if (!SHA.test(sha)) return { status: 'error', message: NOT_SAVED };
      const ins = await supabase
        .from('supplier_media')
        .insert({ vendor_profile_id: shop, content_sha256: sha, r2_ref: ref, mime: mime || 'application/octet-stream', size_bytes: size || null, taken_at: takenAt })
        .select('media_id')
        .single();
      if (ins.data) mediaId = (ins.data as { media_id: string }).media_id;
      else {
        // ONE STORED COPY: the same bytes were already stored, so the object just uploaded is a second copy — remove it.
        await r2Delete({ bucket: at.bucket, key: at.key }).catch(() => undefined);
        // The same bytes are already stored (a race, or the phone skipped `known`) — THAT copy is the one.
        const { data } = await supabase.from('supplier_media').select('media_id').eq('vendor_profile_id', shop).eq('content_sha256', sha).maybeSingle();
        if (!data) {
          if (ins.error) logQueryError('eventFilesAction.store', ins.error, { event_id: eventId }, 'graceful_degrade');
          return { status: 'error', message: NOT_SAVED };
        }
        mediaId = (data as { media_id: string }).media_id;
      }
    }
    const { data, error } = await supabase
      .from('event_supplier_files')
      .insert({
        event_id: eventId,
        vendor_profile_id: shop,
        grp,
        kind,
        vendor_service_id: grp === 'service' ? serviceId : null,
        media_id: mediaId,
        file_name: name,
        size_bytes: size || null,
        mime: mime || null,
      })
      .select('file_id, counts');
    if (error || !data || data.length !== 1) {
      if (error) logQueryError('eventFilesAction.file', error, { event_id: eventId }, 'graceful_degrade');
      return {
        status: 'error',
        message: error?.message.includes('quote') ? 'Only a service in this event’s quote can hold photos.' : NOT_SAVED,
      };
    }
    const counted = (data[0] as { counts: boolean }).counts;
    return done({
      status: 'done',
      message: grp === 'booking' ? 'Added to This booking' : counted ? 'Added · waiting for the couple' : 'Already stored · linked, not copied',
    });
  }

  if (op === 'map') {
    let refs: string[] = [];
    try {
      refs = (JSON.parse(String(fd.get('refs') ?? '[]')) as unknown[]).filter((x): x is string => typeof x === 'string').slice(0, 60);
    } catch {
      refs = [];
    }
    if (refs.length === 0) return { status: 'error', message: 'Pick a photo first.' };
    // Only the shop's OWN portfolio and card photos — read back, never trusted from the phone.
    const [profRes, cardsRes] = await Promise.all([
      supabase.from('vendor_profiles').select('portfolio_r2_keys').eq('vendor_profile_id', shop).maybeSingle(),
      supabase.from('vendor_services').select('vendor_service_id, primary_photo_r2_key, showcase_photo_r2_keys').eq('vendor_profile_id', shop),
    ]);
    if (profRes.error || cardsRes.error) return { status: 'error', message: NOT_SAVED };
    const own = new Map<string, string | null>();
    for (const k of (profRes.data as { portfolio_r2_keys: string[] | null } | null)?.portfolio_r2_keys ?? []) own.set(k, null);
    for (const c of (cardsRes.data ?? []) as { vendor_service_id: string; primary_photo_r2_key: string | null; showcase_photo_r2_keys: string[] | null }[]) {
      for (const k of [c.primary_photo_r2_key, ...(c.showcase_photo_r2_keys ?? [])]) if (k) own.set(k, c.vendor_service_id);
    }
    const rows = refs
      .filter((r) => own.has(r))
      .map((r) => ({
        event_id: eventId,
        vendor_profile_id: shop,
        grp: 'linked',
        kind: /\.(mp4|mov|m4v|webm)$/i.test(r) ? 'video' : 'photo',
        vendor_service_id: own.get(r) ?? null,
        portfolio_ref: r,
        file_name: r.split('/').pop()?.slice(0, 200) || 'Portfolio photo',
      }));
    if (rows.length === 0) return { status: 'error', message: 'Those photos are not on your portfolio.' };
    // One pointer per photo per event: a photo already mapped here is not mapped again.
    const { data: had, error: hadErr } = await supabase
      .from('event_supplier_files')
      .select('portfolio_ref')
      .eq('event_id', eventId)
      .eq('vendor_profile_id', shop)
      .eq('grp', 'linked');
    if (hadErr) return { status: 'error', message: NOT_SAVED };
    const already = new Set(((had ?? []) as { portfolio_ref: string }[]).map((h) => h.portfolio_ref));
    const fresh = rows.filter((r) => !already.has(r.portfolio_ref));
    if (fresh.length === 0) return done({ status: 'done', count: 0, message: 'Already linked to this event' });
    const { data, error } = await supabase.from('event_supplier_files').insert(fresh).select('file_id');
    if (error) {
      logQueryError('eventFilesAction.map', error, { event_id: eventId }, 'graceful_degrade');
      return { status: 'error', message: NOT_SAVED };
    }
    return done({ status: 'done', count: (data ?? []).length, message: 'Added · linked, not copied' });
  }

  if (op === 'filechat') {
    const messageId = String(fd.get('message_id') ?? '');
    const serviceId = String(fd.get('service_id') ?? '');
    if (!UUID.test(messageId) || !UUID.test(serviceId)) return { status: 'error', message: 'Pick which quoted service this is for.' };
    // The message: this shop's own, in its thread with THIS event (RLS reads it; the event + shop are re-checked here).
    const { data: msg } = await supabase
      .from('chat_messages')
      .select('message_id, event_id, vendor_profile_id, sender_role, attachment_r2_key, attachment_mime, attachment_name, attachment_size_bytes')
      .eq('message_id', messageId)
      .maybeSingle();
    const m = msg as {
      event_id: string;
      vendor_profile_id: string;
      sender_role: string;
      attachment_r2_key: string | null;
      attachment_mime: string | null;
      attachment_name: string | null;
      attachment_size_bytes: number | null;
    } | null;
    if (!m || m.event_id !== eventId || m.vendor_profile_id !== shop) return { status: 'error', message: 'That file is not in this chat.' };
    if (m.sender_role !== 'vendor') return { status: 'error', message: 'Only your own photos are filed under a service.' };
    const kind = fileKindOf(m.attachment_mime, m.attachment_name ?? '');
    if (kind === 'document') return { status: 'error', message: 'A document goes in This booking, not under a service.' };
    const src = parseStoredAsset(m.attachment_r2_key);
    if (!src || src.kind !== 'r2' || src.bucket !== 'setnayan-thread-files' || !src.key.startsWith('chat/')) {
      return { status: 'error', message: 'That file can no longer be filed. Send it again.' };
    }
    let mediaId: string;
    try {
      const { bytes } = await r2GetBytes({ bucket: src.bucket, key: src.key });
      const sha = createHash('sha256').update(bytes).digest('hex');
      const { data: had } = await supabase.from('supplier_media').select('media_id').eq('vendor_profile_id', shop).eq('content_sha256', sha).maybeSingle();
      if (had) mediaId = (had as { media_id: string }).media_id;
      else {
        const takenAt = kind === 'photo' ? readExifTakenAt(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer) : null;
        const ext = (m.attachment_name ?? '').match(/\.[a-z0-9]{2,5}$/i)?.[0]?.toLowerCase() ?? '';
        const toKey = `supplier-files/${shop}/${eventId}/${randomUUID()}${ext}`;
        await r2Copy({ bucket: src.bucket, fromKey: src.key, toKey });
        const ins = await supabase
          .from('supplier_media')
          .insert({
            vendor_profile_id: shop,
            content_sha256: sha,
            r2_ref: `r2://${src.bucket}/${toKey}`,
            mime: m.attachment_mime || 'application/octet-stream',
            size_bytes: m.attachment_size_bytes,
            taken_at: takenAt,
          })
          .select('media_id')
          .single();
        if (ins.error || !ins.data) {
          if (ins.error) logQueryError('eventFilesAction.filechat.store', ins.error, { event_id: eventId }, 'graceful_degrade');
          return { status: 'error', message: NOT_SAVED };
        }
        mediaId = (ins.data as { media_id: string }).media_id;
      }
    } catch (e) {
      console.error('[eventFilesAction.filechat] read failed:', e instanceof Error ? e.message : e);
      return { status: 'error', message: 'That file could not be read just now. Please try again.' };
    }
    const { data, error } = await supabase
      .from('event_supplier_files')
      .insert({
        event_id: eventId,
        vendor_profile_id: shop,
        grp: 'service',
        kind,
        vendor_service_id: serviceId,
        media_id: mediaId,
        chat_message_id: messageId,
        file_name: m.attachment_name?.slice(0, 200) || (kind === 'video' ? 'Video' : 'Photo'),
        size_bytes: m.attachment_size_bytes,
        mime: m.attachment_mime,
      })
      .select('file_id');
    if (error || !data || data.length !== 1) {
      if (error) logQueryError('eventFilesAction.filechat', error, { event_id: eventId }, 'graceful_degrade');
      return { status: 'error', message: error?.message.includes('quote') ? 'Only a service in this event’s quote can hold photos.' : NOT_SAVED };
    }
    return done({ status: 'done', message: 'Filed under the service' });
  }

  if (op === 'remove') {
    const fileId = String(fd.get('file_id') ?? '');
    const { data, error } = await supabase.from('event_supplier_files').delete().eq('file_id', fileId).eq('vendor_profile_id', shop).select('file_id');
    if (error || !data || data.length !== 1) return { status: 'error', message: 'We couldn’t remove that file. Please try again.' };
    return done({ status: 'done', message: 'Removed from this event' });
  }

  return { status: 'error', message: 'Unknown action.' };
}

/** The decision's one line in the supplier's chat — private to the shop's owner (supplier side only). */
async function postDecisionLine(
  supabase: Awaited<ReturnType<typeof createClient>>,
  args: { eventId: string; fileId: string; decision: 'shown' | 'hidden'; n: number; coupleName: string },
): Promise<void> {
  try {
    const { data: f } = await supabase.from('event_supplier_files').select('vendor_profile_id').eq('file_id', args.fileId).maybeSingle();
    const shop = (f as { vendor_profile_id: string } | null)?.vendor_profile_id;
    if (!shop) return;
    const { data: t } = await supabase.from('chat_threads').select('thread_id').eq('event_id', args.eventId).eq('vendor_profile_id', shop).maybeSingle();
    const threadId = (t as { thread_id: string } | null)?.thread_id;
    if (!threadId) return;
    // The owner's uid is read with the service role, scoped to THIS shop (a couple has no read of vendor_profiles.user_id).
    const { data: owner } = await createAdminClient().from('vendor_profiles').select('user_id').eq('vendor_profile_id', shop).maybeSingle();
    const who = args.coupleName.trim() || 'The couple';
    const photos = `${formatCount(args.n)} photo${args.n === 1 ? '' : 's'}`;
    const body = args.decision === 'shown' ? `${who} approved ${photos} · shown on your shop` : `${who} hid ${photos} · taken off your shop`;
    const r = await sendChatMessageCore(supabase, {
      threadId,
      body,
      privateTo: (owner as { user_id: string | null } | null)?.user_id ?? null,
    });
    if (r && typeof r === 'object' && 'error' in r && r.error) console.error('[eventFilesAction.decide] line failed:', r.error);
  } catch (e) {
    console.error('[eventFilesAction.decide] line failed:', e instanceof Error ? e.message : e);
  }
}
