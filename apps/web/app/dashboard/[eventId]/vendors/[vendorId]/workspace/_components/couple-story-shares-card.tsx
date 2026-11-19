'use client';

/** ✓ The couple's card for a supplier's wrap-up share (Today v3 part 3, frame 5) — Approve all · Hide some ▾. */
import { useActionState, useState } from 'react';
import { eventFilesAction, type EventFilesState } from '@/app/_actions/event-files-actions';
import { InfoTip } from '@/app/_components/info-tip';
import { formatCount } from '@/lib/format-number';

type Photo = { fileId: string; state: 'accepted' | 'waiting' | 'hidden'; url: string };

export function CoupleStorySharesCard({ eventId, vendorProfileId, shopName, photos, silenceDays }: { eventId: string; vendorProfileId: string; shopName: string; photos: Photo[]; silenceDays: number | null }) {
  const [state, act, pending] = useActionState<EventFilesState, FormData>(eventFilesAction, { status: 'idle' });
  const [pick, setPick] = useState<string[]>([]);
  const waiting = photos.filter((p) => p.state === 'waiting').length;
  const common = (
    <>
      <input type="hidden" name="op" value="storydecide" />
      <input type="hidden" name="event_id" value={eventId} />
      <input type="hidden" name="vendor_profile_id" value={vendorProfileId} />
      <input type="hidden" name="return_path" value={`/dashboard/${eventId}`} />
    </>
  );
  return (
    <section data-couple-story-shares="" className="my-3 rounded-[var(--sn-frame-radius)] bg-frame p-3.5 shadow-sn-frame">
      <b className="block text-[15.5px] font-bold text-ink">
        {shopName} shared {formatCount(photos.length)} {photos.length === 1 ? 'photo' : 'photos'}
      </b>
      <span className="block text-[12.5px] text-[color:var(--m-slate-2)]">For your story</span>
      <div className="mt-2 grid grid-cols-4 gap-0.5 overflow-hidden rounded-xl">
        {photos.slice(0, 8).map((p) => (
          <span key={p.fileId} className="relative block aspect-square overflow-hidden bg-ink/[0.05]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={p.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: p.state === 'hidden' ? 0.3 : 1 }} />
          </span>
        ))}
      </div>
      {waiting > 0 ? (
        <form action={act} className="mt-2.5">
          {common}
          <input type="hidden" name="decision" value="approved" />
          <button type="submit" disabled={pending} className="button-primary min-h-12 w-full">
            Approve all
          </button>
        </form>
      ) : null}
      <details className="mt-2">
        <summary className="flex min-h-11 cursor-pointer items-center justify-center text-[13.5px] font-bold text-[color:var(--m-slate-2)]">Hide some ▾</summary>
        <form action={act} className="mt-1">
          {common}
          <input type="hidden" name="decision" value="hidden" />
          <input type="hidden" name="file_ids" value={JSON.stringify(pick)} />
          <div className="grid grid-cols-4 gap-1">
            {photos
              .filter((p) => p.state !== 'hidden')
              .map((p) => (
                <button
                  key={p.fileId}
                  type="button"
                  aria-pressed={pick.includes(p.fileId)}
                  onClick={() => setPick((xs) => (xs.includes(p.fileId) ? xs.filter((x) => x !== p.fileId) : [...xs, p.fileId]))}
                  className="relative block aspect-square overflow-hidden rounded-lg"
                  style={{ outline: pick.includes(p.fileId) ? '2px solid rgb(var(--color-danger))' : undefined }}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                </button>
              ))}
          </div>
          <button type="submit" disabled={pending || pick.length === 0} className="button-secondary mt-2 min-h-11 w-full">
            Hide {pick.length ? formatCount(pick.length) : ''} from our story
          </button>
        </form>
      </details>
      {silenceDays !== null && waiting > 0 ? (
        <p className="mt-2 text-[12.5px] text-[color:var(--m-slate-2)]">No answer after {formatCount(silenceDays)} days counts as accepted. Nothing is removed.</p>
      ) : (
        <p className="mt-2 text-[12.5px] text-[color:var(--m-slate-2)]">Nothing is removed.</p>
      )}
      <p className="text-[13px]">
        <InfoTip label="What Hide does" align="start">
          A hidden photo leaves your story only. It stays on the supplier’s shop. It is not deleted. You can show it again any time.
        </InfoTip>
      </p>
      {state.status === 'error' ? (
        <p role="alert" className="mt-1 text-[13px] text-[rgb(var(--color-danger))]">
          {state.message}
        </p>
      ) : state.status === 'done' ? (
        <p role="status" className="mt-1 text-[13px] text-[color:var(--m-slate-2)]">
          {state.message}
        </p>
      ) : null}
    </section>
  );
}
