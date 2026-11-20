'use client';

/**
 * ✓ THE WRAP-UP CARD (Today v3 part 3 — owner 19 Nov 2026, drawing `Today, tap opens a card` v3.5, V3 · 1 frames 2–4:
 * *"we check all the photos to be added to that event and inspiration. and see all the reviews you received. then when
 * supplier confirms, send the photos to share with the clients event story … nothing will be removed"* · *"place each
 * one in a frame"*).
 *
 * The SAME open row, three steps inside it — no second screen:
 *   1 · Photos — every photo filed for the event, all ✓ (this event); ★ = also Inspiration, none by default;
 *   2 · Reviews — the guest reviews from this event, with the shipped reply (`postVendorReply`, kind guest); the hosts'
 *       review is "Not yet" — it opens only after this confirm;
 *   3 · Confirm — one button: `eventFilesAction` op `wrapup`, which shares, tags, records and marks delivered.
 * Below Supplier Ultra the share is still made and kept, with the 🔒 Problem → Solution (owner: "All shares but only
 * Ultra shows"). 🔒 app/vendor-dashboard/_components/today-wrap-up-is-one-card.test.ts
 */
import { useActionState, useState } from 'react';
import { ChevronRight, Send } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { FormRows, TypedRow, nudgeFormRows } from '@/app/_components/form-row';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { eventFilesAction, type EventFilesState } from '@/app/_actions/event-files-actions';
import { postVendorReply } from '../reviews/actions';
import { WRAP_UP_STEPS, wrapUpCountLine, wrapUpSelection, type WrapUpFacts } from '@/lib/today-wrap-up';
import { formatCount } from '@/lib/format-number';

const UPGRADE_HREF = '/vendor-dashboard/subscription';

function Stars({ n }: { n: number }) {
  const r = Math.max(0, Math.min(5, Math.round(n)));
  return (
    <span aria-label={`${r} of 5 stars`} className="tracking-[1px] text-[rgb(var(--color-warn))]">
      {'★'.repeat(r)}
      <span className="text-ink/20">{'★'.repeat(5 - r)}</span>
    </span>
  );
}

function Line({ mark, title, line }: { mark: string; title: string; line: string }) {
  return (
    <div className="flex min-h-14 items-center gap-2.5 border-t border-ink/10 py-2 first:border-t-0" data-today-wrap-line="">
      <span aria-hidden className="grid h-9 w-9 flex-none place-items-center rounded-full bg-ink/[0.05] text-[14px]">
        {mark}
      </span>
      <span className="min-w-0">
        <b className="block text-[14.5px] font-semibold leading-tight text-ink">{title}</b>
        <span className="block text-[12.5px] text-[color:var(--m-slate-2)]">{line}</span>
      </span>
    </div>
  );
}

/** The shipped guest-review reply (`postVendorReply`, kind guest — one reply, final once posted), in the Field template. */
function GuestReply({ reviewId }: { reviewId: string }) {
  const [reply, setReply] = useState('');
  return (
    <form
      action={postVendorReply}
      className="mt-1 space-y-2"
      onSubmit={(event) => {
        if (nudgeFormRows(event.currentTarget) > 0) event.preventDefault();
      }}
    >
      <input type="hidden" name="kind" value="guest" />
      <input type="hidden" name="review_id" value={reviewId} />
      <input type="hidden" name="return_to" value="/vendor-dashboard" />
      <FormRows width="wide">
        <TypedRow
          name="Your public reply"
          value={reply}
          required
          long
          boxed
          empty="Write a reply"
          placeholder="Thank them — everyone who opens your page sees it…"
          maxLength={500}
          fieldName="reply"
          onKeep={(t) => setReply(t)}
          data={`wrap-reply-${reviewId}`}
        />
      </FormRows>
      <ActionButton tone="brand" type="submit" icon={<Send aria-hidden strokeWidth={1.9} />} label="Post reply" className="min-h-11" />
    </form>
  );
}

export function TodayWrapUpBody({ facts }: { facts: WrapUpFacts }) {
  const [step, setStep] = useState(0);
  const all = facts.photos.map((p) => p.fileId);
  const [ticked, setTicked] = useState<string[]>(all);
  const [starred, setStarred] = useState<string[]>([]);
  const [slot, setSlot] = useState(facts.parts[0]?.slotKey ?? '');
  const [rights, setRights] = useState(false);
  const [state, act, pending] = useActionState<EventFilesState, FormData>(eventFilesAction, { status: 'idle' });
  const on = (id: string) => ticked.includes(id);
  const star = (id: string) => starred.includes(id);
  const flip = (xs: string[], id: string) => (xs.includes(id) ? xs.filter((x) => x !== id) : [...xs, id]);
  const send = wrapUpSelection(all, ticked);
  const stars = starred.filter((id) => send.includes(id) && facts.parts.length > 0);
  const toGuests = facts.reviews.length;

  return (
    <div data-today-wrap-up={facts.eventId} data-today-wrap-step={WRAP_UP_STEPS[step]}>
      <span className="block text-[11px] font-bold uppercase tracking-[0.08em] text-[color:var(--m-slate-2)]">
        Step {step + 1} of 3 · {WRAP_UP_STEPS[step]}
      </span>
      <span aria-hidden className="mt-1.5 flex gap-1">
        {[0, 1, 2].map((i) => (
          <i key={i} className="h-1.5 flex-1 rounded-full" style={{ background: i <= step ? 'rgb(var(--sn-accent-rgb, 194 78 37))' : 'rgb(var(--color-ink) / 0.08)' }} />
        ))}
      </span>

      {step === 0 ? (
        <div data-today-wrap-photos="">
          <p className="mb-0.5 mt-2.5 text-[17px] font-extrabold leading-tight text-ink">Which photos go to this event?</p>
          <p className="m-0 text-[13.5px] text-[color:var(--m-slate-2)]">All ticked. Untick any you want left out.</p>
          {facts.photos.length ? (
            <div className="mt-2 grid grid-cols-3 gap-0.5 overflow-hidden rounded-xl">
              {facts.photos.map((p) => (
                <span key={p.fileId} className="relative block aspect-square overflow-hidden bg-ink/[0.05]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={p.url} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" style={{ opacity: on(p.fileId) ? 1 : 0.3 }} />
                  <button
                    type="button"
                    aria-pressed={on(p.fileId)}
                    aria-label={on(p.fileId) ? 'Leave this photo out' : 'Put this photo back'}
                    onClick={() => setTicked((t) => flip(t, p.fileId))}
                    className="absolute inset-0"
                    data-today-wrap-tick=""
                  >
                    <i
                      aria-hidden
                      className="absolute left-1.5 top-1.5 grid h-6 w-6 place-items-center rounded-full text-[13px] font-extrabold not-italic"
                      style={on(p.fileId) ? { background: 'rgb(var(--color-ok))', color: '#fff' } : { background: 'rgb(var(--sn-page-bg))', boxShadow: 'inset 0 0 0 2px rgb(var(--color-ink) / 0.4)' }}
                    >
                      {on(p.fileId) ? '✓' : ''}
                    </i>
                  </button>
                  {on(p.fileId) && facts.parts.length ? (
                    <button
                      type="button"
                      aria-pressed={star(p.fileId)}
                      aria-label={star(p.fileId) ? 'Not to Inspiration' : 'Also to Inspiration'}
                      onClick={() => setStarred((s) => flip(s, p.fileId))}
                      className="absolute bottom-0 right-0 grid h-11 w-11 place-items-center"
                      data-today-wrap-star=""
                    >
                      <i
                        aria-hidden
                        className="grid h-7 w-7 place-items-center rounded-full text-[14px] not-italic"
                        style={star(p.fileId) ? { background: 'rgb(var(--sn-accent-rgb, 194 78 37))', color: '#fff' } : { background: 'rgb(20 18 16 / 0.6)', color: '#fff' }}
                      >
                        {star(p.fileId) ? '★' : '☆'}
                      </i>
                    </button>
                  ) : null}
                </span>
              ))}
            </div>
          ) : (
            <p className="mt-2 text-[13.5px] text-[color:var(--m-slate-2)]">No photos filed for this event.</p>
          )}
          {stars.length && facts.parts.length > 1 ? (
            <div className="mt-2 block text-[12.5px] text-[color:var(--m-slate-2)]">
              ★ goes to this inspiration
              <PickMenu
                label="★ goes to this inspiration"
                value={slot}
                options={facts.parts.map((p) => ({ key: p.slotKey, label: p.label }))}
                onPick={setSlot}
                dataAttr="data-today-wrap-part"
                className="mt-1 w-full !min-h-11"
              />
            </div>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <span className="text-[13px] font-semibold text-ink" data-today-wrap-count="">
              {wrapUpCountLine(send.length, stars.length)}
            </span>
            <ActionButton tone="brand" icon={<ChevronRight aria-hidden strokeWidth={1.9} />} label="Next: reviews" onClick={() => setStep(1)} className="min-h-11" />
          </div>
        </div>
      ) : null}

      {step === 1 ? (
        <div data-today-wrap-reviews="">
          <p className="mb-0.5 mt-2.5 text-[17px] font-extrabold leading-tight text-ink">Reviews from this event</p>
          <p className="m-0 text-[13.5px] text-[color:var(--m-slate-2)]">
            {toGuests ? `${formatCount(toGuests)} from guests so far.` : 'No guest reviews yet.'}
          </p>
          {facts.reviews.map((r) => (
            <div key={r.reviewId} className="border-t border-ink/10 py-2.5 first:border-t-0" data-today-wrap-review="">
              <span className="flex flex-wrap items-center gap-1.5 text-[13px]">
                <Stars n={r.rating} /> <b className="font-semibold text-ink">{r.name}</b>
                <span className="text-[color:var(--m-slate-2)]">Guest at the event</span>
              </span>
              {r.line ? <p className="m-0 mt-1 text-[14.5px] text-ink">“{r.line}”</p> : null}
              {r.replied ? (
                <p className="m-0 mt-1 text-[12.5px] text-[color:var(--m-slate-2)]">You replied</p>
              ) : (
                <details className="mt-1">
                  <summary className="inline-flex min-h-11 cursor-pointer items-center text-[13px] font-semibold text-sn-accent">Reply</summary>
                  <GuestReply reviewId={r.reviewId} />
                </details>
              )}
            </div>
          ))}
          <div className="mt-2 border-t border-ink/10 pt-2.5 text-[13.5px] text-[color:var(--m-slate-2)]" data-today-wrap-hosts="">
            <b className="block font-bold text-ink">From the hosts · Not yet</b>
            Their review opens after you confirm and they say they received your service.
          </div>
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(0)} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent">
              ‹ Back to photos
            </button>
            <ActionButton tone="brand" icon={<ChevronRight aria-hidden strokeWidth={1.9} />} label="Next: confirm" onClick={() => setStep(2)} className="min-h-11" />
          </div>
        </div>
      ) : null}

      {step === 2 ? (
        <form action={act} data-today-wrap-confirm="">
          <input type="hidden" name="op" value="wrapup" />
          <input type="hidden" name="event_id" value={facts.eventId} />
          <input type="hidden" name="return_path" value="/vendor-dashboard" />
          <input type="hidden" name="file_ids" value={JSON.stringify(send)} />
          <input type="hidden" name="star_ids" value={JSON.stringify(stars)} />
          <input type="hidden" name="slot" value={slot} />
          <input type="hidden" name="rights" value={rights ? '1' : ''} />
          <p className="mb-0.5 mt-2.5 text-[17px] font-extrabold leading-tight text-ink">Confirm and share</p>
          <p className="m-0 text-[13.5px] text-[color:var(--m-slate-2)]">One tap does all of this. Nothing is removed.</p>
          <div className="mt-1">
            <Line mark="✓" title="I delivered this service" line="Opens the hosts’ review · counts toward Completed bookings" />
            {send.length ? <Line mark="▣" title={`${formatCount(send.length)} photos → this event’s album`} line="Their work on your page, once the hosts show them" /> : null}
            {stars.length ? <Line mark="★" title={`${formatCount(stars.length)} photos → Inspiration`} line="Checking first — Setnayan approves each one" /> : null}
            {send.length ? (
              facts.ultra ? (
                <Line mark="↗" title={`Share to the ${facts.eventName} story`} line="They get the photos and can hide any" />
              ) : (
                <div className="border-t border-ink/10 py-2" data-today-wrap-lock="">
                  <Line mark="🔒" title="Shared to the event’s story · kept" line="Every plan shares. Only Supplier Ultra photos show in their story." />
                  <p className="m-0 text-[13px] text-[color:var(--m-slate-2)]">
                    <b className="text-ink">Problem.</b> Your photos are shared and kept, but they do not show in the couple’s story on your plan.
                  </p>
                  <p className="m-0 mt-1 text-[13px] text-[color:var(--m-slate-2)]">
                    <b className="text-ink">Solution.</b> Move to Supplier Ultra. Your shared photos then show in your own scene.{' '}
                    <a href={UPGRADE_HREF} className="font-semibold text-sn-accent">
                      See Supplier Ultra
                    </a>
                  </p>
                </div>
              )
            ) : null}
            {toGuests ? <Line mark="★" title={`${formatCount(toGuests)} guest ${toGuests === 1 ? 'review' : 'reviews'}`} line="Already on your page and this card" /> : null}
          </div>
          {stars.length ? (
            <label className="mt-2 flex min-h-11 items-center gap-2 text-[13px] text-ink">
              <input type="checkbox" checked={rights} onChange={(e) => setRights(e.target.checked)} className="h-5 w-5" />
              These are my photos to share as inspiration
            </label>
          ) : null}
          {send.length && facts.silenceDays !== null ? (
            <p className="m-0 mt-2 text-[13px] text-[color:var(--m-slate-2)]" data-today-wrap-silence="">
              If the hosts do not answer after <b className="text-ink">{formatCount(facts.silenceDays)} days</b>, the photos count as accepted.
            </p>
          ) : null}
          {state.status === 'error' ? (
            <p role="alert" className="mt-2 text-[13px] text-[rgb(var(--color-danger))]">
              {state.message}
            </p>
          ) : null}
          <div className="mt-2.5 flex items-center justify-between gap-3">
            <button type="button" onClick={() => setStep(1)} className="inline-flex min-h-11 items-center text-[13px] font-semibold text-sn-accent">
              ‹ Back to reviews
            </button>
            <button type="submit" disabled={pending || (stars.length > 0 && !rights)} className="button-primary min-h-11 px-5">
              {pending ? 'Sharing…' : send.length ? 'Confirm and share' : 'Confirm'}
            </button>
          </div>
        </form>
      ) : null}
    </div>
  );
}
