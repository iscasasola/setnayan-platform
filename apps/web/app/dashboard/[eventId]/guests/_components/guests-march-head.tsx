import { InfoTip } from '@/app/_components/info-tip';

/**
 * 🗂 R4 · Guests › March's one line over the maker — the title and one ⓘ (owner 2026-10-23, "details go inside the
 * ⓘ"). ONE copy, drawn by the page (`guests-march.tsx`) and the guests lab alike. It says the one thing a couple must
 * know that the Guest list does not do: the march still waits for the Event Hub's ✓ Apply (owner 2026-10-06, *"Wait
 * for apply"*) — a move shows here at once and reaches guests with Apply.
 */
export function GuestsMarchHead() {
  return (
    <div className="flex items-center gap-2 px-1" data-guests-march-head="">
      <InfoTip label="Drag the names" labelClassName="text-[15px] font-semibold text-ink">
        Two columns, the left and the right of the aisle — drag a name to swap, to join a walk, or to the tray when they
        do not walk. Tap a name for their guest card. Guests see the march once you press ✓ Apply in your Event Hub.
      </InfoTip>
    </div>
  );
}
