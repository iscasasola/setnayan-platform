import Link from 'next/link';
import { Check, PenLine, UploadCloud } from 'lucide-react';

/**
 * <MarkDoors> — the chooser that opens the Monogram Maker.
 *
 * TWO WAYS TO GET A MARK, SHOWN AS TWO (owner 2026-09-20). Before this, both
 * ways lived on one scrolling page: the full Vector Studio, "upload your own"
 * far below it. Somebody who already had a logo scrolled past an entire editor
 * to find the thing they came for, and nothing ever said which of the two marks
 * guests actually saw.
 *
 * ⛔ THE SIDE-BY-SIDE COMPARISON IS GONE, AND ON PURPOSE. It existed because an
 * uploaded logo and a designed mark COMPETED for the same slot, so a couple had
 * to be shown both and asked which one won. They no longer compete: the upload
 * is the SOURCE the studio composes from, and the composition is the mark. One
 * mark means nothing to compare and nothing to switch between — so the compare,
 * the `data-mark` stamp and `setMarkChoiceAction` are deleted rather than left
 * as a second mechanism that disagrees with the first.
 *
 * Server component: the doors are LINKS carrying `?mode=`, and the switch is a
 * form posting a server action — no client state, so Back works, refresh keeps
 * the door open, and a deep link hands someone straight to one side.
 */
export function MarkDoors({
  eventId,
  liveSvg,
  liveIsComposition,
  hasStudio,
  hasUpload,
}: {
  eventId: string;
  /** The couple's mark as every surface renders it — resolved and ink-applied
   *  by the page, so this component never reaches for a column itself. */
  liveSvg: string | null;
  /** Was it composed in the studio, or is it the uploaded file still standing
   *  in for one? Only the SENTENCE below differs. */
  liveIsComposition: boolean;
  hasStudio: boolean;
  hasUpload: boolean;
}) {
  const href = (mode: 'design' | 'upload') => `/dashboard/${eventId}/monogram?mode=${mode}`;

  return (
    <div className="space-y-5">
      {liveSvg ? (

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
              It signs your website, QR codes, save-the-date and every video.
            </p>
            {/* ⚠ ONLY PROMISE WHAT IS TRUE OF THIS EVENT. An earlier version
                told every couple with an upload that "the one you designed
                comes straight back" — including one with no designed mark at
                all, where removing the upload drops to the generated initials
                lockup. Caught on the owner's own event. */}
            {!liveIsComposition && hasUpload ? (
              <p className="text-xs text-ink/55">
                This is the logo you uploaded. Open it in the studio to add a frame or
                change its colours — your original file is kept either way.
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
