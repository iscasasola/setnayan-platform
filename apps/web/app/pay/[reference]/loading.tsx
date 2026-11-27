/**
 * /pay/[reference] — the wait before the pay page answers.
 *
 * Why: speed audit 2026-11-27, Group J. A tap showed nothing until the server answered (10 reads before paint).
 *
 * Shape: the page's own column (`max-w-[560px] px-4 pt-6`) → the back link → the Maya pay stage it opens on:
 * the "Pay this exact amount" eyebrow and the big amount → the Order summary frame (item · reference · total)
 * → "Pay with" and its rails → the one pay button. Nothing here is known before the read, so it is all grey.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private
 * link page, as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk, SkLine } from '@/components/skeletons';

export default function PayLoading() {
  return (
    <Screen className="mx-auto w-full max-w-[560px] px-4 pb-32 pt-6">
      {/* The back link. */}
      <Ghost className="h-4 w-1/3 rounded" />
      <div className="mt-5">
        {/* "Pay this exact amount" → the amount. */}
        <Sk className="h-3 w-40 rounded" />
        <Sk className="mt-3 h-11 w-1/2 rounded-md" />
        {/* Order summary. */}
        <div className="sn-frame mt-6 space-y-4 p-5">
          <SkLine w="w-28" />
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 space-y-2">
              <SkLine w="w-3/5" />
              <Sk className="h-3 w-2/5 rounded" />
            </div>
            <Sk className="h-3.5 w-16 rounded" />
          </div>
          <div className="flex items-center justify-between gap-3">
            <Sk className="h-3.5 w-20 rounded" />
            <Sk className="h-3.5 w-28 rounded" />
          </div>
          <div className="flex items-center justify-between gap-3 pt-1">
            <Sk className="h-3.5 w-12 rounded" />
            <Sk className="h-4 w-20 rounded" />
          </div>
        </div>
        {/* Pay with. */}
        <div className="mt-6 space-y-3">
          <SkLine w="w-20" />
          <Sk className="h-14 w-full rounded-md" />
          <Sk className="h-3 w-4/5 rounded" />
        </div>
        {/* The one pay button. */}
        <Sk className="mt-8 h-11 w-full rounded-md" />
      </div>
    </Screen>
  );
}
