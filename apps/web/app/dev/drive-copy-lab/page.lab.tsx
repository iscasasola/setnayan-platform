/**
 * /dev/drive-copy-lab — ☁️ "Copy to Google Drive" for a supplier, per event (owner 2026-11-22). DEV-ONLY: production
 * builds never compile this route (`page.lab.tsx`) and `app/dev/layout.lab.tsx` 404s it besides. It draws the REAL
 * `CopyEventToDrive` in each state of the shop's Drive, on fixture data — no sign-in, no database:
 *
 *   · not connected (the press opens the shipped DriveConnectCard) · Google paused (DriveReconnectBanner) ·
 *     not set up yet ("Drive setup pending") · connected, part-copied (⚙ settings sheet) · connected, all copied ·
 *     a refused read (the copied line is not drawn; a press says it could not check).
 *
 * A press in the connected rows posts to the real `/api/vendor/drive-copy`, which refuses a lab with no session — the
 * row then says the copy stopped, which is the honest failure state to look at.
 */
import { notFound } from 'next/navigation';
import { CopyEventToDrive } from '@/app/vendor-dashboard/_components/copy-event-to-drive';
import type { ShopDriveState } from '@/lib/supplier-drive-copy';

const EVENT = '00000000-0000-4000-8000-00000000d71e';
const ROWS: { label: string; drive: ShopDriveState; copied: { total: number; copied: number } | null }[] = [
  { label: 'Not connected', drive: { status: 'not_connected' }, copied: { total: 0, copied: 0 } },
  { label: 'Google paused our access', drive: { status: 'needs_reconnect', account: 'studio@example.com' }, copied: { total: 12, copied: 9 } },
  { label: 'Drive not set up by Setnayan yet', drive: { status: 'not_configured' }, copied: { total: 0, copied: 0 } },
  { label: 'Connected · part copied', drive: { status: 'connected', account: 'studio@example.com' }, copied: { total: 40, copied: 12 } },
  { label: 'Connected · all copied', drive: { status: 'connected', account: 'studio@example.com' }, copied: { total: 40, copied: 40 } },
  { label: 'The Drive could not be read', drive: { status: 'unread' }, copied: null },
];

export default function DriveCopyLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-4">
      <h1 className="text-sn-2xl font-semibold text-ink">Copy to Google Drive · lab</h1>
      {ROWS.map((r) => (
        <section key={r.label} className="sn-frame space-y-2 p-4" data-lab-row={r.label}>
          <h2 className="text-sn-md font-semibold text-ink/70">{r.label}</h2>
          <CopyEventToDrive eventId={EVENT} eventName="Maria & Jose" drive={r.drive} copied={r.copied} back="/vendor-dashboard/clients" />
        </section>
      ))}
    </main>
  );
}
