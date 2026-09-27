import { formatEventDate } from '@/lib/events';
import { formatMomentDate, type LoveStoryMoment } from '@/lib/love-story-moments';
import { SubmitButton } from '@/app/_components/submit-button';
import { LoveStoryProLine } from './love-story-pro-line';
import { HubDraftField } from '../../_components/hub-draft-field';
import { InMakerReturnTo } from './in-maker-return-to';

/**
 * PICK FROM OUR EVENTS — "From what Setnayan already holds" (prototype § pick).
 *
 * Lists every OTHER event BOTH partners were at, in any role, newest first
 * (owner 2026-09-27: *"this should show all events that they are both
 * there"*; the scope is `our-events-read.ts`). An event the pair HOSTS offers
 * the photos it already shows guests — its "Photos you add" gallery and its
 * hero. Someone else's event is listed with no photos: that couple's gallery is
 * theirs, and the pair's own Papic captures there are private (below). Nothing
 * is copied: a pick stores the same ref, and the server accepts only a ref the
 * same read offers (`loveStoryMomentAction` intent `pick`).
 *
 * ⏭ Papic booth photos live in a PRIVATE bucket and need a per-event consent
 * answer before they can appear on another event's public page — they are not
 * offered here yet, and the block says so rather than showing an empty booth.
 */
export type OtherEvent = {
  eventId: string;
  name: string;
  date: string | null;
  /** Either partner is the couple there — only then are photos offered. A coordinated event is another couple's. */
  hosted: boolean;
  photos: { ref: string; url: string }[];
};

const eye = 'font-mono text-[0.66rem] uppercase tracking-[0.24em] text-[color:var(--ls-muted)]';

export function PickFromOurEvents({
  events,
  moments,
  ownsPro,
  storeShell,
  proHref,
  proPrice,
  action,
}: {
  /** NULL = the read was refused — said on screen, never drawn as "none". */
  events: readonly OtherEvent[] | null;
  moments: readonly LoveStoryMoment[];
  ownsPro: boolean;
  storeShell: boolean;
  proHref: string;
  proPrice: string | null;
  action: (formData: FormData) => void | Promise<void>;
}) {
  if (events === null) {
    return (
      <section id="pick" aria-labelledby="pick-title" className="scroll-mt-16 border-t border-[color:var(--ls-rule)] pt-10">
        <p className={eye}>From what Setnayan already holds</p>
        <h2 id="pick-title" className="mt-1 font-pahina text-3xl font-light">
          Pick from <i className="text-[color:var(--ls-heading)]">our events</i>
        </h2>
        <p role="status" className="mt-3 text-[14px] text-[color:var(--ls-muted)]">
          We could not look up your other events just now. Refresh the page to try again.
        </p>
      </section>
    );
  }
  const withPhotos = events.filter((e) => e.photos.length > 0);
  return (
    <section id="pick" aria-labelledby="pick-title" className="scroll-mt-16 border-t border-[color:var(--ls-rule)] pt-10">
      <p className={eye}>From what Setnayan already holds</p>
      <h2 id="pick-title" className="mt-1 font-pahina text-3xl font-light">
        Pick from <i className="text-[color:var(--ls-heading)]">our events</i>
      </h2>
      {events.length === 0 ? (
        <p className="mt-3 text-[14px] text-[color:var(--ls-muted)]">
          No other event with both of you yet. Events you are both at will show here.
        </p>
      ) : (
        <ul className="mt-4 space-y-2 text-[14px]">
          {events.map((e) => (
            <li key={e.eventId} className="flex flex-wrap items-baseline gap-x-3">
              <b className="font-medium">{e.name}</b>
              {e.date ? <span className="text-[color:var(--ls-muted)]">{formatEventDate(e.date)}</span> : null}
              <span className="text-[color:var(--ls-muted)]">
                {!e.hosted
                  ? 'someone else’s event'
                  : e.photos.length === 0
                    ? 'no photos yet'
                    : `${e.photos.length} ${e.photos.length === 1 ? 'photo' : 'photos'}`}
              </span>
            </li>
          ))}
        </ul>
      )}

      {!ownsPro ? (
        withPhotos.length > 0 ? (
          <LoveStoryProLine storeShell={storeShell} href={proHref} price={proPrice} />
        ) : null
      ) : withPhotos.length > 0 && moments.length > 0 ? (
        <form action={action} className="mt-5 space-y-4">
          <HubDraftField />
          <InMakerReturnTo />
          <input type="hidden" name="intent" value="pick" />
          {withPhotos.map((e) => (
            <fieldset key={e.eventId}>
              <legend className={eye}>{e.name}</legend>
              <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-6">
                {e.photos.map((ph) => (
                  <label key={ph.ref} className="relative block cursor-pointer">
                    <input type="checkbox" name="media" value={ph.ref} className="peer sr-only" />
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={ph.url} alt="" className="aspect-square w-full rounded-md object-cover peer-checked:ring-4 peer-checked:ring-[color:var(--ls-accent)]" />
                  </label>
                ))}
              </div>
            </fieldset>
          ))}
          <label className="block text-[14px]">
            <span className={eye}>Add them to</span>
            <select name="id" className="mt-1.5 w-full rounded-md border border-[color:var(--ls-rule)] bg-[color:var(--ls-surface)] px-3 py-2">
              {moments.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatMomentDate(m.date) || 'Undated'} — {m.line.slice(0, 60)}
                </option>
              ))}
            </select>
          </label>
          <SubmitButton pendingLabel="Adding…" className="button-primary">
            Use these
          </SubmitButton>
        </form>
      ) : null}
      <p className="mt-4 text-[12px] text-[color:var(--ls-muted)]">
        Photos from a Papic booth join here once each event says its photos may be shared.
      </p>
    </section>
  );
}
