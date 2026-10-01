import type { DateClash } from '@/lib/date-fits-booked';

/**
 * 🗓 A PICK A BOOKED SUPPLIER CANNOT DO — said plainly ("Your photographer is
 * booked elsewhere that day."), the date left as it is, and the one way to act:
 * "Ask them to move or unlock?" (a link per supplier when more than one). There is no date-change request between a
 * couple and a booked supplier yet (owner 2026-10-01: the supplier decides —
 * Adjust, or Unlock — is a separate build), so the action opens THAT supplier's
 * own conversation (`DateClash.href`, the workspace route that lands on the
 * thread), where the couple asks in words.
 */
export function DateClashNote({ clash }: { clash: { reason: string; list: readonly DateClash[] } }) {
  return (
    <div role="alert" data-date-clash="" className="flex flex-col gap-1.5 rounded-md bg-terracotta/10 px-3 py-2.5">
      <p className="text-[13px] text-ink">{clash.reason} Your date stays as it is.</p>
      {clash.list.map((c) => (
        <a
          key={c.vendorId}
          href={c.href}
          data-date-clash-ask={c.vendorId}
          className="inline-flex min-h-11 w-fit items-center text-[13px] font-semibold text-terracotta-700 underline underline-offset-2"
        >
          {clash.list.length === 1 ? 'Ask them to move or unlock?' : `Ask ${c.name} to move or unlock?`}
        </a>
      ))}
    </div>
  );
}
