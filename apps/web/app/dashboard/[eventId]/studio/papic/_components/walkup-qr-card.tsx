import { Hand } from 'lucide-react';
import { renderUrlQrSvg } from '@/lib/qr';
import { CopyButton } from '../crew/_components/copy-button';

// Walk-up camera QR (Papic_Walkup_Face_Identity_Plan_2026-06-29 §1, §5).
//
// The host prints/shows this so a guest who ISN'T on the list can scan it, get a
// camera with no name and no sign-in, and start shooting — their shots land in
// the host's gallery. The QR encodes /papic/join/<events.papic_walkup_token>
// (a dedicated guest-facing token, separate from the crew master QR). The page
// renders this only when guest cameras are active; the join route + RPC re-gate.
//
// SVG QR is generated server-side from our own URL (no user input) — same
// inline-SVG pattern as the crew Event QR page.

export async function WalkupQrCard({
  token,
  appUrl,
}: {
  token: string;
  appUrl: string;
}) {
  const joinUrl = `${appUrl}/papic/join/${token}`;
  const qrSvg = await renderUrlQrSvg(joinUrl, 180);

  return (
    <div className="rounded-xl border border-ink/10 bg-cream/70 p-4 sm:p-5">
      <div className="mb-3">
        <p className="flex items-center gap-2 text-sm font-semibold text-ink">
          <Hand aria-hidden className="h-4 w-4 text-terracotta" strokeWidth={2} />
          Walk-up camera — no guest list needed
        </p>
        <p className="text-xs text-ink/60">
          Print or show this at your event. Any guest scans it to get their own
          camera — no name, no sign-in — and their shots land in your gallery.
        </p>
      </div>
      <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center">
        <div
          className="h-[180px] w-[180px] shrink-0 rounded-lg bg-surface p-2"
          dangerouslySetInnerHTML={{ __html: qrSvg }}
        />
        <div className="min-w-0 space-y-2">
          <p className="break-all rounded-md bg-surface px-2 py-1 text-xs text-ink/70">
            {joinUrl}
          </p>
          <CopyButton value={joinUrl} label="Copy walk-up link" />
        </div>
      </div>
    </div>
  );
}
