import Link from 'next/link';
import { HUB_THEMES, INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
import {
  CLASSIC_PRINT_THEME,
  PRINT_PIECES,
  PRINT_SET_KEYS,
  isThemedPrint,
  printAccess,
  printFileName,
  spotLayersFor,
  dieCutFor,
  formatFamilyOf,
  formatsFor,
  type PrintFormat,
  type PrintFormatId,
} from '@/lib/print-pieces';
import { freePrints } from '@/lib/free-prints';
import { MAKER_DETAILS_LABEL } from './maker-bar';
import { PrintSaveButton } from './print-save-button';
import { PrintPreview } from './print-preview';

/**
 * PRINTS & TICKETS — the third group of the Event Hub Maker's bar (Phase 9).
 * It holds EVERY print the couple can make (owner 2026-09-25, DECISION_LOG
 * "PRINTS & TICKETS HOLDS EVERY PRINT"), in two groups:
 *
 *   1. THE FREE GROUP (`lib/free-prints.ts`) — the guest list registry, the
 *      guests' QR codes, the 2D seat plan, table signs & place cards, the
 *      caterer's meal counts and the event QR. Open to every event and shown
 *      in the app-store shell: none of them is a purchase. Each is LINKED to
 *      the route that already draws it; only the registry is new.
 *   2. THE INVITATION SET — invitation cards, pass, poster, event card. Owner,
 *      the same day: *"let's allow free for all? but if they want to print
 *      with theme is pro?"* → *"oaky build it that way."* So every piece saves
 *      PRINT-READY in CLASSIC for everyone, and in the couple's own theme with
 *      Event Hub Pro. Without Pro a themed piece is a SAMPLE — a flattened,
 *      watermarked, low-resolution JPEG with placeholder QRs — and the web
 *      says "Go Pro to print in <theme>". In the store shell the themed
 *      print-ready buttons are ABSENT and no pitch or price is printed (App
 *      Review 3.1.1).
 *
 * Every button SAVES a file and never opens a page (`PrintSaveButton`).
 *
 * 🔒 THE GATE IS THE ROUTE'S, NOT THIS PAGE'S. A themed print-ready control
 * that is absent here is also refused there (403) — hiding a button is never
 * the lock (`mayServe` in lib/print-pieces.ts).
 *
 * Server component; no client state of its own and NO WRITES — what the set
 * includes and its wording are set in the Maker's Details panel.
 */
export function MakerPrints({
  eventId,
  slug,
  theme,
  savedTheme,
  ownsPro,
  storeShell,
  flash,
  formats,
  seatPlan = 'none',
}: {
  /** The Details toggle: which seating print the couple offers beside the set. */
  seatPlan?: 'none' | '3d' | '2d' | 'list';
  /** The event's address — names every saved file and draws the event QR. */
  slug: string | null;
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
  const themed = isThemedPrint(theme);
  const spot = spotLayersFor(theme);
  const sizes = `&pass_format=${formats.pass.id}&invitation_format=${formats.invitation.id}&card_format=${formats.card.id}`;
  /** A piece in the theme on screen (the saved one unless previewing). */
  const q = (piece: string, mode: 'screen' | 'sample' | 'print') =>
    `/api/hub-print/${piece}?event=${eventId}&mode=${mode}${theme !== savedTheme ? `&theme=${theme}` : ''}${sizes}`;
  /** The same piece in CLASSIC — print-ready and free for every event. */
  const classic = (piece: string) => `/api/hub-print/${piece}?event=${eventId}&mode=print&theme=${CLASSIC_PRINT_THEME}${sizes}`;
  const themeWord = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const file = {
    classic: (p: string) => printFileName(slug, p),
    themed: (p: string) => printFileName(slug, `${p}-${themeWord}`),
    sample: (p: string) => printFileName(slug, `${p}-sample`, 'jpg'),
  };
  const hrefWith = (next: { theme?: InviteThemeId; family?: PrintFormat['for']; format?: PrintFormatId }) => {
    const t2 = next.theme ?? theme;
    const f = { pass: formats.pass.id, invitation: formats.invitation.id, card: formats.card.id };
    if (next.family && next.format) f[next.family] = next.format;
    return `/dashboard/${eventId}/launch?tool=prints${t2 !== savedTheme ? `&print_theme=${t2}` : ''}&pass_format=${f.pass}&invitation_format=${f.invitation}&card_format=${f.card}`;
  };
  const previewHref = (id: InviteThemeId) => hrefWith({ theme: id });

  return (
    <div data-maker-prints="" className="h-full overflow-y-auto bg-cream px-4 py-5 sm:px-6">
      <div className="mx-auto flex max-w-6xl flex-col gap-6">
        <header className="flex flex-col gap-2">
          <p className="font-serif text-2xl text-ink">Prints &amp; Tickets</p>
          <p className="max-w-2xl text-sm text-ink/70">
            Every print for your day, in one place. Each button saves a file to your phone or computer — hand it to any
            printer.
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

        {/* ══ 1 · THE FREE GROUP — every event, store shell included. ══ */}
        <section data-prints-free-group="" aria-labelledby="prints-free-title" className="flex flex-col gap-3">
          <div className="flex flex-col gap-0.5">
            <h2 id="prints-free-title" className="font-serif text-xl text-ink">
              For the day
            </h2>
            <p className="text-sm text-ink/65">
              Free for every event — your guest list and seating, ready to print.{' '}
              {/* Names, parents and tables on these prints come from the Guest list —
                  the one place to fix them (DECISION_LOG 2026-09-25 "PRINT CONTENT
                  COMES FROM WHERE IT ALREADY LIVES"). */}
              <Link
                href={`/dashboard/${eventId}/guests`}
                className="inline-flex min-h-10 items-center font-medium text-link underline-offset-2 hover:underline"
              >
                Edit names on your Guest list →
              </Link>
            </p>
          </div>
          <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {freePrints(eventId, slug).map((fp) => (
              <li
                key={fp.key}
                data-free-print={fp.key}
                className="sn-glass-bare flex gap-3 rounded-xl p-3"
              >
                <div className="flex h-[132px] w-[96px] shrink-0 items-center justify-center overflow-hidden rounded-lg bg-white ring-1 ring-ink/10">
                  {/* eslint-disable-next-line @next/next/no-img-element -- a generated preview from our own route (SVG page 1 / the QR PNG) */}
                  <img src={fp.preview} alt={`${fp.label} — preview`} loading="lazy" className="max-h-full max-w-full object-contain" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col gap-1.5">
                  <p className="text-sm font-semibold text-ink">{fp.label}</p>
                  <p className="text-xs leading-snug text-ink/60">{fp.blurb}</p>
                  <div className="mt-auto flex flex-wrap gap-x-3 gap-y-1">
                    {fp.saves.map((s, i) => (
                      <PrintSaveButton key={s.href} href={s.href} file={s.file} variant={i === 0 ? 'secondary' : 'link'}>
                        {s.label}
                      </PrintSaveButton>
                    ))}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </section>

        {/* ══ 2 · THE INVITATION SET — Classic free, the theme Pro. ══ */}
        <section data-prints-set="" aria-labelledby="prints-set-title" className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 id="prints-set-title" className="font-serif text-xl text-ink">
              Your invitation set
            </h2>
            <p className="max-w-2xl text-sm text-ink/65">
              Invitation cards, passes, a welcome poster and an event card, drawn in{' '}
              <span className="font-semibold text-ink">{t.name}</span>. Print uses your{' '}
              <span className="font-semibold text-ink">ceremony</span> time from your schedule.
            </p>
          </div>

          {/* The access line — what these files are, said plainly. */}
          <div
            data-prints-access={!themed ? 'classic' : access.printReady ? 'print-ready' : 'sample'}
            className="sn-glass-bare flex flex-col gap-3 rounded-xl px-4 py-3"
          >
            <p className="text-sm text-ink/75">
              <span className="font-semibold text-ink">Classic prints are free and print-ready</span> — 3 mm bleed and crop
              marks, no watermark.{' '}
              {!themed ? null : access.printReady ? (
                <>
                  With Event Hub Pro they print in <span className="font-semibold text-ink">{t.name}</span> too
                  {spot.foil || spot.whiteInk
                    ? `, with ${[spot.foil ? 'foil' : null, spot.whiteInk ? 'white ink' : null].filter(Boolean).join(' and ')} on their own layers`
                    : ''}
                  .
                </>
              ) : (
                <>
                  In {t.name} these are samples — low-resolution pictures marked &ldquo;Sample&rdquo;, with placeholder QR
                  codes, so you can see your own names on every piece.
                </>
              )}
            </p>
            {themed && access.offerPro ? (
              <p data-prints-go-pro="" className="text-sm font-medium text-mulberry">
                Go Pro to print in {t.name}.
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <PrintSaveButton href={classic('set')} file={file.classic('set')} variant={themed && access.printReady ? 'secondary' : 'primary'}>
                Whole set · Classic (PDF)
              </PrintSaveButton>
              <PrintSaveButton href={classic('passes')} file={file.classic('passes')}>
                Every guest&rsquo;s pass · Classic
              </PrintSaveButton>
              {themed && access.printReady ? (
                <>
                  <PrintSaveButton href={q('set', 'print')} file={file.themed('set')} variant="primary">
                    <span data-prints-print-ready="">Whole set · {t.name} (PDF)</span>
                  </PrintSaveButton>
                  <PrintSaveButton href={q('passes', 'print')} file={file.themed('passes')}>
                    <span data-prints-passes="">Every guest&rsquo;s pass · {t.name}</span>
                  </PrintSaveButton>
                </>
              ) : themed ? (
                <PrintSaveButton href={q('set', 'sample')} file={file.sample('set')}>
                  Sample sheet · {t.name} (JPG)
                </PrintSaveButton>
              ) : null}
            </div>
            <p className="text-xs text-ink/55">Passes print {formats.pass.label} size, ganged on A4 with cut lines.</p>
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
                  {/* The server render takes real seconds — PrintPreview shows
                      "Drawing your…" while it loads and an honest Retry on error,
                      never a silent grey box (rd/maker-phone-polish). */}
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
                  <div className="flex flex-wrap justify-center gap-x-4 gap-y-1">
                    <PrintSaveButton href={classic(k)} file={file.classic(k)} variant="link">
                      {themed ? 'Save · Classic (PDF)' : 'Save PDF'}
                    </PrintSaveButton>
                    {themed && access.printReady ? (
                      <PrintSaveButton href={q(k, 'print')} file={file.themed(k)} variant="link">
                        Save · {t.name} (PDF)
                      </PrintSaveButton>
                    ) : themed ? (
                      <PrintSaveButton href={q(k, 'sample')} file={file.sample(k)} variant="link">
                        Sample · {t.name} (JPG)
                      </PrintSaveButton>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>

        {seatPlan === '3d' ? (
          <p className="text-sm text-ink/70" data-prints-seat-plan="3d">
            Your 3D plan prints from the plan itself —{' '}
            <Link href={`/dashboard/${eventId}/plan3d`} className="font-medium text-mulberry underline underline-offset-2">
              open the 3D plan
            </Link>
            . The 2D plan, table signs and place cards are above.
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
