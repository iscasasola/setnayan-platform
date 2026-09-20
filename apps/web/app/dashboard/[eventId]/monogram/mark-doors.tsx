import Link from 'next/link';
import { Check, PenLine, UploadCloud } from 'lucide-react';
import { setMarkChoiceAction } from './upload-actions';

/**
 * <MarkDoors> — the chooser that opens the Monogram Maker.
 *
 * TWO WAYS TO GET A MARK, SHOWN AS TWO (owner 2026-09-20). Before this, both
 * ways lived on one scrolling page: the full Vector Studio, "upload your own"
 * far below it. Somebody who already had a logo scrolled past an entire editor
 * to find the thing they came for, and nothing ever said which of the two marks
 * guests actually saw.
 *
 * SIDE BY SIDE WHEN THERE ARE TWO (owner 2026-09-20: "why don't i see the
 * comparison of the create your own and upload a logo"). A couple with both a
 * designed mark and an uploaded one now sees BOTH, at size, labelled with which
 * is live, and switches between them in one tap. That switch keeps both files —
 * it stamps `data-mark="off"` rather than deleting anything
 * (lib/monogram-mark-choice.ts). Before, the only way back to a designed mark
 * was "Remove upload", which destroyed the uploaded file.
 *
 * Server component: the doors are LINKS carrying `?mode=`, and the switch is a
 * form posting a server action — no client state, so Back works, refresh keeps
 * the door open, and a deep link hands someone straight to one side.
 */
export function MarkDoors({
  eventId,
  studioSvg,
  uploadedSvg,
  uploadIsLive,
  hasStudio,
  hasUpload,
}: {
  eventId: string;
  /** The designed mark, already gated + ink-resolved by the caller. */
  studioSvg: string | null;
  /** The uploaded mark, likewise — shown even when it is switched OFF, because
   *  it is still the couple's file and they are choosing between the two. */
  uploadedSvg: string | null;
  /** Is the uploaded mark the one guests see right now? */
  uploadIsLive: boolean;
  hasStudio: boolean;
  hasUpload: boolean;
}) {
  const href = (mode: 'design' | 'upload') => `/dashboard/${eventId}/monogram?mode=${mode}`;
  const bothExist = Boolean(studioSvg && uploadedSvg);
  const liveSvg = uploadIsLive ? uploadedSvg : studioSvg;

  return (
    <div className="space-y-5">
      {bothExist ? (
        <section className="space-y-3 rounded-2xl border border-ink/10 bg-cream p-5 sm:p-6">
          <div>
            <p className="font-mono text-xs uppercase tracking-[0.18em] text-gold-deep">You have two</p>
            <h2 className="mt-1 text-lg font-semibold tracking-tight">Which one is your mark?</h2>
            <p className="mt-1 max-w-prose text-sm text-ink/65">
              Both are kept. Switch whenever you like — nothing is deleted either way.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <MarkCandidate
              eventId={eventId}
              svg={uploadedSvg as string}
              title="Your uploaded logo"
              live={uploadIsLive}
              choice="upload"
            />
            <MarkCandidate
              eventId={eventId}
              svg={studioSvg as string}
              title="The one you designed"
              live={!uploadIsLive}
              choice="studio"
            />
          </div>
        </section>
      ) : liveSvg ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-cream p-6 sm:flex-row sm:items-center sm:p-7">
          <div
            aria-hidden
            className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
            /* Already through the read-time gate in the page — the same
             * sanitized value every other surface renders. */
            dangerouslySetInnerHTML={{ __html: liveSvg }}
          />
          <div className="space-y-1.5 text-center sm:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-semibold text-success-800">
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
              This is your mark
            </p>
            <p className="text-sm leading-relaxed text-ink/65">
              {uploadIsLive
                ? 'Your uploaded mark — it signs your website, QR codes, save-the-date and every video.'
                : 'Designed here — it signs your website, QR codes, save-the-date and every video.'}
            </p>
            {/* ⚠ ONLY PROMISE A MARK THAT EXISTS. This line used to read
                "Remove it and the one you designed comes straight back" for
                ANY uploaded mark — including an event with no designed mark at
                all, where removing the upload drops the couple to the generated
                initials lockup. Caught on the owner's own event, which has an
                uploaded logo and no studio mark. */}
            {uploadIsLive && hasStudio ? (
              <p className="text-xs text-ink/55">
                Remove it and the one you designed comes straight back.
              </p>
            ) : null}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href={href('design')}
          className="group flex flex-col gap-3 rounded-2xl border border-ink/12 bg-cream p-6 transition-colors hover:border-gold"
        >
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/12 px-3 py-1 text-xs font-semibold text-gold-dark">
            <PenLine aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            Free · no design skills
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            {hasStudio ? 'Keep designing yours' : 'Design it here'}
          </h2>
          <p className="text-sm leading-relaxed text-ink/65">
            Start from your two initials. Weave them where they cross, frame them and
            choose your colours — it opens on your names, not a placeholder.
          </p>
        </Link>

        <Link
          href={href('upload')}
          className="group flex flex-col gap-3 rounded-2xl border border-ink/12 bg-cream p-6 transition-colors hover:border-gold"
        >
          <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-gold/12 px-3 py-1 text-xs font-semibold text-gold-dark">
            <UploadCloud aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
            SVG · PNG · a photo of it
          </span>
          <h2 className="text-lg font-semibold tracking-tight">
            {hasUpload ? 'Replace or remove your upload' : 'Upload your own'}
          </h2>
          <p className="text-sm leading-relaxed text-ink/65">
            Already have a mark from a designer? We take it apart into its pieces, so it
            can animate and take your colours just like one made here.
          </p>
        </Link>
      </div>
    </div>
  );
}

/** One of the two marks, with the switch that makes it the live one. */
function MarkCandidate({
  eventId,
  svg,
  title,
  live,
  choice,
}: {
  eventId: string;
  svg: string;
  title: string;
  live: boolean;
  choice: 'upload' | 'studio';
}) {
  return (
    <div
      className={`flex flex-col items-center gap-3 rounded-xl border p-4 text-center ${
        live ? 'border-gold bg-gold/8' : 'border-ink/12 bg-white'
      }`}
    >
      <div
        aria-hidden
        className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-lg bg-white p-2 [&_svg]:h-full [&_svg]:w-full"
        dangerouslySetInnerHTML={{ __html: svg }}
      />
      <p className="text-sm font-semibold text-ink">{title}</p>
      {live ? (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-semibold text-success-800">
          <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
          In use everywhere
        </span>
      ) : (
        <form action={setMarkChoiceAction}>
          <input type="hidden" name="event_id" value={eventId} />
          <input type="hidden" name="choice" value={choice} />
          <button
            type="submit"
            className="inline-flex min-h-[44px] items-center justify-center rounded-lg border border-ink/15 bg-cream px-4 text-sm font-semibold text-ink hover:bg-ink/5"
          >
            Use this one
          </button>
        </form>
      )}
    </div>
  );
}
