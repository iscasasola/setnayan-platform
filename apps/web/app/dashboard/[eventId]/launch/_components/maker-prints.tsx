import Link from 'next/link';
import { Download, FileCheck2, QrCode } from 'lucide-react';
import { HUB_THEMES, INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import {
  PRINT_PIECES,
  PRINT_SET_KEYS,
  printAccess,
  spotLayersFor,
  dieCutFor,
  formatFamilyOf,
  formatsFor,
  type PrintFormat,
  type PrintFormatId,
} from '@/lib/print-pieces';
import { MAKER_DETAILS_LABEL } from './maker-bar';
import { PrintPreview } from './print-preview';

/**
 * PRINTS & TICKETS — the third group of the Event Hub Maker's bar (Phase 9).
 *
 * Owner rulings (DECISION_LOG 2026-09-24/25): the printed set MATCHES the Event
 * Hub (one theme, chosen once) · everybody sees SAMPLES, compressed and marked;
 * the PRINT-READY file is Event Hub Pro · the free do-it-yourself QR PDF lives on
 * the GUEST LIST, and this workspace points there in one line.
 *
 * Every piece on this screen is drawn by `/api/hub-print/<piece>?mode=screen`
 * from the one layout the PDF uses. For Pro that is the unmarked vector; for
 * everyone else it is the flattened, low-resolution JPEG with the tiled
 * "SAMPLE · SETNAYAN" watermark burned in and placeholder QRs (owner: "they
 * cannot simply edit and remove watermark easily"). The couple picks a SIZE per
 * family (`PRINT_FORMATS`): pass = calling card / ID card / train ticket /
 * boarding pass; cards = 5 × 7 / A5 / index card.
 *
 * 🔒 THE GATE IS THE ROUTE'S, NOT THIS PAGE'S. A Pro control that is absent
 * here is also refused there (403) — hiding a button is never the lock.
 * In the app-store shell the Pro path is ABSENT, not locked, and no price or
 * pitch is printed (App Review 3.1.1).
 *
 * Server component; no client state and NO WRITES — what the set includes and
 * its wording are set in the Maker's Details panel (`maker-details.tsx`).
 *
 * Each preview image is `<PrintPreview>` (`./print-preview.tsx`), the one
 * client component this file reaches for: the server render behind
 * `/api/hub-print` takes real seconds, and a bare `<img>` sat as a blank
 * `bg-ink/[0.04]` box the whole time — grey and silent reads as broken. That
 * shared box owns loading (shimmer + "Drawing your…") and error (an honest
 * line + Retry) so every piece on this screen, and any other surface that
 * draws from the same route, tells the same truth the same way.
 */
export function MakerPrints({
  eventId,
  theme,
  savedTheme,
  ownsPro,
  storeShell,
  flash,
  formats,
  seatPlan = 'none',
}: {
  /** The Details toggle: which seating print to offer beside the set. */
  seatPlan?: 'none' | '3d' | '2d' | 'list';
  /** The size chosen per family (owner: calling card / train / plane ticket; index card / A5). */
  formats: Record<PrintFormat['for'], PrintFormat>;
  eventId: string;
  /** The theme these samples are drawn in (the saved one, or a preview). */
  theme: InviteThemeId;
  /** The couple's saved theme — what "Your theme" means. */
  savedTheme: InviteThemeId;
  ownsPro: boolean;
  storeShell: boolean;
  flash: 'saved' | 'error' | null;
}) {
  const access = printAccess({ ownsPro, storeShell });
  const t = INVITE_THEMES[theme];
  const spot = spotLayersFor(theme);
  const sizes = `&pass_format=${formats.pass.id}&invitation_format=${formats.invitation.id}&card_format=${formats.card.id}`;
  const q = (piece: string, mode: 'screen' | 'sample' | 'print') =>
    `/api/hub-print/${piece}?event=${eventId}&mode=${mode}${theme !== savedTheme ? `&theme=${theme}` : ''}${sizes}`;
  const hrefWith = (next: { theme?: InviteThemeId; family?: PrintFormat['for']; format?: PrintFormatId }) => {
    const t2 = next.theme ?? theme;
    const f = { pass: formats.pass.id, invitation: formats.invitation.id, card: formats.card.id };
    if (next.family && next.format) f[next.family] = next.format;
    return `/dashboard/${eventId}/launch?tool=prints${t2 !== savedTheme ? `&print_theme=${t2}` : ''}&pass_format=${f.pass}&invitation_format=${f.invitation}&card_format=${f.card}`;
  };
  const previewHref = (id: InviteThemeId) => hrefWith({ theme: id });

  return (
    <div data-maker-prints="" className="h-full overflow-y-auto bg-cream px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-5">
        <header className="flex flex-col gap-2">
          <p className="font-serif text-2xl text-ink">Prints &amp; Tickets</p>
          <p className="max-w-2xl text-sm text-ink/70">
            Your invitation set, passes and poster, drawn in <span className="font-semibold text-ink">{t.name}</span> — the
            same look as your Event Hub. Print uses your <span className="font-semibold text-ink">ceremony</span> time
            from your schedule.
          </p>
          <p className="text-sm text-ink/70" data-prints-qr-pointer="">
            <QrCode aria-hidden className="mr-1 inline h-4 w-4 align-[-3px]" strokeWidth={1.75} />
            Just the QR codes?{' '}
            <Link href={`/dashboard/${eventId}/guests`} className="font-medium text-mulberry underline underline-offset-2">
              Download them from your Guest list.
            </Link>
          </p>
        </header>

        {flash === 'saved' ? (
          <p role="status" className="rounded-md border border-success-300/60 bg-success-50 px-4 py-2 text-sm text-success-800">
            Saved — your cards now carry these words.
          </p>
        ) : flash === 'error' ? (
          <p role="alert" className="rounded-md border border-danger-300/60 bg-danger-50 px-4 py-2 text-sm text-danger-800">
            That did not save. Nothing changed — please try again.
          </p>
        ) : null}

        {/* The access line — what these files are, said plainly. */}
        <div
          data-prints-access={access.printReady ? 'print-ready' : 'sample'}
          className="sn-glass-bare flex flex-col gap-3 rounded-xl px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <p className="text-sm text-ink/75">
            {access.printReady ? (
              <>
                <span className="font-semibold text-ink">Print-ready.</span> 3 mm bleed, crop marks
                {spot.foil || spot.whiteInk
                  ? `, and ${[spot.foil ? 'foil' : null, spot.whiteInk ? 'white ink' : null].filter(Boolean).join(' and ')} on their own layers`
                  : ''}{' '}
                — hand the file to any printer.
              </>
            ) : (
              <>
                <span className="font-semibold text-ink">These are samples</span> — low-resolution pictures marked
                &ldquo;Sample&rdquo;, with placeholder QR codes, so you can see your own names on every piece.
                {access.offerPro ? ' Event Hub Pro makes them print-ready.' : ''}
              </>
            )}
          </p>
          <div className="flex flex-wrap gap-2">
            <a href={q('set', 'sample')} download className="button-secondary inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
              <Download aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Download sample sheet
            </a>
            {access.printReady ? (
              <>
                <a href={q('set', 'print')} download data-prints-print-ready="" className="button-primary inline-flex items-center gap-1.5 whitespace-nowrap text-sm">
                  <FileCheck2 aria-hidden className="h-4 w-4" strokeWidth={1.75} /> Print-ready PDF
                </a>
                <a href={q('passes', 'print')} download data-prints-passes="" className="button-secondary inline-flex items-center gap-1.5 text-sm">
                  Every guest&rsquo;s pass &middot; {formats.pass.label} (PDF)
                </a>
              </>
            ) : null}
          </div>
        </div>

        {/* Preview the set in another theme — a preview only; the theme is chosen in the Maker's Theme panel. */}
        <nav aria-label="Preview the set in a theme" className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none]">
          {HUB_THEMES.filter((x) => x.ready).map((x) => (
            <Link
              key={x.id}
              href={previewHref(x.id)}
              aria-current={x.id === theme ? 'true' : undefined}
              className={`inline-flex min-h-9 shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-medium transition-colors ${
                x.id === theme ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10 hover:text-ink'
              }`}
            >
              <span aria-hidden className="h-3 w-3 rounded-full border border-ink/15" style={{ background: x.palette.accent }} />
              {x.name}
              {x.id === savedTheme ? <span className="text-[11px] opacity-70">· yours</span> : null}
            </Link>
          ))}
        </nav>

        <ul className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3" data-prints-pieces="">
          {PRINT_SET_KEYS.map((k) => {
            const spec = PRINT_PIECES[k];
            const fam = formatFamilyOf(k);
            return (
              <li key={k} data-print-piece={k} className="flex flex-col items-center gap-2">
                <PrintPreview
                  src={q(k, 'screen')}
                  alt={`${spec.label} — ${t.name}`}
                  label={spec.label.toLowerCase()}
                />
                <p className="text-sm font-semibold text-ink">{spec.label}</p>
                <p className="text-xs text-ink/60">
                  {fam ? `${formats[fam].label} · ${formats[fam].wMm} × ${formats[fam].hMm} mm` : spec.size}
                  {dieCutFor(theme, k) !== 'rect' ? ` · ${dieCutFor(theme, k)} cut` : ''}
                </p>
                {fam && (k === 'invitation' || k === 'pass' || k === 'card') ? (
                  <div role="group" aria-label={`${spec.label} size`} data-print-formats={fam} className="flex flex-wrap justify-center gap-1">
                    {formatsFor(fam).map((f) => (
                      <Link
                        key={f.id}
                        href={hrefWith({ family: fam, format: f.id })}
                        aria-current={f.id === formats[fam].id ? 'true' : undefined}
                        className={`inline-flex min-h-8 items-center rounded-full px-2.5 text-[12px] font-medium ${
                          f.id === formats[fam].id ? 'bg-ink text-cream' : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                        }`}
                      >
                        {f.label}
                      </Link>
                    ))}
                  </div>
                ) : null}
                <div className="flex flex-wrap justify-center gap-2">
                  <a href={q(k, 'sample')} download className="text-sm font-medium text-mulberry underline underline-offset-2">
                    Download sample (JPG)
                  </a>
                  {access.printReady ? (
                    <a href={q(k, 'print')} download className="text-sm font-medium text-mulberry underline underline-offset-2">
                      Print-ready PDF
                    </a>
                  ) : null}
                </div>
              </li>
            );
          })}
        </ul>

        {seatPlan !== 'none' ? (
          <p className="text-sm text-ink/70" data-prints-seat-plan={seatPlan}>
            Your seat plan prints from the Seat plan itself —{' '}
            <Link
              href={seatPlan === '3d' ? `/dashboard/${eventId}/plan3d` : `/dashboard/${eventId}/seating/print`}
              className="font-medium text-mulberry underline underline-offset-2"
            >
              open the {seatPlan === '3d' ? '3D plan' : seatPlan === '2d' ? '2D plan' : 'seating list'}
            </Link>
            .
          </p>
        ) : null}
        <p className="text-sm text-ink/70" data-prints-details-pointer="">
          What your cards include — parents, E-Gifts, the program, your colours, an NFC spot — and every line of wording
          are set in{' '}
          <Link href={`/dashboard/${eventId}/launch?tool=details`} className="font-medium text-mulberry underline underline-offset-2">
            {MAKER_DETAILS_LABEL}
          </Link>
          .
        </p>
      </div>
    </div>
  );
}
