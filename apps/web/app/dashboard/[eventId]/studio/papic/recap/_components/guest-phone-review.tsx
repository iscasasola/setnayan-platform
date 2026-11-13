'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Check, Globe, Loader2, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { Sheet } from '@/app/_components/sheet';
import { InfoTip } from '@/app/_components/info-tip';
import { SubmitButton } from '@/app/_components/submit-button';
import { formatCount } from '@/lib/format-number';
import type { WaitingPhoneUpload } from '@/lib/papic-phone-uploads.server';

/**
 * 📲 FROM YOUR GUESTS' PHONES — the couple's check, on the Recap (guest upload v2, approved 2026-11-13; prototype
 * `guest_phone_uploads_2026-11-13`, state "Couple — review at story publish").
 *
 * Each photo a guest added while the couple chose "After I check" waits here, hidden. Keep → it joins Memories and the
 * Recap; Leave out → it stays out. Owner ruling 4 (14 Nov): unchecked photos stay out of the Recap and their credits
 * are NOT refunded — a kept photo costs nothing more, a left-out one gets nothing back.
 */
export function GuestPhoneReview({ eventId, waiting }: { eventId: string; waiting: WaitingPhoneUpload[] }) {
  const router = useRouter();
  const [decided, setDecided] = useState<Record<string, 'keep' | 'out'>>({});
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const post = async (payload: Record<string, unknown>, key: string) => {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch('/api/papic/phone-uploads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ event_id: eventId, ...payload }),
      });
      const body = (await res.json().catch(() => null)) as { ok?: boolean; decided?: string[]; words?: string } | null;
      if (!res.ok || !body?.ok) {
        setError(body?.words ?? 'Couldn’t save that — try again.');
        return null;
      }
      return body.decided ?? [];
    } catch {
      setError('Couldn’t save that — check your connection and try again.');
      return null;
    } finally {
      setBusy(null);
    }
  };

  const decide = async (id: string, what: 'keep' | 'out') => {
    const done = await post({ op: what === 'keep' ? 'keep' : 'leave_out', ids: [id] }, id);
    if (done) {
      setDecided((d) => ({ ...d, [id]: what }));
      router.refresh();
    }
  };

  const undecided = waiting.filter((w) => !decided[w.captureId]);
  const kept = Object.values(decided).filter((v) => v === 'keep').length;
  const out = Object.values(decided).filter((v) => v === 'out').length;

  return (
    <section className="rounded-2xl border border-ink/10 bg-surface p-5 sm:p-6" data-guest-phone-review="">
      <div className="flex items-baseline justify-between gap-3">
        <InfoTip label="From your guests’ phones" labelClassName="text-base font-semibold text-ink" align="start">
          Photos your guests added from their own phones. You set them to wait for your check. Keep each one, or leave it
          out — kept ones go into your Memories and your Recap. A kept photo uses the credits already spent; nothing
          more. Leaving one out does not refund it.
        </InfoTip>
        <span className="shrink-0 text-[13px] text-ink/60">
          {undecided.length ? `${formatCount(undecided.length)} to check` : 'all checked'}
        </span>
      </div>
      {undecided.length > 0 ? (
        <div className="mt-3">
          <ActionButton
            tone="ok"
            icon={busy === 'all' ? <Loader2 aria-hidden className="animate-spin" strokeWidth={1.9} /> : Check}
            label={busy === 'all' ? 'Keeping all…' : `Keep all ${formatCount(undecided.length)}`}
            waiting={busy === 'all'}
            disabled={busy !== null}
            onClick={async () => {
              const done = await post({ op: 'keep_all' }, 'all');
              if (done) {
                setDecided((d) => ({ ...d, ...Object.fromEntries(done.map((id) => [id, 'keep' as const])) }));
                router.refresh();
              }
            }}
          />
        </div>
      ) : null}
      {error ? (
        <p className="mt-3 text-sm text-danger-700" role="alert">
          {error}
        </p>
      ) : null}
      <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {waiting.map((w) => {
          const d = decided[w.captureId];
          return (
            <li key={w.captureId} className={d === 'out' ? 'opacity-50' : ''} data-phone-review-item={d ?? 'waiting'}>
              <div className="relative aspect-square overflow-hidden rounded-xl bg-ink/10">
                {w.url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={w.url} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : null}
                {w.media === 'clip' && w.durationMs ? (
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/55 px-1.5 py-px text-[10px] font-semibold text-white">
                    0:{String(Math.round(w.durationMs / 1000)).padStart(2, '0')}
                  </span>
                ) : null}
              </div>
              <p className="mt-1.5 truncate text-[13px] text-ink">
                <span className="font-semibold">{w.who}</span> <span className="text-ink/55">{w.at}</span>
              </p>
              <div className="mt-1.5 flex gap-1.5">
                <button
                  type="button"
                  aria-pressed={d === 'keep'}
                  disabled={busy !== null || d !== undefined}
                  onClick={() => void decide(w.captureId, 'keep')}
                  className="min-h-11 flex-1 rounded-full border border-success-700/40 text-[13px] font-semibold text-success-700 aria-pressed:bg-success-700 aria-pressed:text-white"
                >
                  ✓ Keep
                </button>
                <button
                  type="button"
                  aria-pressed={d === 'out'}
                  disabled={busy !== null || d !== undefined}
                  onClick={() => void decide(w.captureId, 'out')}
                  className="min-h-11 flex-1 rounded-full border border-ink/20 text-[13px] font-semibold text-ink/70 aria-pressed:bg-ink aria-pressed:text-cream"
                >
                  × Leave out
                </button>
              </div>
            </li>
          );
        })}
      </ul>
      {kept || out ? (
        <p className="mt-3 text-[13px] text-ink/65">
          <b>{formatCount(kept)}</b> kept · <b>{formatCount(out)}</b> left out · <b>{formatCount(undecided.length)}</b> not checked.
        </p>
      ) : null}
    </section>
  );
}

/**
 * 🌐 PUBLISH, WITH PHOTOS STILL UNCHECKED — the Recap's own publish form, asking once first when guests' phone photos
 * are still waiting (prototype "Before it goes public"). The form, its action and its words are the shipped ones.
 */
export function PublishRecapForm({
  eventId,
  action,
  unchecked,
}: {
  eventId: string;
  action: (fd: FormData) => void | Promise<void>;
  unchecked: number;
}) {
  const [asking, setAsking] = useState(false);
  const formId = `publish-recap-${eventId}`;
  return (
    <>
      <form id={formId} action={action} className="mt-4">
        <input type="hidden" name="eventId" value={eventId} />
        {unchecked > 0 ? (
          <button
            type="button"
            onClick={() => setAsking(true)}
            className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            <Globe aria-hidden className="h-4 w-4" strokeWidth={2} />
            Publish my recap
          </button>
        ) : (
          <SubmitButton
            pendingLabel="Publishing…"
            className="inline-flex items-center gap-2 rounded-md bg-mulberry px-4 py-2.5 text-sm font-medium text-cream hover:bg-mulberry-600"
          >
            <Globe aria-hidden className="h-4 w-4" strokeWidth={2} />
            Publish my recap
          </SubmitButton>
        )}
      </form>
      {asking ? (
        <Sheet open onClose={() => setAsking(false)} title="Before it goes public">
          <p className="text-[15px] text-ink">
            {formatCount(unchecked)} {unchecked === 1 ? 'photo' : 'photos'} from your guests’ phones {unchecked === 1 ? 'is' : 'are'} not checked yet.
          </p>
          <p className="mt-2 text-sm text-ink/65">Unchecked photos stay out of the Recap and out of your Memories until you keep them.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <ActionButton tone="neutral" icon={X} label="Check them first" onClick={() => setAsking(false)} />
            <button
              type="submit"
              form={formId}
              onClick={() => setAsking(false)}
              className="inline-flex min-h-11 items-center gap-2 rounded-md bg-mulberry px-4 text-sm font-medium text-cream hover:bg-mulberry-600"
            >
              <Globe aria-hidden className="h-4 w-4" strokeWidth={2} />
              Publish anyway
            </button>
          </div>
        </Sheet>
      ) : null}
    </>
  );
}
