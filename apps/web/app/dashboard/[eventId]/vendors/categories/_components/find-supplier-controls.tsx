'use client';

/**
 * The two pressable bits of Find a supplier (frame 7). Everything else on the
 * page is a server component.
 *
 *  - `FindFilterMenu` — the ONE Filter ▾ (Area · Price · Rating). It is the
 *    shipped PickMenu with `picked` (several-of-many = one dropdown with
 *    checkmarks, INTERACTION_RULES §2); a pick rewrites `?f=` and the server
 *    re-renders the list.
 *  - `SaveToBenchButton` — the same `saveVendorToPicks` the bench's search
 *    sheet calls, with the event on screen and the category being browsed.
 */
import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Check } from 'lucide-react';
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';
import { saveVendorToPicks } from '@/app/(shell)/explore/actions';
import { FIND_FILTERS, parseFindFilter } from '@/lib/supplier-find';

export function FindFilterMenu() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const picked = parseFindFilter(params.get('f'));

  const onPick = (key: string) => {
    const next = new Set<string>(picked);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    const sp = new URLSearchParams(params.toString());
    if (next.size > 0) sp.set('f', [...next].join(','));
    else sp.delete('f');
    router.replace(`${pathname}?${sp.toString()}`, { scroll: false });
  };

  return (
    <PickMenu
      label="Filter suppliers"
      value={null}
      buttonText={picked.length > 0 ? `Filter · ${picked.length}` : 'Filter'}
      options={FIND_FILTERS.map((f) => ({ key: f.key, label: f.label }))}
      picked={picked}
      onPick={onPick}
      dataAttr="data-find-filter"
      compact
    />
  );
}

export function SaveToBenchButton({
  eventId,
  vendorProfileId,
  tile,
  initiallySaved,
}: {
  eventId: string;
  vendorProfileId: string;
  tile: string;
  initiallySaved: boolean;
}) {
  const [saved, setSaved] = useState(initiallySaved);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const save = () => {
    setError(null);
    const fd = new FormData();
    fd.set('vendor_profile_id', vendorProfileId);
    fd.set('event_id', eventId);
    fd.set('tile', tile);
    startTransition(async () => {
      const res = await saveVendorToPicks(fd);
      if (res.status === 'ok' || res.status === 'already_saved') setSaved(true);
      else setError("Couldn't save — try again.");
    });
  };

  if (saved) {
    return (
      <span className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-ink/60">
        <Check className="h-3.5 w-3.5" aria-hidden />
        On your bench
      </span>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <button
        type="button"
        onClick={save}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-ink/15 px-3 py-2 text-[12.5px] font-semibold text-ink transition-colors hover:bg-ink/5 disabled:opacity-60"
      >
        <Bookmark className="h-3.5 w-3.5" aria-hidden />
        {pending ? 'Saving…' : 'Save to bench'}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[11px] text-danger-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
