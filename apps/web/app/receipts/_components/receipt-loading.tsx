/**
 * The receipt slip while the server answers — the shape `ReceiptPage` + `ReceiptSlip` draw: the ‹ back link, the
 * 340 px slip (SETNAYAN and the slip's kind are fixed words, so they show at once), its amount, lines and total as grey,
 * then the actions under it. The two slip routes (`order/[orderId]`, `payment/[paymentId]`) decide sign-in and "not
 * found" in their `layout.tsx` before this streams, so this is only ever drawn for a slip that exists.
 */
import { Ghost, Screen, Sk } from '@/components/skeletons';

export function ReceiptSlipSkeleton({ back, kind }: { back?: string | null; kind?: string | null }) {
  return (
    <Screen className="min-h-dvh bg-page px-4 pb-10 pt-3.5">
      <div className="mx-auto w-full max-w-[340px]">
        <div className="mb-3 flex min-h-[44px] items-center">
          <Ghost known={back ? `‹ ${back}` : null} className="h-3.5 w-32 rounded" textClassName="text-[13px] font-semibold text-terracotta" />
        </div>
        <div className="sn-slip relative mx-auto w-full max-w-[340px] px-5 pb-6 pt-[22px]">
          <Ghost known="SETNAYAN" textClassName="text-center text-[12.5px] font-bold tracking-[0.3em]" />
          <Ghost
            known={kind}
            className="mx-auto mt-[7px] h-2.5 w-40 rounded"
            textClassName="mt-[7px] text-center font-mono text-[9.5px] uppercase leading-none tracking-[0.22em] text-[#6E6A62]"
          />
          <Sk className="mx-auto mt-5 h-9 w-40 rounded" />
          <Sk className="mx-auto mt-2 h-3 w-44 rounded" />
          <div className="mt-6 space-y-2.5">
            <Sk className="h-3.5 w-full rounded" />
            <Sk className="h-3.5 w-4/5 rounded" />
          </div>
          <Sk className="mt-4 h-5 w-full rounded" />
          <div className="mt-5 space-y-2">
            <Sk className="h-3 w-full rounded" />
            <Sk className="h-3 w-2/3 rounded" />
          </div>
        </div>
        <div className="mt-7 flex items-center justify-center gap-[18px]">
          <Sk className="h-11 w-28 rounded-full" />
          <Sk className="h-11 w-20 rounded-full" />
        </div>
      </div>
    </Screen>
  );
}
