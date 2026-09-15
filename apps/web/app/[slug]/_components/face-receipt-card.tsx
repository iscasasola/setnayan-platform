import { ReceiptText } from 'lucide-react';
import { faceReceiptLines, type FaceReceiptInput } from '@/lib/face-receipt';

/**
 * The face-enrolment receipt, drawn.
 *
 * NO `'use client'` AND NO HOOKS ON PURPOSE — the capture card is a client
 * component and the after-the-fact notice is a server one, and this must be the
 * same words in both. A second copy of these sentences for the other runtime is
 * precisely the drift this whole row exists to prevent.
 *
 * The words themselves live in `lib/face-receipt.ts`, where the retention period
 * is derived from the constant the sweep reads. Nothing here may add a duration.
 */
export function FaceReceiptCard({
  heading,
  ...input
}: FaceReceiptInput & { heading: string }) {
  const lines = faceReceiptLines(input);
  return (
    <div className="rounded-lg border border-ink/10 bg-cream p-3 text-xs text-ink/75">
      <p className="flex items-center gap-1.5 font-medium text-ink">
        <ReceiptText aria-hidden className="h-4 w-4 shrink-0 text-terracotta" strokeWidth={1.75} />
        {heading}
      </p>
      <dl className="mt-2 space-y-1.5">
        {lines.map((line) => (
          <div key={line.key}>
            <dt className="font-medium text-ink/80">{line.label}</dt>
            <dd className="text-ink/70">{line.body}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
