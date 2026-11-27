/**
 * /proposals/[publicId] — the wait before a quote answers.
 *
 * Why: speed audit 2026-11-27, Group J. A tap showed nothing until the server answered (12 reads before paint).
 *
 * Shape: the page's 768 px column (`space-y-6 px-4 py-10`) → the top row (back link · status pill · Print) →
 * the header: the shop's logo, name and city, then the quote's title (the visible heading) and its reference
 * line → the quote's text → the line items frame with its total → the payment schedule frame → the two answer
 * buttons. Every word belongs to the quote, so nothing is known before the read: all grey.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private
 * link page, as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk, SkCircle, SkLine } from '@/components/skeletons';

export default function ProposalLoading() {
  return (
    <Screen className="mx-auto w-full max-w-3xl space-y-6 px-4 py-10 sm:px-6">
      {/* Back link · status pill · Print. */}
      <div className="flex items-center justify-between gap-3">
        <Sk className="h-4 w-32 rounded" />
        <div className="flex items-center gap-2">
          <Sk className="h-5 w-16 rounded-full" />
          <Sk className="h-11 w-20 rounded-md" />
        </div>
      </div>
      {/* The shop, then the quote's title. */}
      <div className="border-b border-ink/15 pb-4">
        <div className="flex items-center gap-3">
          <SkCircle size="h-12 w-12" />
          <div className="flex-1 space-y-2">
            <Sk className="h-4 w-2/5 rounded" />
            <Sk className="h-3 w-1/4 rounded" />
          </div>
        </div>
        <Ghost className="mt-4 h-8 w-3/4 rounded-md" />
        <Sk className="mt-2 h-3 w-1/2 rounded" />
      </div>
      {/* The quote's text. */}
      <div className="space-y-2">
        <SkLine />
        <SkLine />
        <SkLine w="w-2/3" />
      </div>
      {/* Line items and the total. */}
      <div className="sn-frame space-y-3 p-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between gap-3">
            <SkLine w="w-1/2" />
            <Sk className="h-3.5 w-20 rounded" />
          </div>
        ))}
        <div className="flex items-center justify-between gap-3 pt-2">
          <Sk className="h-4 w-16 rounded" />
          <Sk className="h-5 w-28 rounded" />
        </div>
      </div>
      {/* Payment schedule. */}
      <div className="sn-frame space-y-3 p-4">
        <Sk className="h-3 w-36 rounded" />
        <SkLine w="w-full" />
        <SkLine w="w-5/6" />
      </div>
      {/* The answer buttons. */}
      <div className="flex flex-wrap gap-3">
        <Sk className="h-11 w-36 rounded-md" />
        <Sk className="h-11 w-28 rounded-md" />
      </div>
    </Screen>
  );
}
