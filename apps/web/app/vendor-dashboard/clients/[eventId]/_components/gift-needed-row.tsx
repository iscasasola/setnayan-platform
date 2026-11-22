import { Gift } from 'lucide-react';
import { SupplierSubmit } from '@/app/vendor-dashboard/_components/supplier-submit';
import { AGREE_GIFT_CLEARED, type AgreeGiftBasis } from '@/lib/agree-gifts';
import { AgreeGiftPicker } from './agree-gift-picker';

/**
 * 🎁 "Needs at least 1 gift." — an AGREED booking whose gift was cleared because its store payment was refused or
 * refunded (#7823, 21 Nov). The couple is told nothing; the shop picks again here with the same picker (starting on
 * the smallest Papic pack, "0 left · Buy more ›" into the store and back). Posts to `vendorAgreeToLock` with
 * `regift=1` — no new server action; the SQL door `booking_gift_pick` writes it or says why not.
 */
export function GiftNeededRow({
  eventVendorId,
  basis,
  returnTo,
  action,
}: {
  eventVendorId: string;
  basis: AgreeGiftBasis;
  returnTo: string;
  action: (formData: FormData) => void | Promise<void>;
}) {
  return (
    <section className="mb-4 rounded-2xl bg-frame p-4 shadow-sn-frame" data-gift-needed="">
      <p className="flex items-center gap-2 text-[14px] font-semibold text-danger-900">
        <Gift aria-hidden className="h-4 w-4 flex-none" strokeWidth={1.9} />
        {AGREE_GIFT_CLEARED}
      </p>
      <form action={action} className="mt-2">
        <input type="hidden" name="vendor_id" value={eventVendorId} />
        <input type="hidden" name="return_to" value={returnTo} />
        <input type="hidden" name="regift" value="1" />
        <AgreeGiftPicker basis={basis} regift />
        <SupplierSubmit tone="brand" main icon={<Gift aria-hidden className="h-4 w-4" strokeWidth={1.9} />} label="Give this gift" pendingLabel="Saving…" className="w-full" />
      </form>
    </section>
  );
}
