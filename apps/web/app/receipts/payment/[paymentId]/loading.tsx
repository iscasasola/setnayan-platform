/**
 * /receipts/payment/[paymentId] — the wait before a supplier-payment receipt answers.
 *
 * Why: speed audit 2026-11-27, Group J. A tap showed nothing until the server answered (7 reads before paint).
 *
 * Shape: `ReceiptPage` — the 340 px column on the page ground → the back link (the shop's name, unknown until the
 * read, so grey) → the slip: SETNAYAN (always printed on it, shown at once), the kind, the big amount, the date,
 * the lines, the total, the reference rows → Save as PDF and Share under it.
 *
 * page.tsx can call notFound(); with this boundary that answer streams as HTTP 200 — acceptable on a private
 * link page, as on the 35 other routes that pair notFound() with a loader.
 */
import { Ghost, Screen, Sk, SkLine } from '@/components/skeletons';

export default function PaymentReceiptLoading() {
  return (
    <Screen className="min-h-dvh bg-page px-4 pb-10 pt-3.5">
      <div className="mx-auto w-full max-w-[340px]">
        <div className="mb-3 flex min-h-11 items-center">
          <Ghost className="h-3.5 w-32 rounded" />
        </div>
        <div className="sn-frame space-y-3 px-5 pb-6 pt-5">
          <Ghost
            known="SETNAYAN"
            className="mx-auto h-3 w-24 rounded"
            textClassName="text-center text-sn-sm font-bold tracking-widest"
          />
          <Sk className="mx-auto h-2.5 w-36 rounded" />
          <Sk className="mt-5 h-9 w-1/2 rounded-md" />
          <Sk className="h-3 w-2/5 rounded" />
          <div className="space-y-2.5 pt-4">
            <SkLine w="w-full" />
            <SkLine w="w-5/6" />
          </div>
          <div className="flex items-center justify-between pt-2">
            <Sk className="h-3.5 w-12 rounded" />
            <Sk className="h-4 w-24 rounded" />
          </div>
          <div className="space-y-2 pt-4">
            <SkLine w="w-full" />
            <SkLine w="w-full" />
            <SkLine w="w-full" />
            <Sk className="h-2.5 w-3/4 rounded" />
          </div>
        </div>
        <div className="mt-7 flex items-center justify-center gap-4">
          <Sk className="h-11 w-28 rounded-full" />
          <Sk className="h-11 w-20 rounded-full" />
        </div>
      </div>
    </Screen>
  );
}
