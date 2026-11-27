/**
 * /papic/order/[token] — a guest's Papic order (how to pay it), while the server answers.
 *
 * Why: speed audit 2026-11-27 marked it ⓛ: no loading boundary at or above it and about 3 reads before paint, so a
 * tap showed nothing until the server answered.
 *
 * Shape it mirrors (page.tsx): a `max-w-xl` column → the header (the eyebrow "Papic · your order", the order's
 * name as the heading, two lines) → the amount + reference frame → the "Already sent it?" form frame. That form
 * shows only while the order can still be logged, so its label stays grey; the eyebrow is fixed words and shows
 * at once. The order and its money are not known here.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private page,
 * as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export default function PapicOrderLoading() {
  return (
    <Screen className="mx-auto w-full max-w-xl space-y-6 px-4 py-8 sm:px-6">
      <div className="space-y-2">
        <Ghost known="Papic · your order" textClassName="sn-eye" />
        <Ghost className="h-8 w-60 max-w-full rounded-md" />
        <Sk className="h-3.5 w-4/5 rounded" />
        <Sk className="h-3 w-1/2 rounded" />
      </div>

      <div className="sn-frame space-y-4 p-5">
        <div className="space-y-2">
          <Sk className="h-3 w-16 rounded" />
          <Sk className="h-7 w-32 rounded" />
        </div>
        <div className="space-y-2 border-t border-ink/10 pt-4">
          <Sk className="h-3 w-28 rounded" />
          <Sk className="h-5 w-48 rounded" />
        </div>
        <Sk className="h-11 w-full rounded-md" />
      </div>

      <div className="sn-frame space-y-4 p-5">
        <Ghost className="h-3 w-28 rounded" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="space-y-1">
            <Sk className="h-3 w-28 rounded" />
            <Sk className="h-11 w-full rounded-md" />
          </div>
        ))}
        <Sk className="h-11 w-36 rounded-md" />
      </div>
    </Screen>
  );
}
