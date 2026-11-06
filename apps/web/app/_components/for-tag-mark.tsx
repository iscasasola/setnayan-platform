import { deriveVendorInitials } from '@/app/_components/vendor-avatar';
import type { ForTag } from '@/lib/for-tag';

/**
 * for-tag-mark.tsx — THE ROUND MARK IN FRONT OF "For <name>" (prototype
 * for_tag_on_event_cards_2026-10-22.html, `.stance .mk` and `.forline .mk`).
 *
 * A shop wears its own round logo (`vendor_profiles.logo_url`, signed); a loved one wears
 * their initials — `dependents` has no photo column, so nothing is invented for them.
 * Decorative: the name is always the text beside it.
 *
 *  • `chip` — 12 px, in the board card's stance chip (a white island in both themes, so its
 *    initials keep the parchment + gold of the light page).
 *  • `band` — 16 px, on the Home's cover band, in the band's own ink.
 */
export function ForTagMark({ tag, place }: { tag: ForTag; place: 'chip' | 'band' }) {
  const box =
    place === 'chip'
      ? 'h-3 w-3 shadow-[0_0_0_1px_rgba(44,42,41,0.12)]'
      : 'h-4 w-4 shadow-[0_0_0_1px_rgba(255,255,255,0.55)]';
  if (tag.markUrl) {
    return (
      <span aria-hidden data-for-mark="logo" className={`grid shrink-0 place-items-center overflow-hidden rounded-full ${box}`}>
        {/* A presigned R2 URL — next/image cannot optimise a short-lived signed URL (VendorAvatar's rule). */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={tag.markUrl} alt="" className="block h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span
      aria-hidden
      data-for-mark="initials"
      className={`grid shrink-0 place-items-center overflow-hidden rounded-full font-extrabold leading-none tracking-[0.02em] ${box} ${
        place === 'chip' ? 'bg-[#F3ECDF] text-[5.5px] text-[#8A6B39]' : 'bg-white/[0.22] text-[7px]'
      }`}
    >
      {deriveVendorInitials(tag.name)}
    </span>
  );
}
