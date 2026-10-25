'use client';

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { Upload, Loader2, Check, AlertCircle } from 'lucide-react';
import { recordSeatCapture } from '@/app/papic/actions';
import { InfoTip } from '@/app/_components/info-tip';
import type { UploadOutcome } from '@/lib/upload-send';
import {
  costInfoLine,
  coverVerdict,
  creditsCount,
  selectionCost,
  type CoverVerdict,
  type PickedCost,
  type UploadPot,
} from '../_lib/upload-credits';

/**
 * ADD TO YOUR LIBRARY — the shutter that is a file picker.
 *
 * Owner 2026-08-26: *"papic is the source where they collect media files for
 * that event"*, *"they can upload their work via papic credits as well per
 * event"*, and an uploaded photo takes *"the same spot as 1 papic photo"*.
 * 💰 PRICE SUPERSEDED 2026-10-26 (owner): *"Sorry change the concept. Not 2 but 3. So it will be triple the credits to upload instead of coming from papic"* — an added photo costs `PAPIC_POINTS_PER_UPLOADED_PHOTO`, charged by both seams from the Uploads seat.
 *
 * 🔑 THIS IS NOT A NEW CAPTURE PATH. It presigns through the SAME `/api/upload`
 * seat route and records through the SAME `recordSeatCapture` that every camera
 * in the product uses — so it inherits the credit metering, the per-camera burst
 * limiter, the server-side clip cap, the always-on safety screen, the
 * derivatives and the Drive copy without a line of any of them being rewritten.
 * The server derives the storage location from the seat token; the client never
 * chooses where anything lands.
 *
 * ⚠ THE CLIP LENGTH IS MEASURED HERE AND REFUSED HERE, NOT TRUNCATED.
 * `papicSnippetCost` bills an absent or nonsense duration at the TOP band — the
 * only direction a tampered client cannot profit from — so passing an
 * unmeasured clip through would silently overcharge a couple for their own
 * upload. A file over the cap is rejected in the picker, by name, before
 * anything is presigned and before a single credit is reserved.
 *
 * ⚠ A CLIP WITHOUT A POSTER IS NEVER SCREENED. The safety screen reads a clip
 * through its poster frame; a posterless clip stays `unscreened` forever, which
 * excludes it from every guest surface silently. So the poster is extracted
 * here, from the first frame, and a clip whose poster cannot be produced is
 * refused rather than uploaded into permanent limbo.
 */

/*
 * ⏱ EVERY FILE ENDS, AND SAYS HOW (owner 2026-10-25: *"adding photos on event memories is not fixed"*). The bytes go
 * through the shared `sendToStorage` (`lib/upload-send.ts`) — the same signer, the same stall watchdog and the same
 * progress as `<FileUpload>` — with the seat token, so nothing about WHERE a file lands or WHETHER the pot pays moved
 * to the client. The budgets are FileUpload's own (`UPLOAD_STALL_MS` / `UPLOAD_RESPONSE_MS` in `file-upload.tsx`).
 * The record step (`recordSeatCapture`) gets a clock too: a server action that never answers must not spin for ever.
 */
const UPLOAD_STALL_MS = 45_000;
const UPLOAD_RESPONSE_MS = 300_000;
const RECORD_STALL_MS = 60_000;

const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_VIDEO_BYTES = 48 * 1024 * 1024;
/** The owner-locked 10s cap, with the same tolerance the server allows. */
const MAX_CLIP_MS = 10_500;

type Row = {
  id: string;
  name: string;
  /** checking → (held: the pot is short, nothing sent) | waiting → working → done | refused */
  state: 'checking' | 'held' | 'waiting' | 'working' | 'done' | 'refused';
  /** 0–100, from the PUT itself — never invented. */
  pct?: number;
  detail?: string;
};

/** A file that passed the checks, with what it will cost. */
type Ready = { id: string; file: File; cost: PickedCost; probe: { durationMs: number; poster: Blob } | null };

function ext(type: string): string {
  if (type.includes('png')) return 'png';
  if (type.includes('webm')) return 'webm';
  if (type.includes('quicktime') || type.includes('mov')) return 'mov';
  if (type.includes('mp4')) return 'mp4';
  return 'jpg';
}

/** Measure a video and grab its first frame. Null if the browser cannot decode it. */
async function probeVideo(
  file: File,
): Promise<{ durationMs: number; poster: Blob } | null> {
  const url = URL.createObjectURL(file);
  try {
    const v = document.createElement('video');
    v.preload = 'metadata';
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    await new Promise<void>((resolve, reject) => {
      v.onloadeddata = () => resolve();
      v.onerror = () => reject(new Error('decode'));
      setTimeout(() => reject(new Error('timeout')), 15_000);
    });
    const durationMs = Number.isFinite(v.duration) ? Math.round(v.duration * 1000) : NaN;
    if (!Number.isFinite(durationMs)) return null;
    // Seek a hair in: frame 0 is often black on a phone recording.
    v.currentTime = Math.min(0.1, Math.max(0, v.duration / 10));
    await new Promise<void>((resolve) => {
      v.onseeked = () => resolve();
      setTimeout(resolve, 2000);
    });
    const canvas = document.createElement('canvas');
    canvas.width = v.videoWidth;
    canvas.height = v.videoHeight;
    if (!canvas.width || !canvas.height) return null;
    canvas.getContext('2d')?.drawImage(v, 0, 0, canvas.width, canvas.height);
    const poster = await new Promise<Blob | null>((r) =>
      canvas.toBlob((b) => r(b), 'image/jpeg', 0.85),
    );
    if (!poster) return null;
    return { durationMs, poster };
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function AddToLibrary({
  token,
  pot: potAtOpen,
  buy = null,
}: {
  token: string;
  /**
   * Credits this camera can still spend — the presign gate's own read (`papic_capture_points_available`), or
   * 'unmetered' (the Papic Unlock pass), or null when it could not be read (said as "Couldn't check", never 0).
   */
  pot: UploadPot;
  /** The shipped Add more door (`PapicBuySheet`, or Apple's in the app) — offered when the pot is short. */
  buy?: ReactNode;
}) {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);
  const [pot, setPot] = useState<UploadPot>(potAtOpen);
  // The page re-read the pot (after a pick lands, `router.refresh()`): the server's number replaces the local count.
  useEffect(() => setPot(potAtOpen), [potAtOpen]);
  const [short, setShort] = useState<Extract<CoverVerdict, { ok: false }> | null>(null);
  const [landed, setLanded] = useState(0);
  /** A file was refused because the pot ran dry mid-pick (a second tab, a guest camera spending at the same time). */
  const [ranDry, setRanDry] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const patch = useCallback((id: string, next: Partial<Row>) => {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...next } : r)));
  }, []);

  /** Sign + PUT one blob through the shared sender; the stored r2:// ref, or the words for why not. */
  const send = useCallback(
    async (
      blob: Blob,
      contentType: string,
      e: string,
      onProgress?: (pct: number) => void,
    ): Promise<{ ok: true; ref: string } | { ok: false; why: string; code: string | null }> => {
      const { sendToStorage } = await import('@/lib/upload-send');
      // A neutral name, as before: the picked file's own name never reaches the object key.
      const file = new File([blob], `upload-${Date.now()}.${e}`, { type: contentType });
      const run = sendToStorage(
        { file, contentType, papicSeatToken: token },
        { stallMs: UPLOAD_STALL_MS, responseMs: UPLOAD_RESPONSE_MS, onProgress },
      );
      const out = await run.done;
      return out.ok ? { ok: true, ref: out.r2Ref } : { ok: false, why: whyNot(out), code: out.code ?? null };
    },
    [token],
  );

  /** Record through the shared capture path — with a clock, so a reply that never comes is said. */
  const record = useCallback(
    async (ref: string, kind: 'photo' | 'clip', posterRef?: string, durationMs?: number) => {
      let timer: ReturnType<typeof setTimeout> | undefined;
      const stalled = new Promise<{ ok: false; error: string }>((resolve) => {
        timer = setTimeout(() => resolve({ ok: false, error: 'record_stalled' }), RECORD_STALL_MS);
      });
      try {
        return await Promise.race([recordSeatCapture(token, ref, kind, posterRef, durationMs), stalled]);
      } catch {
        return { ok: false as const, error: 'record_failed' };
      } finally {
        clearTimeout(timer);
      }
    },
    [token],
  );

  const onPick = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const stamp = Date.now();
      const picked = Array.from(files).map((file, i) => ({ file, id: `${stamp}-${i}` }));
      setRows(picked.map(({ file, id }) => ({ id, name: file.name, state: 'checking' as const })));
      setShort(null);
      setLanded(0);
      setRanDry(false);
      setBusy(true);

      // ── 1 · READ EVERY FILE FIRST — its kind, its size, a clip's length and poster — so the WHOLE pick is priced
      //        before a single credit is reserved. Keyed on the row id, never the filename (two cameras' IMG_0001).
      const ready: Ready[] = [];
      for (const { file, id } of picked) {
        const isVideo = file.type.startsWith('video/');
        if (!isVideo && !file.type.startsWith('image/')) {
          patch(id, { state: 'refused', detail: 'Only photos and snippets can go in your Memories.' });
          continue;
        }
        const cap = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
        if (file.size > cap) {
          patch(id, {
            state: 'refused',
            detail: `Too large — ${isVideo ? 'snippets' : 'photos'} can be up to ${Math.round(cap / 1024 / 1024)} MB.`,
          });
          continue;
        }
        if (!isVideo) {
          ready.push({ id, file, cost: { kind: 'photo' }, probe: null });
          continue;
        }
        const probe = await probeVideo(file);
        if (!probe) {
          patch(id, { state: 'refused', detail: 'This snippet could not be read in your browser — try converting it first.' });
          continue;
        }
        if (probe.durationMs > MAX_CLIP_MS) {
          patch(id, {
            state: 'refused',
            detail: `This snippet is ${Math.round(probe.durationMs / 1000)} seconds — snippets are 10 seconds or less.`,
          });
          continue;
        }
        ready.push({ id, file, cost: { kind: 'clip', durationMs: probe.durationMs }, probe });
      }

      // ── 2 · CAN THE POT COVER IT? Priced by the server's own function (`selectionCost` → `papicCaptureCost`). Short
      //        means NOTHING is sent: say so here, with Add more, rather than let file 7 of 12 be refused mid-way.
      const verdict = coverVerdict(selectionCost(ready.map((r) => r.cost)), pot);
      if (!verdict.ok) {
        for (const r of ready) patch(r.id, { state: 'held' });
        setShort(verdict);
        setBusy(false);
        if (inputRef.current) inputRef.current.value = '';
        return;
      }
      for (const r of ready) patch(r.id, { state: 'waiting' });

      // ── 3 · ONE AT A TIME, DELIBERATELY. The per-camera burst limiter exists to stop a stuck loop emptying the pot,
      //        and twenty simultaneous presigns are indistinguishable from one. Serial also means a refusal is visible
      //        before the next file spends anything.
      let added = 0;
      for (const r of ready) {
        const set = (next: Partial<Row>) => patch(r.id, next);
        const refuse = (detail: string, code: string | null) => {
          set({ state: 'refused', detail });
          if (code && EXHAUSTED.has(code)) setRanDry(true);
        };
        set({ state: 'working', pct: 0 });
        const progress = (pct: number) => set({ pct });
        try {
          let res: { ok: true } | { ok: false; error: string };
          if (r.probe) {
            // The poster goes up FIRST: a clip whose poster failed would be recorded unscreenable, and unscreened
            // media is excluded from every guest surface silently and forever.
            const poster = await send(r.probe.poster, 'image/jpeg', 'jpg');
            if (!poster.ok) {
              refuse(poster.why, poster.code);
              continue;
            }
            const clip = await send(r.file, r.file.type, ext(r.file.type), progress);
            if (!clip.ok) {
              refuse(clip.why, clip.code);
              continue;
            }
            res = await record(clip.ref, 'clip', poster.ref, r.probe.durationMs);
          } else {
            const photo = await send(r.file, r.file.type, ext(r.file.type), progress);
            if (!photo.ok) {
              refuse(photo.why, photo.code);
              continue;
            }
            res = await record(photo.ref, 'photo');
          }
          if (!res.ok) {
            refuse(readable(res.error), res.error);
            continue;
          }
          added += 1;
          set({ state: 'done', pct: 100 });
          // What it spent comes off the count on screen at once; the page re-reads the real pot below.
          setPot((p) => (typeof p === 'number' ? Math.max(0, p - selectionCost([r.cost])) : p));
        } catch (e) {
          set({ state: 'refused', detail: readable(e instanceof Error ? e.message : undefined) });
        }
      }

      setBusy(false);
      setLanded(added);
      if (inputRef.current) inputRef.current.value = '';
      // 🔁 THE NEW PHOTOS REACH THE GRID WITHOUT A RELOAD — the server page re-reads Memories (and the pot).
      // one-render: keep (no-revalidate) — recordSeatCapture and the presigned PUT revalidate nothing, so only this re-reads the grid.
      if (added > 0) router.refresh();
    },
    [send, record, patch, pot, router],
  );

  return (
    <div className="space-y-3" data-add-photos="">
      {/* The credits, and one short line — everything else in the ⓘ (house rule). */}
      <div>
        <InfoTip
          label={potWords(pot)}
          labelAs="h3"
          labelClassName="text-[15px] font-semibold text-ink"
          align="start"
        >
          {costInfoLine()} Older memories are welcome — the engagement shoot, childhood photos, the proposal clip. Credits
          come from your event&rsquo;s one pot, the same your cameras use.
        </InfoTip>
        <p className="mt-0.5 text-sm text-ink/65" data-add-photos-pot={typeof pot === 'number' ? pot : String(pot)}>
          From your phone or laptop — older memories too.
        </p>
      </div>

      {pot === 0 && buy && !short && !ranDry ? <div data-add-photos-buy="empty">{buy}</div> : null}

      <label className="flex min-h-[44px] cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-ink/20 bg-cream/50 px-4 py-8 text-center hover:border-ink/35 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-terracotta/50">
        <Upload aria-hidden className="h-5 w-5 text-ink/45" strokeWidth={1.75} />
        <span className="text-sm font-medium text-ink">{busy ? 'Adding…' : 'Choose photos or snippets'}</span>
        <span className="text-xs text-ink/55">Snippets up to 10 seconds</span>
        <input
          ref={inputRef}
          type="file"
          multiple
          accept="image/*,video/*"
          className="sr-only"
          disabled={busy}
          onChange={(e) => void onPick(e.target.files)}
        />
      </label>

      {short ? (
        <div role="alert" className="space-y-2" data-add-photos-short={short.short}>
          <p className="text-sm text-ink">
            These need {creditsCount(short.cost)} — you have {creditsCount(short.left)}. Nothing was uploaded.
          </p>
          {buy ? <div data-add-photos-buy="short">{buy}</div> : <p className="text-sm text-ink/65">Add more from your event&rsquo;s Home.</p>}
        </div>
      ) : null}

      {ranDry && !short ? (
        <div className="space-y-2" data-add-photos-ran-dry="">
          {buy ? <div data-add-photos-buy="ran-dry">{buy}</div> : <p className="text-sm text-ink/65">Add more from your event&rsquo;s Home.</p>}
        </div>
      ) : null}

      {landed > 0 && !busy ? (
        <p role="status" className="text-sm text-success-700" data-add-photos-landed={landed}>
          {landed === 1 ? '1 added to your Memories.' : `${landed} added to your Memories.`}
        </p>
      ) : null}

      {rows.length > 0 ? (
        <ul className="space-y-1.5" aria-live="polite">
          {rows.map((r) => (
            <li key={r.id} className="flex items-start gap-2 text-xs" data-add-photos-row={r.state}>
              {r.state === 'done' ? (
                <Check aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success-700" strokeWidth={2} />
              ) : r.state === 'refused' ? (
                <AlertCircle aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 text-danger-700" strokeWidth={2} />
              ) : r.state === 'held' ? (
                <span aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded-full border border-ink/25" />
              ) : (
                <Loader2 aria-hidden className="mt-0.5 h-3.5 w-3.5 shrink-0 animate-spin text-ink/40" strokeWidth={2} />
              )}
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline gap-2">
                  <span className="min-w-0 flex-1 truncate text-ink/80">{r.name}</span>
                  {r.state === 'working' && typeof r.pct === 'number' ? (
                    <span className="shrink-0 tabular-nums text-ink/55">{r.pct}%</span>
                  ) : null}
                </span>
                {r.detail ? <span className="block text-ink/55">{r.detail}</span> : null}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

/** The credits line: what this camera can still spend, or why it is not a number. */
function potWords(pot: UploadPot): string {
  if (pot === 'unmetered') return 'Your pass covers these';
  if (pot === null) return 'Couldn’t check your credits';
  return `${creditsCount(pot)} left`;
}

/**
 * Why a file did not reach storage — in words a person can act on. A refusal the SIGNER explained keeps its code
 * (`camera_points_exhausted`, `uploads_closed`, the window…), so it reads the same as one the record step returns.
 */
function whyNot(out: Extract<UploadOutcome, { ok: false }>): string {
  if (out.kind === 'stalled') return 'It stopped uploading — check your connection and pick it again.';
  if (out.kind === 'cancelled') return 'Stopped.';
  if (out.step === 'presign' && out.kind === 'refused') {
    if (out.code) return readable(out.code);
    if (out.status === 403) return 'This upload door isn’t yours any more — close this and open Add photos again.';
    if (out.says && out.status !== null && out.status >= 400 && out.status < 500) return out.says;
    // Our side, not their connection: nothing was reserved (the presign refuses before any credit moves).
    if (out.status !== null && out.status >= 500) return 'Uploads aren’t working on our side right now — nothing was used. Try again in a few minutes.';
  }
  if (out.step === 'put' && out.kind === 'refused') return `Storage refused it (status ${out.status}). Try again in a moment.`;
  return readable('upload_failed');
}

/**
 * A refusal in words a person can act on.
 *
 * ⚠ EVERY BRANCH NAMES SOMETHING THE READER CAN DO. "out_of_points" as-is sends
 * somebody to support; "you're out of credits" sends them to the ladder two
 * cards down. A refusal that misdescribes itself sends people to fix the wrong
 * thing — the same failure the supplier camera's "Photos only on Papic Lite"
 * hint made when video moved onto the allowance.
 */
/** Every code that means "the pot cannot pay" — the presign's and the record's (both say `camera_points_exhausted`). */
const EXHAUSTED: ReadonlySet<string> = new Set(['camera_points_exhausted', 'out_of_points', 'pool_exhausted']);

function readable(code: string | undefined | null): string {
  switch (code) {
    // ⚠ `camera_points_exhausted` IS THE CODE BOTH SEAMS ACTUALLY RETURN (`/api/upload`'s 409, `recordSeatCapture`).
    // Until 2026-10-25 only the two below were listed — neither is ever sent on this path — so a couple out of credits
    // was told "Try again in a moment", which no retry can fix.
    case 'camera_points_exhausted':
    case 'out_of_points':
    case 'pool_exhausted':
      return 'You’re out of credits — Add more, then pick it again.';
    case 'camera_points_unavailable':
    case 'unavailable':
      return 'We couldn’t check your credits just now — try again in a moment.';
    case 'awaiting_payment':
      return 'This camera turns on once your payment is confirmed.';
    case 'event_put_away':
      return 'This event has been put away, so nothing new can be added.';
    case 'revoked':
    case 'not_your_seat':
      return 'This upload door was reset — close this and open Add photos again.';
    // The upload reached storage; only the save did not answer. It may still land — re-picking could pay twice.
    case 'record_stalled':
      return 'It uploaded, but saving it didn’t answer — check your Memories in a minute before trying again.';
    case 'capture_not_started':
      return 'Your camera dates haven’t started yet.';
    case 'capture_window_closed':
      return 'Your camera dates have finished.';
    case 'clip_too_long':
      return 'That snippet is longer than 10 seconds.';
    // The switch is now read on the SERVER too, so this refusal is reachable —
    // a stale page, a second tab, or a call that never went near the button. It
    // names the control, which is on this same screen.
    case 'uploads_closed':
      return 'Adding photos by hand is switched off — turn it on in Memories settings.';
    case 'too_fast':
      return 'Slow down a moment and try that one again.';
    case 'unauthenticated':
      return 'You’ve been signed out — sign in and try again.';
    case 'upload_failed':
    case 'upload_refused':
      return 'That file didn’t upload — check your connection and try again.';
    default:
      return 'That one didn’t go in. Try again in a moment.';
  }
}
