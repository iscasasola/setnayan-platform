import Link from 'next/link';
import { DressCodeFields } from '../../dress-code/_components/dress-code-fields';
import { StoryFields, type LoveStoryBlob } from '../../our-story/_components/story-fields';
import { PhotoMomentsEditor } from '../../photo-moments/_components/photo-moments-editor';
import type { DressCodeConfig } from '../../dress-code/actions';
import { SubmitButton } from '@/app/_components/submit-button';

/**
 * Authoring panels for the unified editor (PR-8) — the last multi-field
 * settings, brought inline so the couple never leaves the editor.
 *
 * Both reuse the sub-editors' OWN field components rather than re-typing them:
 * `DressCodeFields` (extracted in this PR and now rendered by both surfaces) and
 * `PhotoMomentsEditor` (already a self-contained client component). That matters
 * for correctness, not just tidiness — `updateDressCode` and `updatePhotoMoments`
 * read every field on each save, so a partial hand-written form would silently
 * wipe the lists it didn't post. Sharing the fields makes that impossible and
 * keeps the panel and the page from drifting.
 */

const PANEL = 'border-t border-dashed border-ink/10 bg-cream/40 p-3';

export function DressCodePanel({
  action,
  eventId,
  config,
  eventNoun,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  config: DressCodeConfig;
  eventNoun: string;
}) {
  return (
    <form action={action} className={PANEL}>
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=dress-code`}
      />
      <DressCodeFields config={config} eventNoun={eventNoun} compact />
      <SubmitButton
        pendingLabel="Saving…"
        className="mt-3 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90"
      >
        Save
      </SubmitButton>
    </form>
  );
}

/**
 * Photo moments — the client editor owns its own form + submit (it manages a
 * dynamic list), so the panel is just its container. It posts to the same
 * `updatePhotoMoments` action as the sub-page.
 */
export function PhotoMomentsPanel({
  eventId,
  initial,
}: {
  eventId: string;
  initial: React.ComponentProps<typeof PhotoMomentsEditor>['initial'];
}) {
  return (
    <div className={PANEL}>
      <PhotoMomentsEditor eventId={eventId} initial={initial} />
    </div>
  );
}

/** Our story — the full 17-field form + milestones builder, inline
 *  (owner 2026-07-25: "our story … we want it to stay here"). Same shared-
 *  fields rule as dress code: updateOurStory reads every field per save. */
export function StoryPanel({
  action,
  eventId,
  story,
}: {
  action: (formData: FormData) => void | Promise<void>;
  eventId: string;
  story: LoveStoryBlob;
}) {
  return (
    <form action={action} className={PANEL}>
      <input
        type="hidden"
        name="return_to"
        value={`/dashboard/${eventId}/website/editor?open=story`}
      />
      <StoryFields story={story} />
      <SubmitButton
        pendingLabel="Saving…"
        className="mt-3 inline-flex items-center rounded-full bg-ink px-4 py-1.5 text-xs font-semibold text-cream transition-colors hover:bg-ink/90"
      >
        Save our story
      </SubmitButton>
    </form>
  );
}

/**
 * Details & schedule — mirrors the couple's PUBLIC schedule blocks inline
 * (owner 2026-07-25 + "show source, allow override"). The Schedule page stays
 * the source of truth for the run-of-show; this panel shows exactly what guests
 * will see and links to the source for changes. Vendor-given ceremony/reception
 * exact times are a separate designed feature (queued — Fable first).
 */
export function SchedulePeekPanel({
  eventId,
  eventDate,
  venueName,
  venueAddress,
  blocks,
}: {
  eventId: string;
  eventDate: string | null;
  venueName: string | null;
  venueAddress: string | null;
  blocks: Array<{ block_id: string; label: string; start_at: string; location: string | null }>;
}) {
  const fmtTime = (iso: string) => {
    const d = new Date(iso);
    return Number.isFinite(d.getTime())
      ? d.toLocaleTimeString('en-PH', { hour: 'numeric', minute: '2-digit' })
      : '';
  };
  return (
    <div className={PANEL}>
      <dl className="space-y-1 text-xs text-ink/70">
        {eventDate ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-semibold text-ink/50">When</dt>
            <dd>{new Date(eventDate).toLocaleDateString('en-PH', { dateStyle: 'long' })}</dd>
          </div>
        ) : null}
        {venueName || venueAddress ? (
          <div className="flex gap-2">
            <dt className="w-14 shrink-0 font-semibold text-ink/50">Where</dt>
            <dd>
              {venueName}
              {venueAddress ? <span className="block text-ink/50">{venueAddress}</span> : null}
            </dd>
          </div>
        ) : null}
      </dl>
      <div className="mt-2 border-t border-ink/10 pt-2">
        <p className="text-[0.7rem] font-semibold text-ink/60">
          {blocks.length > 0
            ? 'What guests see on your schedule'
            : 'No public schedule yet'}
        </p>
        {blocks.length > 0 ? (
          <ul className="mt-1 space-y-0.5">
            {blocks.map((b) => (
              <li key={b.block_id} className="flex gap-2 text-xs text-ink/70">
                <span className="w-16 shrink-0 font-mono text-[0.68rem] text-ink/50">
                  {fmtTime(b.start_at)}
                </span>
                <span className="min-w-0">
                  {b.label}
                  {b.location ? <span className="text-ink/45"> · {b.location}</span> : null}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-[0.7rem] text-ink/50">
            Build your run-of-show in Schedule and mark blocks public to show them here.
          </p>
        )}
      </div>
      <Link
        href={`/dashboard/${eventId}/schedule?view=event-day`}
        className="mt-2 inline-flex items-center rounded-full border border-ink/15 px-3 py-1 text-[0.7rem] font-semibold text-ink/70 hover:border-ink/30"
      >
        Adjust in Schedule →
      </Link>
    </div>
  );
}

/** Save-the-Date — the film's current personalization at a glance, with the
 *  studio one tap away and the phase tab for the full experience. */
export function StdPanel({
  eventId,
  openingLabel,
  themeLabel,
  launchDate,
}: {
  eventId: string;
  openingLabel: string;
  themeLabel: string | null;
  launchDate: string | null;
}) {
  return (
    <div className={PANEL}>
      <dl className="space-y-1 text-xs text-ink/70">
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-ink/50">Opening</dt>
          <dd className="capitalize">{openingLabel}</dd>
        </div>
        {themeLabel ? (
          <div className="flex gap-2">
            <dt className="w-24 shrink-0 font-semibold text-ink/50">Theme</dt>
            <dd className="capitalize">{themeLabel}</dd>
          </div>
        ) : null}
        <div className="flex gap-2">
          <dt className="w-24 shrink-0 font-semibold text-ink/50">Invitation day</dt>
          <dd>
            {launchDate
              ? new Date(launchDate).toLocaleDateString('en-PH', { dateStyle: 'long' })
              : 'Not scheduled yet'}
          </dd>
        </div>
      </dl>
      <p className="mt-1.5 text-[0.7rem] text-ink/45">
        Use the Save-the-Date tab above to experience the film exactly as guests will.
      </p>
      <Link
        href={`/dashboard/${eventId}/studio/save-the-date`}
        className="mt-2 inline-flex items-center rounded-full border border-ink/15 px-3 py-1 text-[0.7rem] font-semibold text-ink/70 hover:border-ink/30"
      >
        Design the film →
      </Link>
    </div>
  );
}

/** After / editorial — an honest free-vs-Pro split (owner 2026-07-25). */
export function EditorialPanel({
  eventId,
  ownsPro,
  unlockHref,
}: {
  eventId: string;
  ownsPro: boolean;
  unlockHref: string;
}) {
  return (
    <div className={PANEL}>
      <p className="text-[0.7rem] font-semibold text-success-800">Free — always on</p>
      <ul className="mt-0.5 list-disc pl-4 text-[0.7rem] text-ink/60">
        <li>The After page itself — your wedding&rsquo;s recap page for guests</li>
        <li>Approved wedding photos gathered automatically</li>
        <li>Your thank-you note (Special message)</li>
      </ul>
      <p className="mt-2 text-[0.7rem] font-semibold text-amber-800">
        Website Pro — the editor&rsquo;s desk
      </p>
      <ul className="mt-0.5 list-disc pl-4 text-[0.7rem] text-ink/60">
        <li>Write and arrange the story yourself — chapters, captions, order</li>
        <li>Curate which photos lead each chapter</li>
        <li>The magazine-style layout and cover</li>
      </ul>
      {ownsPro ? (
        <Link
          href={`/dashboard/${eventId}/website/editorial`}
          className="mt-2 inline-flex items-center rounded-full bg-ink px-3.5 py-1.5 text-[0.7rem] font-semibold text-cream hover:bg-ink/90"
        >
          Open the editor&rsquo;s desk →
        </Link>
      ) : (
        <Link
          href={unlockHref}
          className="mt-2 inline-flex items-center rounded-full bg-amber-400 px-3.5 py-1.5 text-[0.7rem] font-semibold text-ink hover:bg-amber-300"
        >
          Unlock Website Pro · ₱3,500
        </Link>
      )}
    </div>
  );
}
