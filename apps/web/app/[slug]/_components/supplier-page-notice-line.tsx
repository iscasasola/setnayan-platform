'use client';

import { useState, useTransition } from 'react';
import { Eye, X } from 'lucide-react';
import { ActionButton } from '@/components/action-button';
import { InfoTip } from '@/app/_components/info-tip';
import { askToTakeMyPhotoDown } from '../actions';
import {
  SUPPLIER_PAGE_NOTICE_DAYS,
  guestNoticeLine,
  guestPhotoWhen,
  type GuestNoticeGroup,
} from '@/lib/supplier-page-notice';

/**
 * 📣 THE QUIET LINE — "<Supplier> will show N photos from this event on their page · See them", each photo with Remove
 * (owner 2026-10-03, DECISION_LOG "A SUPPLIER'S OWN PAPIC PHOTOS GO ON ITS PORTFOLIO AUTOMATICALLY AFTER A 7-DAY GUEST
 * NOTICE" + "CHALLENGE PHOTOS …" (2); built 2026-10-28, "OWNER: Agree to all" (1) — in-app only, no email).
 *
 * One line per supplier, in the guest's Event Hub. "See them" opens the photos in place; Remove takes one off the
 * supplier's page at once and asks for their copy to come down too. A removed photo leaves the list where it stands —
 * the screen never resets. Title + one short line visible; the rest is inside the ⓘ.
 */
export function SupplierPageNoticeLine({ eventId, groups }: { eventId: string; groups: GuestNoticeGroup[] }) {
  const [removed, setRemoved] = useState<ReadonlySet<string>>(new Set());
  const shown = groups
    .map((g) => ({ ...g, photos: g.photos.filter((p) => !removed.has(p.noticeId)) }))
    .filter((g) => g.photos.length > 0);
  if (shown.length === 0 && removed.size === 0) return null;

  return (
    <section aria-label="Supplier pages" data-supplier-page-notice="" className="space-y-3">
      <InfoTip label="Supplier pages" labelAs="p" labelClassName="sn-eye text-ink/70" align="start">
        A supplier at this event wants to show some of its photos from the day on its own Setnayan page. Everyone at the
        event gets {SUPPLIER_PAGE_NOTICE_DAYS} days to remove any photo before it goes up. Remove still works after it
        is up: it comes off their page straight away, and we ask for their copy to be taken down too.
      </InfoTip>
      {shown.length === 0 ? (
        <p role="status" className="text-sm text-ink/65">Removed. It won&rsquo;t be on their page.</p>
      ) : (
        shown.map((g) => (
          <SupplierGroup
            key={g.supplierName + g.photos[0]!.noticeId}
            eventId={eventId}
            group={g}
            onRemoved={(id) => setRemoved((prev) => new Set(prev).add(id))}
          />
        ))
      )}
    </section>
  );
}

function SupplierGroup({
  eventId,
  group,
  onRemoved,
}: {
  eventId: string;
  group: GuestNoticeGroup;
  onRemoved: (noticeId: string) => void;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-ink/80">{guestNoticeLine(group)}</p>
        <ActionButton
          tone="neutral"
          quiet
          icon={Eye}
          label={open ? 'Hide' : 'See them'}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="shrink-0"
        />
      </div>
      {open ? (
        <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {group.photos.map((p) => (
            <PhotoWithRemove key={p.noticeId} eventId={eventId} photo={p} onRemoved={onRemoved} />
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function PhotoWithRemove({
  eventId,
  photo,
  onRemoved,
}: {
  eventId: string;
  photo: GuestNoticeGroup['photos'][number];
  onRemoved: (noticeId: string) => void;
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <li className="flex flex-col gap-1" data-supplier-page-photo={photo.noticeId}>
      <div className="aspect-square overflow-hidden rounded-lg bg-ink/5">
        {photo.url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : null}
      </div>
      <p className="text-xs text-ink/65">{guestPhotoWhen(photo)}</p>
      <ActionButton
        tone="danger"
        quiet
        icon={X}
        label={pending ? 'Removing…' : 'Remove'}
        waiting={pending}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            // The one guest takedown door: off the supplier's page now, and their album copy asked down too.
            const fd = new FormData();
            fd.set('note', 'Removed from the supplier’s page by a guest of this event.');
            const res = await askToTakeMyPhotoDown(eventId, 'vendor_papic_portfolio_photos', photo.photoId, fd);
            if (res.ok) onRemoved(photo.noticeId);
            else setError(res.message);
          })
        }
      />
      {error ? (
        <p role="alert" className="text-xs text-ink/80">
          {error}
        </p>
      ) : null}
    </li>
  );
}
