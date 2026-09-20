import Link from 'next/link';
import { Check, PenLine, UploadCloud } from 'lucide-react';

/**
 * <MarkDoors> — the chooser that opens the Monogram Maker.
 *
 * TWO WAYS TO GET A MARK, SHOWN AS TWO (owner 2026-09-20). Before this, both
 * ways lived on one scrolling page: the full Vector Studio first, "upload your
 * own" far below it. Somebody who already had a logo from their designer had to
 * scroll past an entire editor to find the thing they came for, and nothing on
 * the page ever said which of the two marks was the one guests actually saw.
 *
 * This answers that question first — the live mark, large, labelled with which
 * door made it — and then offers the two doors. Server component: the choice is
 * a LINK carrying `?mode=`, not client state, so Back works, refresh keeps the
 * door open, and a deep link can hand someone straight to one side.
 *
 * 🔑 Both doors stay open even when a mark already exists. An uploaded mark
 * outranks a designed one, so "Upload your own" must never read as a one-way
 * door: removing the upload brings the designed mark straight back, and the
 * card below says so in those words.
 */
export function MarkDoors({
  eventId,
  effectiveSvg,
  hasStudio,
  hasUpload,
}: {
  eventId: string;
  /** The mark that actually renders everywhere right now — already resolved and
   *  gated by the caller, so this component never touches a raw column. */
  effectiveSvg: string | null;
  hasStudio: boolean;
  hasUpload: boolean;
}) {
  const href = (mode: 'design' | 'upload') => `/dashboard/${eventId}/monogram?mode=${mode}`;

  return (
    <div className="space-y-5">
      {effectiveSvg ? (
        <section className="flex flex-col items-center gap-4 rounded-2xl border border-ink/10 bg-cream p-6 sm:flex-row sm:items-center sm:p-7">
          <div
            aria-hidden
            className="flex h-28 w-28 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-white p-3 [&_svg]:h-full [&_svg]:w-full"
            /* Already through the read-time gate (resolveEventMonogramSvg) in
             * the page — this is the same sanitized value every other surface
             * renders, not a second, unguarded read of the column. */
            dangerouslySetInnerHTML={{ __html: effectiveSvg }}
          />
          <div className="space-y-1.5 text-center sm:text-left">
            <p className="inline-flex items-center gap-1.5 rounded-full border border-success-200 bg-success-50 px-3 py-1 text-xs font-semibold text-success-800">
              <Check aria-hidden className="h-3.5 w-3.5" strokeWidth={2.4} />
              This is your mark
            </p>
            <p className="text-sm leading-relaxed text-ink/65">
              {hasUpload
                ? 'Your uploaded mark — it signs your website, QR codes, save-the-date and every video. Remove it and the one you designed comes straight back.'
                : 'Designed here — it signs your website, QR codes, save-the-date and every video.'}
            </p>
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
