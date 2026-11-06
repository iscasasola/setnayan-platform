'use client';

/**
 * download-pick.tsx — Download ▾ on the Categories page (🌳 ③b; PLAN § 7.5): ONE dropdown, two choices,
 * each a FILE from `/admin/categories/export` (which re-checks admin). A file is not a page, so the pick
 * navigates the window (the response is an attachment) instead of the client router, which would try to
 * render it.
 */
import { PickMenu } from '@/app/dashboard/[eventId]/website/editor/_components/pick-menu';

export function DownloadPick({ pdfHref, csvHref }: { pdfHref: string; csvHref: string }) {
  return (
    <span data-download-pick="">
      <PickMenu
        label="Download"
        value=""
        buttonText="⤓ Download"
        compact
        className="border border-ink/15"
        options={[
          { key: 'pdf', label: 'Printable tree (PDF)', hint: 'A4 · follows Show ▾ and the search' },
          { key: 'csv', label: 'Spreadsheet (CSV)', hint: 'one row per service × part link' },
        ]}
        onPick={(key) => {
          window.location.assign(key === 'pdf' ? pdfHref : csvHref);
        }}
      />
    </span>
  );
}
