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
 *  - `ShowFartherButton` — the bench search's "Show suppliers farther away"
 *    (`category-search-overlay.tsx`), its words and its look. Here a press
 *    adds `far=1` to the address and the server re-renders with the second
 *    list; while that is out the button says so in the overlay's own words.
 */
import { useState, useTransition } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { Bookmark, Check, MessageCircle } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { cardVerbWords } from '@/lib/supplier-card-verbs';
import { haptic } from '@/lib/haptics';
import {
  INLINE_MORE_NOT_YOUR_EVENT,
  INLINE_MORE_SAVE_FAILED,
  INLINE_MORE_SIGNED_OUT,
} from '@/lib/explore-info-copy';
import { contactShortlistVendor } from '../../_actions/contact-shortlist-vendor';
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
        Saved
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
        {pending ? 'Saving…' : 'Save'}
      </button>
      {error ? (
        <span role="alert" className="mt-1 text-[11px] text-danger-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}

/**
 * "Show suppliers farther away" — owner, 2026-10-10: "yes offer the farther
 * away option. in case the need to search more". The control and both of its
 * sentences are the bench search overlay's (`.csov .farther-btn`): a full-width
 * dashed row in small capitals. DISTANCE ONLY — the list it opens is still
 * searched with `hideUnbookable`, so a supplier who cannot be booked on the
 * event's date stays hidden.
 */
export function ShowFartherButton({ href }: { href: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => router.replace(href, { scroll: false }))}
      data-find-farther=""
      className="mb-3.5 mt-0.5 block w-full rounded-md border border-dashed border-ink/15 bg-transparent p-[11px] font-mono text-[9px] uppercase tracking-[0.12em] text-ink/55 transition-colors active:border-terracotta active:text-terracotta-700 disabled:opacity-70"
    >
      {pending ? 'Finding suppliers farther away…' : 'Show suppliers farther away'}
    </button>
  );
}

/**
 * "Ask for a quote" on a Find row — ONE VERB, ONE BUTTON (2026-10-11). It is
 * the button rule's `ActionButton`, `main`, the same icon and tone the supplier
 * sheet's ask wears (`cardVerbWords('ask')`) and the prototype draws on this row
 * (`ib('chat','Ask for a quote',…,'main')`). The row used to carry an older
 * hand-styled pill for the same verb.
 *
 * ASKING SAVES. The press first files the supplier on the couple's list under
 * the category being browsed (`saveVendorToPicks` with the event and the
 * `tile` — the card of theirs IN this category, not their first card), then
 * opens the one inquiry on that row (`contactShortlistVendor`). The same two
 * steps, in the same order, as "More to compare" on the Suppliers page and the
 * supplier sheet — so nothing here needs a supplier to have been saved first.
 */
export function FindAskButton({
  eventId,
  vendorProfileId,
  tile,
}: {
  eventId: string;
  vendorProfileId: string;
  tile: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const quote = cardVerbWords('ask');

  const ask = () => {
    haptic('confirm');
    setError(null);
    const fd = new FormData();
    fd.set('vendor_profile_id', vendorProfileId);
    fd.set('event_id', eventId);
    fd.set('tile', tile);
    startTransition(async () => {
      try {
        const saved = await saveVendorToPicks(fd);
        if (saved.status !== 'ok' && saved.status !== 'already_saved') {
          setError(
            saved.status === 'not_signed_in'
              ? INLINE_MORE_SIGNED_OUT
              : saved.status === 'not_your_event'
                ? INLINE_MORE_NOT_YOUR_EVENT
                : INLINE_MORE_SAVE_FAILED,
          );
          return;
        }
        const res = await contactShortlistVendor({ eventId, vendorId: saved.eventVendorId });
        if (res.status === 'ok') {
          router.push(`/dashboard/${res.eventId}/messages/${res.threadId}`);
          return;
        }
        if (res.status === 'not_signed_in') {
          router.push('/login');
          return;
        }
        if (res.status === 'not_marketplace' || res.status === 'no_event') {
          setError("This supplier can't be messaged here.");
          return;
        }
        if (res.status === 'not_secured') {
          setError('Save your account first to message this supplier.');
          return;
        }
        setError(res.status === 'error' ? res.message : 'Could not open the conversation.');
      } catch {
        setError('Could not open the conversation.');
      }
    });
  };

  return (
    <span className="inline-flex flex-col" data-find-ask="">
      <ActionButton
        tone={quote.tone}
        main
        icon={MessageCircle}
        label={pending ? 'Asking…' : quote.label}
        disabled={pending}
        onClick={ask}
      />
      {error ? (
        <span role="alert" className="mt-1 text-[11px] text-danger-700">
          {error}
        </span>
      ) : null}
    </span>
  );
}
