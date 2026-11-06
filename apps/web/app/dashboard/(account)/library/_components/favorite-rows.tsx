'use client';

/**
 * Library › Suppliers › FAVORITES — the rows (owner 2026-11-06, prototype §G).
 *
 * House row rule (owner 2026-11-04): TAP opens (the shop page, at that service) · SWIPE LEFT removes, with Undo
 * (the shipped `SwipeToDelete` + `deleteWithUndo`: the row hides at once and the delete is written when the Undo
 * window closes) · no buttons on the row. The ⓘ at the row's end says where it came from and how to remove it.
 */
import { useState } from 'react';
import Link from 'next/link';
import { CalendarDays } from 'lucide-react';
import { SwipeToDelete } from '@/app/_components/swipe-to-delete';
import { deleteWithUndo } from '@/app/_components/undo/delete-with-undo';
import { UndoToastHost } from '@/app/dashboard/[eventId]/guests/_components/undo-toast';
import { InfoTip } from '@/app/_components/info-tip';
import { favoriteAction } from '@/app/_actions/favorite-actions';
import { FAVORITE_REMOVE_HINT, favoriteKey } from '@/lib/favorites';
import type { FavoriteListRow } from '../_data/attended-vendors';

function Row({ row }: { row: FavoriteListRow }) {
  const body = (
    <>
      {row.logoUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={row.logoUrl} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-terracotta/10 text-sm font-bold text-terracotta-700">
          {row.name.trim().charAt(0).toUpperCase() || 'V'}
        </span>
      )}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[15px] font-semibold text-ink">{row.name}</span>
        {row.line ? <span className="block truncate text-[13px] text-ink/65">{row.line}</span> : null}
        {row.from ? (
          <span className="mt-0.5 block text-[12px] leading-snug text-ink/70" data-favorite-from="">
            <CalendarDays aria-hidden className="-mt-0.5 mr-1 inline h-3 w-3" strokeWidth={2} />
            {row.from}
          </span>
        ) : null}
      </span>
    </>
  );
  return (
    <div className="flex items-center gap-3 rounded-xl border border-ink/10 bg-cream px-3 py-2.5"> {/* no-card-ok: the row is pressed — tap opens the shop at that service, swipe left removes */}
      {row.href ? (
        <Link href={row.href} className="flex min-w-0 flex-1 items-center gap-3">
          {body}
        </Link>
      ) : (
        <span className="flex min-w-0 flex-1 items-center gap-3">{body}</span>
      )}
      <InfoTip label={row.name} labelClassName="sr-only" ariaLabel={`About ${row.name}`} align="end">
        <span className="block font-bold text-ink">{row.name}</span>
        {row.detail ? <span className="mt-0.5 block text-ink/70">{row.detail}</span> : null}
        <span className="mt-2 block text-ink/70">{FAVORITE_REMOVE_HINT}</span>
      </InfoTip>
    </div>
  );
}

export function FavoriteRows({ rows }: { rows: FavoriteListRow[] }) {
  const [gone, setGone] = useState<ReadonlySet<string>>(new Set());
  const hide = (k: string, on: boolean) =>
    setGone((cur) => {
      const next = new Set(cur);
      if (on) next.add(k);
      else next.delete(k);
      return next;
    });
  return (
    <>
      <UndoToastHost />
      <ul className="grid gap-2" data-library-favorites="">
        {rows.map((r) => {
          const k = favoriteKey(r.shopId, r.serviceId);
          if (gone.has(k)) return <li key={k} hidden data-swipe-gone="" />;
          return (
            <SwipeToDelete
              key={k}
              as="li"
              label={`Remove ${r.name} from favorites`}
              word="Remove"
              radiusClass="rounded-xl"
              onDelete={() =>
                deleteWithUndo({
                  label: `${r.name} removed from favorites.`,
                  hide: () => hide(k, true),
                  restore: () => hide(k, false),
                  commit: () => favoriteAction({ op: 'remove', shopId: r.shopId, serviceId: r.serviceId }),
                  failed: 'Couldn’t remove that favorite. It’s back — try again.',
                })
              }
            >
              <Row row={r} />
            </SwipeToDelete>
          );
        })}
      </ul>
    </>
  );
}
