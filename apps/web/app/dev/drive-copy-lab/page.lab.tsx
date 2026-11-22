/**
 * /dev/drive-copy-lab — ☁️ "Copy to Google Drive" for a supplier, per event (owner 2026-11-22). DEV-ONLY: production
 * builds never compile this route (`page.lab.tsx`) and `app/dev/layout.lab.tsx` 404s it besides. It draws the REAL
 * `CopyEventToDrive` in each state of the shop's Drive, on fixture data — no sign-in, no database:
 *
 *   every state of Fable's design (22 Nov 2026, `drive_copy_design_2026-11-22_fable.html`), numbered as it numbers
 *   them: 1 not connected · 2 Google paused · 3 not set up yet · 4–6 connected (none · part · all copied) · 7 copying
 *   (its track) · 8 some failed · 9a–9d the failures said.
 *
 * Rows 4, 5, 7, 8, 9a and 9b answer a press from `LabScriptedCopy` (a lab-only stand-in for the copy route, keyed by
 * the row's event id) so the press-only states can be pressed and seen.
 */
import { notFound } from 'next/navigation';
import { CopyEventToDrive } from '@/app/vendor-dashboard/_components/copy-event-to-drive';
import type { ShopDriveState } from '@/lib/supplier-drive-copy';
import { LabScriptedCopy } from './lab-scripted-copy';

const EVENT = '00000000-0000-4000-8000-00000000d71e';
const ON: ShopDriveState = { status: 'connected', account: 'studio@example.com' };
// Press-only states: the row's event id picks a scripted answer from `LabScriptedCopy` (press Copy to see it).
const ROWS: { label: string; eventId?: string; drive: ShopDriveState; copied: { total: number; copied: number } | null }[] = [
  { label: '1 · Not connected', drive: { status: 'not_connected' }, copied: { total: 0, copied: 0 } },
  { label: '2 · Google paused our access', drive: { status: 'needs_reconnect', account: 'studio@example.com' }, copied: { total: 12, copied: 9 } },
  { label: '3 · Drive not set up by Setnayan yet', drive: { status: 'not_configured' }, copied: { total: 0, copied: 0 } },
  { label: '4 · Connected · not copied yet', eventId: '00000000-0000-4000-8000-0000000000d5', drive: ON, copied: { total: 0, copied: 0 } },
  { label: '5 · Connected · part copied', eventId: '00000000-0000-4000-8000-0000000000d1', drive: ON, copied: { total: 40, copied: 12 } },
  { label: '6 · Connected · all copied', drive: ON, copied: { total: 40, copied: 40 } },
  { label: '7 · Copying (press Copy)', eventId: '00000000-0000-4000-8000-0000000000d6', drive: ON, copied: { total: 400, copied: 0 } },
  { label: '8 · Some failed (press Copy)', eventId: '00000000-0000-4000-8000-0000000000d2', drive: ON, copied: { total: 40, copied: 30 } },
  { label: '9a · Files unread (press Copy)', eventId: '00000000-0000-4000-8000-0000000000d3', drive: ON, copied: { total: 40, copied: 30 } },
  { label: '9b · Copy stopped (press Copy)', eventId: '00000000-0000-4000-8000-0000000000d4', drive: ON, copied: { total: 40, copied: 30 } },
  { label: '9c · The Drive could not be read', drive: { status: 'unread' }, copied: null },
  { label: '9d · The copied count could not be read', drive: ON, copied: null },
];

export default function DriveCopyLab() {
  if (process.env.NODE_ENV === 'production') notFound();
  return (
    <main className="mx-auto w-full max-w-3xl space-y-6 px-4 pb-24 pt-4">
      <h1 className="text-sn-2xl font-semibold text-ink">Copy to Google Drive · lab</h1>
      <LabScriptedCopy />
      {ROWS.map((r) => (
        <section key={r.label} className="space-y-2" data-lab-row={r.label}>
          <h2 className="text-sn-md font-semibold text-ink/60">{r.label}</h2>
          <div className="sn-frame py-1">
            <CopyEventToDrive eventId={r.eventId ?? EVENT} eventName="Maria & Jose" drive={r.drive} copied={r.copied} back="/vendor-dashboard/clients" />
          </div>
        </section>
      ))}
    </main>
  );
}
