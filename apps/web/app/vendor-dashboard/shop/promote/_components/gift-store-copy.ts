/**
 * 🎟 THE TICKET SHEET'S WORDS — verbatim from the owner-approved prototype `gifts-interactive` v16 (2026-11-17), one
 * pair per gift: what it is FOR YOUR CLIENT and FOR YOU. Keyed by the gift's kind (and, for Papic, the credits its
 * catalogue row carries — the number in the sentence is that row's, never typed beside it). No price is here: every ₱ on
 * the sheet is the catalogue's.
 */
import { bundleFreePacks, giftCount, type ShopGiftKind } from '@/lib/shop-gifts';

export type GiftSheetWords = { eyebrow: string; forClient: string; forYou: string };

export function giftSheetWords(pack: { kind: ShopGiftKind; credits: number }): GiftSheetWords {
  const n = giftCount(pack.credits);
  if (pack.kind === 'event_plus') {
    return {
      eyebrow: 'Event · a gift for your client',
      forClient: 'Setnayan AI plans with them, their guests add 1,000 photos, and the guests’ page looks cleaner, with only a small “Made with Setnayan”.',
      forYou: 'Event Plus adds more value to your service without lowering your price.',
    };
  }
  if (pack.kind === 'event_pro') {
    return {
      eyebrow: 'Event · a gift for your client',
      forClient: 'Their event at its most beautiful: the cinematic Save-the-Date reveal, music, Pro themes and their own fonts, with no Setnayan mark anywhere guests look.',
      forYou: 'Every guest sees the event you helped make beautiful.',
    };
  }
  if (pack.kind === 'event_ultra') {
    return {
      eyebrow: 'Event · a gift for your client',
      forClient: 'Everything in Event Pro, plus Live Watch so family far away can follow the day, full-size photos kept 12 months, and canvas prints.',
      forYou: 'The finest gift on Setnayan puts your shop above the rest.',
    };
  }
  // Papic — the prototype's three sentences go with the pack's size: small, mid, the biggest.
  if (pack.credits >= 3000) {
    return {
      eyebrow: 'Papic · a gift for your client',
      forClient: `Every table, every dance, every corner of a full room: ${n} photos, so no moment is missed.`,
      forYou: 'The gift that tells your biggest clients you went further than anyone on their list.',
    };
  }
  if (pack.credits >= 1000) {
    return {
      eyebrow: 'Papic · a gift for your client',
      forClient: `Their whole day, seen through their guests’ eyes: ${n} photos from the first arrival to the last dance.`,
      forYou: 'A generous quote wins the booking, and every photo carries your shop’s gift.',
    };
  }
  return {
    eyebrow: 'Papic · a gift for your client',
    forClient: `Their guests’ phones become a photo booth: ${n} candid photos of the moments no one else caught, in one album they keep.`,
    forYou: 'A thank-you that costs little and makes your quote the one they remember.',
  };
}

/**
 * A bundle's shape, WORKED OUT from its catalogue row (never typed): how many its price pays for at today's list price,
 * and how many come free — "10 + 1" for the seeded bundles.
 */
export function bundleShape(b: { quantity: number; pack: { srpCentavos: number }; priceCentavos: number }): { paid: number; free: number; label: string } {
  const free = bundleFreePacks(b);
  const paid = b.quantity - free;
  return { paid, free, label: free > 0 ? `${giftCount(paid)} + ${giftCount(free)}` : `${giftCount(b.quantity)} pack` };
}

function ordinal(n: number): string {
  const s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : n % 10 === 1 ? 'st' : n % 10 === 2 ? 'nd' : n % 10 === 3 ? 'rd' : 'th';
  return `${giftCount(n)}${s}`;
}

/** The sheet's foot line (prototype v16: "Stock more, save more: every 10 you buy, the 11th is free."), from the bundle. */
export function giftSheetGrow(b: Parameters<typeof bundleShape>[0]): string | null {
  const { paid, free } = bundleShape(b);
  if (free <= 0) return null;
  return free === 1
    ? `Stock more, save more: every ${giftCount(paid)} you buy, the ${ordinal(paid + 1)} is free.`
    : `Stock more, save more: every ${giftCount(paid)} you buy, ${giftCount(free)} more are free.`;
}

/** Under a single at the most (prototype v16: "9 is the most here. Want 10? Take the 10 + 1 bundle below and get 1 free."). */
export function giftStoreCapLine(most: number, b: Parameters<typeof bundleShape>[0] | null): string {
  if (!b) return `${giftCount(most)} is the most here.`;
  const { label, free } = bundleShape(b);
  return `${giftCount(most)} is the most here. Want ${giftCount(most + 1)}? Take the ${label} bundle below and get ${giftCount(free)} free.`;
}

/** The Your gifts banner once a payment is sent (prototype v16). */
export const GIFT_PAYMENT_SENT = { lead: 'Payment sent.', rest: ' We’re checking it. Your new tickets land here once it’s approved.' };
