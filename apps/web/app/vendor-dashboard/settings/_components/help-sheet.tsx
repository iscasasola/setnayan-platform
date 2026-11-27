'use client';

/**
 * ❓ SETTINGS › HELP OPENS AS A SMALL SHEET (final check B6 · A5-G2-14, drawing `final-check-area-5_2026-11-25.html`
 * § B6, approved 25 Nov). The Help row opens the shared `Sheet` — from the bottom on a phone, sized to its five rows;
 * a centred dialog from the tablet line — titled "Help", with the same five doors (`SUPPLIER_HELP_ROWS`). The old
 * address `/vendor-dashboard/help` forwards to Settings with the sheet open (`?help=1`), so the avatar's Help tile and
 * any bookmark still land on it.
 * 🔒 app/vendor-dashboard/settings/help-opens-as-a-sheet.test.ts
 */
import { useId, useState, type ReactNode } from 'react';
import { Sheet } from '@/app/_components/sheet';
import { DatesRow } from '../../customers/_components/dates-row';
import { SUPPLIER_HELP_ROWS } from '../settings-rows';

export function HelpSheetRow({ lead, initialOpen = false }: { lead: ReactNode; initialOpen?: boolean }) {
  const [open, setOpen] = useState(initialOpen);
  const headingId = useId();
  return (
    <>
      <DatesRow
        data="settings-help"
        lead={lead}
        title="Help"
        line="How fees work · how booking works · report a problem"
        onOpen={() => setOpen(true)}
      />
      <Sheet open={open} onClose={() => setOpen(false)} labelledById={headingId}>
        <div className="px-5 pb-6 pt-5" data-supplier-help="">
          <h2 id={headingId} className="pr-12 text-sn-xl font-semibold text-ink">
            Help
          </h2>
          <div className="mt-2">
            {SUPPLIER_HELP_ROWS.map((r) => (
              <DatesRow key={r.key} data={`help-${r.key}`} title={r.title} line={r.line} href={r.href} />
            ))}
          </div>
        </div>
      </Sheet>
    </>
  );
}
