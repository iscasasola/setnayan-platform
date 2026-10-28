'use client';

import { RefreshCw } from 'lucide-react';

import { savedMark, supplierOfflinePaths, type SavedMark } from '@/lib/offline-copies';

import { SavedMarkLine } from './saved-mark-line';
import { useOfflineCopy } from './use-offline-copy';

/**
 * 📶 THE SUPPLIER'S SAVED MARK — Hub › the event card, top (EV3, owner-approved 2026-10-28; prototype frame "Supplier ·
 * Hub tab"): "✓ Saved for offline · updated 2:10 PM" + Update now. Always on: opening the Hub with signal keeps this
 * supplier's own copies of the Hub, the event's console and — when they run the hosts' door — its Check-in desk.
 * Drawn on the dark event card (`sn-tile-dark`), so it uses the on-dark tones.
 */
export function SupplierSavedStrip({
  viewer,
  eventId,
  eventDate,
  checkin,
}: {
  viewer: string;
  eventId: string;
  eventDate: string | null;
  checkin: boolean;
}) {
  const copy = useOfflineCopy({ viewer, eventId, eventDate, paths: supplierOfflinePaths(eventId, { checkin }) });
  return (
    <SupplierSavedStripView
      mark={savedMark({ phase: copy.phase, savedAt: copy.savedAt, now: copy.now, online: copy.online, eventDay: true, onCopy: copy.onCopy })}
      busy={copy.phase === 'saving'}
      canUpdate={copy.onCopy !== null || (copy.phase !== 'saving' && copy.online && copy.phase !== 'unsupported')}
      updateLabel={copy.onCopy !== null ? 'Load the latest' : 'Update now'}
      installed={copy.installed}
      onUpdate={() => void copy.update()}
    />
  );
}

/** What the strip draws — every state passed in (the lab draws each one). */
export function SupplierSavedStripView({
  mark,
  busy,
  canUpdate,
  installed,
  onUpdate,
  updateLabel = 'Update now',
}: {
  mark: SavedMark;
  busy: boolean;
  canUpdate: boolean;
  installed: boolean;
  onUpdate: () => void;
  /** "Load the latest" when the page on screen is the saved copy. */
  updateLabel?: string;
}) {
  return (
    <div data-supplier-saved="" className="mb-4 space-y-2 border-b pb-3" style={{ borderColor: 'rgba(251,251,250,0.14)' }}>
      <div className="flex items-start justify-between gap-3">
        <SavedMarkLine mark={mark} busy={busy} onDark />
        <button
          type="button"
          onClick={onUpdate}
          disabled={!canUpdate}
          className="sn-btn sn-btn-on-ink inline-flex min-h-11 shrink-0 items-center gap-1.5 !px-3.5 !py-2 text-[13px] disabled:opacity-50"
        >
          <RefreshCw aria-hidden className="h-4 w-4" strokeWidth={2} />
          {updateLabel}
        </button>
      </div>
      <p className="text-[12.5px]" style={{ color: 'rgba(251,251,250,0.62)' }}>
        Only what your day needs is saved. It&rsquo;s erased from this phone after the event.
        {installed ? null : ' For no-signal venues, use the Setnayan app or Add to Home Screen.'}
      </p>
    </div>
  );
}
