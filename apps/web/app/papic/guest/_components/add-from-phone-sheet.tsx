'use client';

/**
 * 📲 ADD FROM YOUR PHONE — a guest adds photos and snippets they took on the event day from their own phone's gallery.
 *
 * Guest upload v2, approved 13 Nov 2026 (specs `prototypes/guest_phone_uploads_2026-11-13/`, DECISION_LOG "GUESTS CAN
 * ADD PHOTOS FROM THEIR PHONE" + "TAP TO CHOOSE · VIDEO 3–10 SECONDS, TRIMMED"); the four rulings of 14 Nov (#7607):
 * the couple's credits run out → the guest sees "Out of Credits" · no taken-date → not allowed · video trimmed on the
 * phone, 10 s max · "After I check" photos left unchecked stay out, not refunded.
 *
 *   Choose photos → the phone's picker (any number) → each file's taken-date is read ON THE PHONE → only the event
 *   day's go, every one a tap target (tap to leave it out) → a video over 10 s opens a trim (3–10 s, only that part is
 *   cut and sent) → Add N.
 *
 * 🔑 NOT A NEW UPLOAD PATH. Each file becomes a shot in the guest camera's own queue (`saveShot`, lib/papic-upload/) —
 * the same save-first phone queue, the same guest-capture route, the same screen, the same derivatives — marked
 * `source: 'phone'`, which makes the ROUTE charge the upload price (`papicCaptureCost(…, 'upload')`) and hold the
 * taken-date to the event day. The prices shown here come from that same function; none is typed.
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Check, ImagePlus, Loader2, Scissors, X } from 'lucide-react';
import { Sheet } from '@/app/_components/sheet';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { countNoun, formatCount } from '@/lib/format-number';
import { papicCaptureCost } from '@/lib/papic-cameras-pure';
import { newClientCaptureId } from '@/lib/papic-client-capture-id';
import { saveShot } from '@/lib/papic-upload/browser';
import { trimClipOnPhone } from '@/lib/video-compress';
import type { PapicMark } from '@/lib/papic-photo-mark';
import {
  PHONE_CLIP_MAX_MS,
  PHONE_CLIP_MIN_MS,
  PHONE_UPLOAD_SOURCE,
  phoneClipBilledMs,
  phoneSelectionCost,
  pickVerdict,
  type EventDays,
  type PickVerdict,
  type TakenAt,
} from '@/lib/papic-phone-uploads';
import { isClipFile, probeClip, readTakenAt } from '@/lib/papic-phone-uploads-browser';

/** What the sheet reads before it opens (GET /api/papic/phone-uploads). */
type Config = { open: boolean; held: boolean; days: EventDays | null; daysWords: string | null; hosts: string | null };

type Item = {
  key: string;
  file: File;
  kind: 'photo' | 'clip';
  taken: TakenAt | null;
  verdict: PickVerdict;
  durationMs: number | null;
  thumbUrl: string | null;
  /** Tapped off by the guest (only an eligible file can be). */
  off: boolean;
  /** A long clip's chosen part, in whole seconds. */
  cut: { start: number; len: number } | null;
};

type Phase = 'loading' | 'unread' | 'closed' | 'idle' | 'checking' | 'checked' | 'sending' | 'done' | 'out';

const MIN_S = PHONE_CLIP_MIN_MS / 1000;
const MAX_S = PHONE_CLIP_MAX_MS / 1000;

const mmss = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const credits = (n: number) => countNoun(n, 'credit', 'credits');

export type PhoneShotAdded = { id: string; url: string; media: 'photo' | 'clip'; durationMs?: number | null; note: string };

export function AddFromPhoneSheet({
  open,
  onClose,
  eventId,
  uploadOwner,
  mark,
  creditsLeft,
  poolEmpty,
  onAdded,
}: {
  open: boolean;
  onClose: () => void;
  eventId: string;
  /** The camera's owner tag — every shot carries it (lib/papic-upload/owner-tag). */
  uploadOwner: string | null;
  /** The mark burned into the copies the phone makes (the camera's own). */
  mark: PapicMark | null;
  /** What this guest may still spend of the couple's credits, when a per-guest limit binds; null = none binds. */
  creditsLeft: number | null;
  /** The couple's pot is empty right now. */
  poolEmpty: boolean;
  /** Each shot handed to the queue — so the camera's My shots shows it at once. */
  onAdded?: (shot: PhoneShotAdded) => void;
}) {
  const [config, setConfig] = useState<Config | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [items, setItems] = useState<Item[]>([]);
  const [trimming, setTrimming] = useState<string | null>(null);
  const [sent, setSent] = useState({ done: 0, of: 0, failed: 0 });
  const inputRef = useRef<HTMLInputElement>(null);

  // Read the couple's settings each time the sheet opens — a stale "on" is a door that will refuse.
  useEffect(() => {
    if (!open) return;
    let live = true;
    setPhase('loading');
    void (async () => {
      try {
        const res = await fetch(`/api/papic/phone-uploads?event_id=${encodeURIComponent(eventId)}`, { cache: 'no-store' });
        const body = (await res.json().catch(() => null)) as (Config & { ok?: boolean }) | null;
        if (!live) return;
        if (!res.ok || !body?.ok) return setPhase('unread');
        setConfig(body);
        setPhase(!body.open || !body.days ? 'closed' : poolEmpty ? 'out' : 'idle');
      } catch {
        if (live) setPhase('unread');
      }
    })();
    return () => {
      live = false;
    };
  }, [open, eventId, poolEmpty]);

  const reset = useCallback(() => {
    setItems((prev) => {
      prev.forEach((it) => it.thumbUrl && URL.revokeObjectURL(it.thumbUrl));
      return [];
    });
    setTrimming(null);
    setSent({ done: 0, of: 0, failed: 0 });
  }, []);

  const close = useCallback(() => {
    if (phase === 'sending') return; // the queue is being filled — never cut it off half-way
    reset();
    onClose();
  }, [phase, reset, onClose]);

  const hosts = config?.hosts?.trim() || 'the hosts';
  const day = config?.daysWords ?? 'the day';

  const onPicked = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0 || !config?.days) return;
      const days = config.days;
      setPhase('checking');
      const list = Array.from(files);
      const read: Item[] = [];
      for (const [i, file] of list.entries()) {
        const kind = isClipFile(file) ? 'clip' : 'photo';
        const taken = await readTakenAt(file);
        let durationMs: number | null = null;
        let thumbUrl: string | null = null;
        if (kind === 'clip') {
          const probe = await probeClip(file);
          durationMs = probe?.durationMs ?? null;
          thumbUrl = probe ? URL.createObjectURL(probe.poster) : null;
        } else {
          thumbUrl = URL.createObjectURL(file);
        }
        read.push({
          key: `${i}-${file.name}-${file.size}`,
          file,
          kind,
          taken,
          verdict: pickVerdict({ kind, taken, days, durationMs }),
          durationMs,
          thumbUrl,
          off: false,
          cut: null,
        });
      }
      setItems(read);
      setPhase('checked');
    },
    [config],
  );

  const eligible = items.filter((it) => it.verdict.go);
  const going = eligible.filter((it) => !it.off && (!(it.verdict.go && it.verdict.trim) || it.cut));
  const needTrim = eligible.filter((it) => !it.off && it.verdict.go && it.verdict.trim && !it.cut);
  const cost = useMemo(
    () => phoneSelectionCost(going.map((it) => ({ kind: it.kind, durationMs: it.cut ? it.cut.len * 1000 : it.durationMs }))),
    [going],
  );
  const count = (why: 'no_date' | 'other_day' | 'too_short' | 'unreadable') =>
    items.filter((it) => !it.verdict.go && it.verdict.why === why).length;

  const send = useCallback(async () => {
    if (going.length === 0) return;
    // Out of Credits is said BEFORE anything is sent — nothing is half-added (ruling 1, 14 Nov).
    if (creditsLeft !== null && cost > creditsLeft) return setPhase('out');
    setPhase('sending');
    setSent({ done: 0, of: going.length, failed: 0 });
    let failed = 0;
    for (const it of going) {
      try {
        const id = newClientCaptureId();
        const capturedAtMs = it.taken!.atMs;
        const note = config?.held ? `with ${hosts}` : 'from your phone';
        if (it.kind === 'photo') {
          await saveShot({ id, lane: 'guest', eventId, media: 'photo', capturedAtMs, primary: it.file, ownerTag: uploadOwner, mark, source: PHONE_UPLOAD_SOURCE });
          onAdded?.({ id, url: URL.createObjectURL(it.file), media: 'photo', note });
        } else {
          // ✂ Cut ON THE PHONE (ruling 3): only the chosen part — or the whole of a 3–10 s clip, made the camera's web
          // size with its location stripped — is ever sent. A phone that cannot cut sends nothing for this one.
          const startS = it.cut?.start ?? 0;
          const lenS = it.cut?.len ?? Math.min(MAX_S, (it.durationMs ?? 0) / 1000);
          const clip = await trimClipOnPhone(it.file, startS, lenS);
          const probe = clip ? await probeClip(clip) : null;
          if (!clip || !probe) throw new Error('trim');
          const durationMs = phoneClipBilledMs(probe.durationMs);
          await saveShot({
            id,
            lane: 'guest',
            eventId,
            media: 'clip',
            capturedAtMs,
            durationMs,
            primary: clip,
            poster: probe.poster,
            ownerTag: uploadOwner,
            mark,
            source: PHONE_UPLOAD_SOURCE,
          });
          onAdded?.({ id, url: URL.createObjectURL(probe.poster), media: 'clip', durationMs, note });
        }
      } catch {
        failed += 1;
      }
      setSent((s) => ({ ...s, done: s.done + 1, failed }));
    }
    setPhase('done');
  }, [going, creditsLeft, cost, config?.held, hosts, eventId, uploadOwner, mark, onAdded]);

  const trimItem = items.find((it) => it.key === trimming) ?? null;

  const head = (
    <div className="space-y-1">
      <p className="text-[14px] text-ink/70" data-phone-upload-cost="">
        {credits(papicCaptureCost('photo', null, 'upload'))} a photo, from {hosts}’s Papic credits
      </p>
      <InfoTip label={`Only photos taken on ${day}`} labelClassName="text-[13px] text-ink/60" align="start">
        Your phone’s picker can’t pick by day, so choose freely — the date each photo was taken is read on your phone
        and only the ones from {day} go in. Screenshots and photos sent over chat carry no date, so they can’t go. A
        video goes up at {MIN_S} to {MAX_S} seconds — trim a longer one; one under {MIN_S} seconds can’t go. Tap a
        photo to leave it out. {config?.held ? `${hosts} check them before they show.` : 'They show in the event’s Memories right away.'}{' '}
        Each one uses {hosts}’s credits — a snippet by its length, the same as one they add themselves — and a
        photo that is not used is never charged.
      </InfoTip>
    </div>
  );

  let body: React.ReactNode = null;
  let foot: React.ReactNode = null;

  if (phase === 'loading') {
    body = (
      <p className="flex items-center gap-2 py-6 text-[14px] text-ink/60" role="status">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Checking…
      </p>
    );
  } else if (phase === 'unread') {
    body = <p className="py-6 text-[14px] text-ink/70" role="alert">Couldn’t check this event just now. Close this and try again in a moment.</p>;
  } else if (phase === 'closed') {
    body = <p className="py-6 text-[14px] text-ink/70">{hosts} aren’t taking photos from phones for this event.</p>;
  } else if (phase === 'out') {
    // RULING 1 (14 Nov): when the couple's credits run out the guest sees "Out of Credits".
    body = (
      <div className="space-y-2 py-4" data-phone-upload-out="" role="alert">
        <p className="text-[20px] font-semibold text-ink">Out of Credits</p>
        <p className="text-[14px] text-ink/70">{hosts}’s Papic credits have run out, so nothing can be added right now. Nothing was sent.</p>
      </div>
    );
    foot = <ActionButton tone="neutral" icon={X} label="Not now" onClick={close} />;
  } else if (phase === 'idle' || phase === 'checking') {
    body = (
      <div className="space-y-3 pt-2">
        {head}
        <input
          ref={inputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(e) => {
            void onPicked(e.target.files);
            e.target.value = '';
          }}
        />
        <ActionButton
          tone="brand"
          main
          icon={phase === 'checking' ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : ImagePlus}
          label={phase === 'checking' ? 'Reading when each was taken…' : 'Choose photos'}
          waiting={phase === 'checking'}
          onClick={() => inputRef.current?.click()}
        />
        {phase === 'checking' ? <p className="text-[13px] text-ink/60">Nothing is sent yet.</p> : null}
      </div>
    );
  } else if (phase === 'checked' && trimItem) {
    body = (
      <TrimView
        item={trimItem}
        onCancel={() => setTrimming(null)}
        onUse={(cut) => {
          setItems((prev) => prev.map((it) => (it.key === trimItem.key ? { ...it, cut } : it)));
          setTrimming(null);
        }}
      />
    );
  } else if (phase === 'checked') {
    const shortN = count('too_short');
    const otherN = count('other_day');
    const noDateN = count('no_date');
    const badN = count('unreadable');
    body = (
      <div className="space-y-3 pt-2">
        {head}
        <p className="text-[16px] font-semibold text-ink" data-phone-upload-tally="">
          {formatCount(going.length)} of {formatCount(eligible.length)} picked · {credits(cost)}
        </p>
        {needTrim.map((it) => (
          <div key={it.key} className="flex flex-wrap items-center gap-2">
            <span className="min-w-0 flex-1 text-[14px] text-ink">
              {it.file.name} is {formatCount(Math.round((it.durationMs ?? 0) / 1000))} seconds — trim it to {MIN_S}–{MAX_S} seconds to send it.
            </span>
            <ActionButton tone="brand" icon={Scissors} label="Trim" onClick={() => setTrimming(it.key)} />
          </div>
        ))}
        {shortN ? <p className="text-[13.5px] text-warn-800">{countNoun(shortN, 'video is', 'videos are')} under {MIN_S} seconds — left out.</p> : null}
        {otherN ? <p className="text-[13.5px] text-warn-800">{formatCount(otherN)} {otherN === 1 ? 'wasn’t' : 'weren’t'} taken on {day} — left out.</p> : null}
        {noDateN ? <p className="text-[13.5px] text-warn-800">{formatCount(noDateN)} {noDateN === 1 ? 'has' : 'have'} no date — left out.</p> : null}
        {badN ? <p className="text-[13.5px] text-warn-800">{countNoun(badN, 'video', 'videos')} couldn’t be read on this phone — left out.</p> : null}
        <ul className="grid grid-cols-3 gap-1.5" aria-label="Your picks">
          {items.map((it) => {
            const can = it.verdict.go;
            const on = can && !it.off;
            const when = it.taken
              ? new Date(it.taken.atMs).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Manila' })
              : 'no date';
            const len = it.kind === 'clip' ? (it.cut ? mmss(it.cut.len) : it.durationMs ? mmss(Math.round(it.durationMs / 1000)) : null) : null;
            return (
              <li key={it.key} className="aspect-square">
                <button
                  type="button"
                  disabled={!can}
                  aria-pressed={can ? on : undefined}
                  aria-label={`${it.file.name}${on ? ' — going up' : can ? ' — left out' : ' — can’t go'}`}
                  onClick={() => setItems((prev) => prev.map((p) => (p.key === it.key ? { ...p, off: !p.off } : p)))}
                  className={`relative block h-full w-full overflow-hidden rounded-lg bg-ink/10 ${on ? 'ring-2 ring-mulberry-600' : ''} ${!can ? 'opacity-40 grayscale' : it.off ? 'opacity-55' : ''}`}
                  data-phone-pick={on ? 'on' : can ? 'off' : 'out'}
                >
                  {it.thumbUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={it.thumbUrl} alt="" className="h-full w-full object-cover" />
                  ) : null}
                  <span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-px text-[10px] text-white">{when}</span>
                  {len ? <span className="absolute bottom-1 right-1 rounded bg-black/55 px-1 py-px text-[10px] font-semibold text-white">{len}</span> : null}
                  {can ? (
                    <span className={`absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full ${on ? 'bg-mulberry-600 text-white' : 'border border-white/80 bg-black/30 text-transparent'}`}>
                      <Check aria-hidden className="h-3 w-3" strokeWidth={3} />
                    </span>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    );
    foot = (
      <div className="flex gap-2">
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={() => { reset(); setPhase('idle'); }} />
        <ActionButton tone="brand" main icon={Check} label={`Add ${formatCount(going.length)}`} disabled={going.length === 0} onClick={() => void send()} />
      </div>
    );
  } else if (phase === 'sending') {
    body = (
      <p className="flex items-center gap-2 py-6 text-[15px] text-ink" role="status">
        <Loader2 aria-hidden className="h-4 w-4 animate-spin" /> Adding… {formatCount(Math.min(sent.done + 1, sent.of))} of {formatCount(sent.of)}
      </p>
    );
  } else if (phase === 'done') {
    const ok = sent.of - sent.failed;
    body = (
      <div className="space-y-2 py-4" role="status" data-phone-upload-done="">
        <p className="text-[15px] font-semibold text-ink">{formatCount(ok)} added to {hosts}’s Memories.</p>
        <p className="text-[14px] text-ink/70">
          {config?.held ? `${hosts} will check them before they show.` : 'They show in the event’s Memories as each one sends.'}
        </p>
        {sent.failed ? <p className="text-[14px] text-danger-700">{countNoun(sent.failed, 'video', 'videos')} couldn’t be cut on this phone — not sent.</p> : null}
      </div>
    );
    foot = <ActionButton tone="brand" main icon={Check} label="Done" onClick={close} />;
  }

  return (
    <Sheet
      open={open}
      onClose={close}
      labelledById="add-from-phone-title"
      title={phase === 'checked' && trimItem ? 'Trim your video' : 'Add from your phone'}
      foot={foot ? <div className="border-t border-ink/10 px-5 py-3">{foot}</div> : undefined}
    >
      <h2 id="add-from-phone-title" className="sr-only">
        Add from your phone
      </h2>
      <div data-add-from-phone={phase} className="px-5 pb-4">{body}</div>
    </Sheet>
  );
}

/** ✂ The trim — start and length (3–10 s), previewed on the phone. Only this part is cut and sent. */
function TrimView({
  item,
  onCancel,
  onUse,
}: {
  item: Item;
  onCancel: () => void;
  onUse: (cut: { start: number; len: number }) => void;
}) {
  const total = Math.max(MIN_S, Math.floor((item.durationMs ?? 0) / 1000));
  const [len, setLen] = useState(item.cut?.len ?? Math.min(MAX_S, total));
  const [start, setStart] = useState(item.cut?.start ?? 0);
  const st = Math.min(start, Math.max(0, total - len));
  const videoRef = useRef<HTMLVideoElement>(null);
  const url = useMemo(() => URL.createObjectURL(item.file), [item.file]);
  useEffect(() => () => URL.revokeObjectURL(url), [url]);
  useEffect(() => {
    if (videoRef.current) videoRef.current.currentTime = st;
  }, [st]);

  return (
    <div className="space-y-3 pt-2" data-phone-trim="">
      <p className="text-[14px] text-ink/70">
        {item.file.name} is {formatCount(total)} seconds. Keep {MIN_S} to {MAX_S} seconds of it.
      </p>
      <div className="relative overflow-hidden rounded-xl bg-black">
        <video ref={videoRef} src={url} muted playsInline preload="metadata" className="aspect-video w-full object-contain" />
        <span className="absolute bottom-2 left-2 rounded bg-black/55 px-1.5 py-0.5 font-mono text-[11px] text-white">
          ▶ {mmss(st)} – {mmss(st + len)} · {formatCount(len)} s
        </span>
      </div>
      <label className="block text-[13px] text-ink/70">
        Starts at {mmss(st)}
        <input
          type="range"
          min={0}
          max={Math.max(0, total - len)}
          step={1}
          value={st}
          onChange={(e) => setStart(Number(e.target.value))}
          className="mt-1 block min-h-11 w-full accent-mulberry-600"
        />
      </label>
      <label className="block text-[13px] text-ink/70">
        Length · {formatCount(len)} seconds
        <input
          type="range"
          min={MIN_S}
          max={Math.min(MAX_S, total)}
          step={1}
          value={len}
          onChange={(e) => setLen(Number(e.target.value))}
          className="mt-1 block min-h-11 w-full accent-mulberry-600"
        />
      </label>
      <p className="text-[13px] text-ink/60">Only these {formatCount(len)} seconds are sent — the rest stays on your phone.</p>
      <div className="flex gap-2">
        <ActionButton tone="neutral" icon={X} label="Cancel" onClick={onCancel} />
        <ActionButton tone="brand" main icon={Check} label={`Use these ${formatCount(len)} seconds`} onClick={() => onUse({ start: st, len })} />
      </div>
    </div>
  );
}
