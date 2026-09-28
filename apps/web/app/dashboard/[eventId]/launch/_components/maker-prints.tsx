import Link from 'next/link';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
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
  isPrintPieceKey,
  menuHasDishes,
  type MenuMoment,
  type PrintFormat,
  type PrintFormatId,
  type PrintSetKey,
} from '@/lib/print-pieces';
import { freePrints, type FreePrint } from '@/lib/free-prints';
import { detailsItemHref } from '@/lib/maker-details-items';
import { PrintSaveButton } from './print-save-button';
import { PaidMark } from '@/app/_components/paid-mark';
import { paidMarkLabel } from '@/lib/paid-mark';
import { PrintPreview } from './print-preview';
import { PrintChoicePicker } from './print-choice-picker';
import { PrintMenuEditor } from './print-menu-editor';

/**
 * THE PRINTS, AS PARTS OF THE DETAILS PAGE. Until 2026-09-28 this file drew
 * "Prints & Tickets", a Maker page of its own. Owner, verbatim: *"1 fold prints
 * and tickets into details"* (DECISION_LOG "PRINTS & TICKETS FOLDS INTO
 * DETAILS"): every print is now an ITEM of Details — its picture in the body,
 * its editor on the right (`maker-details.tsx` composes them). Nothing it did
 * is lost: the sizes, the downloads, the whole set, the fast previews (#6078).
 *
 * Every print the couple can make, in two groups (DECISION_LOG 2026-09-25
 * "PRINTS & TICKETS HOLDS EVERY PRINT"):
 *
 *   1. THE FREE GROUP (`lib/free-prints.ts`) — the guest list registry, the
 *      guests' QR codes, the 2D seat plan, table signs & place cards, the
 *      caterer's meal counts and the event QR. Open to every event and shown
 *      in the app-store shell: none of them is a purchase.
 *   2. THE INVITATION SET — every piece saves PRINT-READY in CLASSIC for
 *      everyone, and in the couple's theme with Event Hub Pro (owner: *"let's
 *      allow free for all? but if they want to print with theme is pro?"*).
 *      Without Pro a themed piece is a SAMPLE — flattened, watermarked, low
 *      resolution — and the web says "Go Pro to print in <theme>". In the store
 *      shell the themed print-ready buttons are ABSENT and no pitch or price is
 *      printed (App Review 3.1.1).
 *
 * 🎨 THE THEME IS THE ONE BEING EDITED — the couple's drafted pick, named in
 * every address (a drafted pick is not the live column the route would fall
 * back to). There is no "Preview in" theme dropdown any more: the Theme item's
 * gallery is where themes are looked at (DECISION_LOG "THE THEMES MOVE ONTO THE
 * DETAILS PAGE ITSELF").
 *
 * Every button SAVES a file and never opens a page (`PrintSaveButton`).
 *
 * 🔒 THE GATE IS THE ROUTE'S, NOT THIS PAGE'S. A themed print-ready control
 * that is absent here is also refused there (403) — hiding a button is never
 * the lock (`mayServe` in lib/print-pieces.ts).
 *
 * Server components; no client state and NO WRITES of their own — the one
 * writer here is the Menu editor, which says so.
 */

export type PrintsInput = {
  eventId: string;
  /** The event's address — names every saved file and draws the event QR. */
  slug: string | null;
  /** The theme these pieces are drawn in — the couple's drafted pick. */
  theme: InviteThemeId;
  ownsPro: boolean;
  storeShell: boolean;
  /** The size chosen per family (owner: calling card / train / plane ticket; index card / A5). */
  formats: Record<PrintFormat['for'], PrintFormat>;
  /**
   * ⚡ The hash of everything the pieces are drawn from (`printInputsVersion`),
   * put in each on-screen preview's address as `v` — a versioned preview is
   * cached `immutable` by the route. Null (the read failed): the old 60 s.
   */
  previewVersion?: string | null;
};

/** The addresses and file names every part below shares — computed once, one rule. */
export function printPlan({ eventId, slug, theme, ownsPro, storeShell, formats, previewVersion = null }: PrintsInput) {
  const access = printAccess({ ownsPro, storeShell });
  const t = INVITE_THEMES[theme];
  const themed = isThemedPrint(theme);
  const spot = spotLayersFor(theme);
  /**
   * ⚡ A PIECE'S ADDRESS CARRIES ITS OWN SIZE ONLY (owner 2026-09-28: the
   * boarding-pass preview took ~8 s). The whole set (`set`) is drawn in every
   * family's size, so it alone carries all three.
   */
  const sizesFor = (piece: string, family?: PrintFormat['for'], format?: PrintFormatId) => {
    const f = { pass: formats.pass.id, invitation: formats.invitation.id, card: formats.card.id };
    if (family && format) f[family] = format;
    if (piece === 'set') return `&pass_format=${f.pass}&invitation_format=${f.invitation}&card_format=${f.card}`;
    const fam = isPrintPieceKey(piece) ? formatFamilyOf(piece) : null;
    return fam ? `&${fam}_format=${f[fam]}` : '';
  };
  /** A piece in the theme being edited. */
  const q = (piece: string, mode: 'screen' | 'sample' | 'print', format?: PrintFormatId) =>
    `/api/hub-print/${piece}?event=${eventId}&mode=${mode}&theme=${theme}${sizesFor(
      piece,
      format && isPrintPieceKey(piece) ? (formatFamilyOf(piece) ?? undefined) : undefined,
      format,
    )}${mode === 'screen' && previewVersion ? `&v=${previewVersion}` : ''}`;
  /** The same piece in CLASSIC — print-ready and free for every event. */
  const classic = (piece: string) => `/api/hub-print/${piece}?event=${eventId}&mode=print&theme=${CLASSIC_PRINT_THEME}${sizesFor(piece)}`;
  const themeWord = t.name.toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const file = {
    classic: (p: string) => printFileName(slug, p),
    themed: (p: string) => printFileName(slug, `${p}-${themeWord}`),
    sample: (p: string) => printFileName(slug, `${p}-sample`, 'jpg'),
  };
  /** A size pick is the page's address, landing back on the same piece. */
  const hrefWith = (item: PrintSetKey, next: { family: PrintFormat['for']; format: PrintFormatId }) => {
    const f = { pass: formats.pass.id, invitation: formats.invitation.id, card: formats.card.id };
    f[next.family] = next.format;
    return detailsItemHref(eventId, item, `&pass_format=${f.pass}&invitation_format=${f.invitation}&card_format=${f.card}`);
  };
  return { access, t, themed, spot, sizesFor, q, classic, file, hrefWith, formats };
}

/** The pieces whose size is the couple's to choose — each warms its other sizes. */
const HAS_SIZES = (k: PrintSetKey) => k === 'invitation' || k === 'pass' || k === 'card';

/** What the Menu card prints: the couple's own menu, else their caterer's lines. */
function menuPrints(menu: { saved: MenuMoment[]; caterer: MenuMoment[] }): MenuMoment[] {
  return menuHasDishes(menu.saved) ? menu.saved : menu.caterer;
}

/**
 * A PIECE'S PICTURE — the Details body while the piece is picked. The server
 * render takes real seconds, so `PrintPreview` says "Drawing your…" and offers
 * an honest Retry. `tappable`: the print-only words on it (the opening line,
 * "Kindly reply") are tap targets that open their field on the right.
 */
export function PrintPieceBody({
  input,
  piece: k,
  priority = false,
  menu,
  tappable = false,
}: {
  input: PrintsInput;
  piece: PrintSetKey;
  /** The piece Details opened on — asked for at once, ahead of the rest. */
  priority?: boolean;
  menu?: { saved: MenuMoment[]; caterer: MenuMoment[] };
  tappable?: boolean;
}) {
  const { t, q, formats, theme } = { ...printPlan(input), theme: input.theme };
  const spec = PRINT_PIECES[k];
  const fam = formatFamilyOf(k);
  // The Menu is NEVER offered blank: with no dishes its card shows the "add
  // your menu" prompt and its downloads are not offered.
  const menuEmpty = k === 'menu' && !menuHasDishes(menuPrints(menu ?? { saved: [], caterer: [] }));
  const cut = dieCutFor(theme, k, fam ? formats[fam] : null);
  return (
    <div data-print-piece={k} className="flex flex-col items-center gap-2">
      <PrintPreview
        src={q(k, 'screen')}
        alt={`${spec.label} — ${t.name}`}
        label={spec.label.toLowerCase()}
        priority={priority}
        tappable={tappable}
        /* …and a piece with its OWN size picker warms its other sizes, so a
           pick is instant. Only those three: warming every piece of the
           invitation family too doubled the first open's server requests. */
        prefetch={fam && HAS_SIZES(k) ? formatsFor(fam).filter((f) => f.id !== formats[fam].id).map((f) => q(k, 'screen', f.id)) : []}
      />
      <p className="text-xs text-ink/60">
        {fam ? `${formats[fam].label} · ${formats[fam].wMm} × ${formats[fam].hMm} mm` : spec.size}
        {cut !== 'rect' ? ` · ${cut} cut` : ''}
      </p>
      {menuEmpty ? (
        <Link
          href="#print-menu"
          data-print-menu-add-link=""
          className="inline-flex min-h-11 items-center font-medium text-link underline-offset-2 hover:underline"
        >
          Add your menu
        </Link>
      ) : null}
    </div>
  );
}

/**
 * A PIECE'S EDITOR — its size (ONE dropdown, owner 2026-09-28: *"if there are
 * choices, again. us drop down menu"*), what it includes (handed in by Details
 * as `children`: the include switches and their fields), and its downloads.
 */
export function PrintPieceEditor({
  input,
  piece: k,
  menu,
  children = null,
}: {
  input: PrintsInput;
  piece: PrintSetKey;
  menu?: { saved: MenuMoment[]; caterer: MenuMoment[]; suggestions: string[]; flash: 'saved' | 'error' | null };
  children?: React.ReactNode;
}) {
  const { access, t, themed, q, classic, file, hrefWith, formats } = printPlan(input);
  const spec = PRINT_PIECES[k];
  const fam = formatFamilyOf(k);
  const menuEmpty = k === 'menu' && !menuHasDishes(menuPrints(menu ?? { saved: [], caterer: [], suggestions: [], flash: null }));
  return (
    <div data-print-editor={k} className="flex flex-col gap-3">
      {fam && HAS_SIZES(k) ? (
        <div data-print-formats={fam} className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 pb-2">
          <span className="text-sm text-ink">Size</span>
          <PrintChoicePicker
            label={`${spec.label} size`}
            value={formats[fam].id}
            dataAttr="data-print-format-picker"
            options={formatsFor(fam).map((f) => ({ key: f.id, label: f.label, href: hrefWith(k, { family: fam, format: f.id }) }))}
          />
        </div>
      ) : null}
      {children}
      {/* ══ THE MENU — its moments and dishes (owner 2026-09-28). ══ */}
      {k === 'menu' && menu ? (
        <PrintMenuEditor
          eventId={input.eventId}
          initial={menuHasDishes(menu.saved) || menu.saved.length ? menu.saved : menu.caterer}
          fromCaterer={!menuHasDishes(menu.saved) && !menu.saved.length && menu.caterer.length > 0}
          suggestions={menu.suggestions}
          flash={menu.flash}
        />
      ) : null}
      {menuEmpty ? null : (
        <div className="flex flex-col gap-1.5 border-t border-ink/10 pt-3" data-print-piece-saves={k}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">This piece</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
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
        </div>
      )}
    </div>
  );
}

/**
 * THE FREE GROUP ("For the day") — every event, store shell included. Each
 * entry is an item: its first page in the body, its saves on the right. The
 * whole list, never an entry picked out (`free-prints.test.ts`).
 */
export function freePrintParts(eventId: string, slug: string | null): Array<{ key: FreePrint['key']; label: string; body: React.ReactNode; editor: React.ReactNode }> {
  return freePrints(eventId, slug).map((fp) => ({
    key: fp.key,
    label: fp.label,
    body: (
      <div data-prints-free-group="" data-free-print={fp.key} className="flex flex-col items-center gap-3">
        <div className="flex h-[340px] w-full items-center justify-center overflow-hidden rounded-xl bg-ink/[0.04] p-4">
          {/* eslint-disable-next-line @next/next/no-img-element -- a generated preview from our own route (SVG page 1 / the QR PNG) */}
          <img src={fp.preview} alt={`${fp.label} — preview`} loading="lazy" className="max-h-full max-w-full object-contain drop-shadow-[0_18px_24px_rgba(0,0,0,0.18)]" />
        </div>
        <p className="max-w-md text-center text-xs text-ink/60">{fp.blurb}</p>
      </div>
    ),
    editor: (
      <div className="flex flex-col gap-2" data-free-print-saves={fp.key}>
        <p className="text-xs text-ink/60">
          {/* Names, parents and tables on these prints come from the Guest list —
              the one place to fix them (DECISION_LOG 2026-09-25 "PRINT CONTENT
              COMES FROM WHERE IT ALREADY LIVES"). */}
          Free for every event, from your guest list and seating.
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {fp.saves.map((s, i) => (
            <PrintSaveButton key={s.href} href={s.href} file={s.file} variant={i === 0 ? 'secondary' : 'link'}>
              {s.label}
            </PrintSaveButton>
          ))}
        </div>
      </div>
    ),
  }));
}

/**
 * THE WHOLE SET — the "Download the set" item: every piece, small, in the body;
 * the access line and the whole-set buttons as its editor.
 */
export function PrintSetBody({ input }: { input: PrintsInput }) {
  const { t, q } = printPlan(input);
  return (
    <section data-prints-set="" aria-label="Your invitation set" className="flex flex-col gap-3">
      <p className="max-w-2xl text-sm text-ink/65">
        Invitation cards, passes, a welcome poster and an event card, drawn in{' '}
        <span className="font-semibold text-ink">{t.name}</span>. Print uses your{' '}
        <span className="font-semibold text-ink">ceremony</span> time from your schedule.
      </p>
      <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4" data-prints-pieces="">
        {PRINT_SET_KEYS.map((k) => (
          <li key={k} className="flex flex-col items-center gap-1.5">
            <span className="flex h-40 w-full items-center justify-center rounded-lg bg-ink/[0.04] p-2">
              {/* eslint-disable-next-line @next/next/no-img-element -- a generated preview from our own route, the same cached address as the piece's own */}
              <img src={q(k, 'screen')} alt={`${PRINT_PIECES[k].label} — ${t.name}`} loading="lazy" decoding="async" className="max-h-full max-w-full object-contain" />
            </span>
            <span className="text-[12px] font-medium text-ink/75">{PRINT_PIECES[k].label}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function PrintSetDownloads({ input }: { input: PrintsInput }) {
  const { access, t, themed, spot, q, classic, file, formats } = printPlan(input);
  return (
    <div
      data-prints-access={!themed ? 'classic' : access.printReady ? 'print-ready' : 'sample'}
      className="flex flex-col gap-3"
    >
      <p className="text-sm text-ink/75">
        <span className="font-semibold text-ink">Classic prints are free and print-ready</span> — 3 mm bleed and crop
        marks, no watermark.{' '}
        {!themed ? null : access.printReady ? (
          <>
            <PaidMark state="unlocked" label={paidMarkLabel('unlocked', 'Event Hub Pro')} className="mr-1 align-middle" />
            With Event Hub Pro they print in <span className="font-semibold text-ink">{t.name}</span> too
            {spot.foil || spot.whiteInk
              ? `, with ${[spot.foil ? 'foil' : null, spot.whiteInk ? 'white ink' : null].filter(Boolean).join(' and ')} on their own layers`
              : ''}
            .
          </>
        ) : (
          <>
            In {t.name} these are samples — low-resolution pictures marked &ldquo;Sample&rdquo;, with placeholder QR codes,
            so you can see your own names on every piece.
          </>
        )}
      </p>
      {themed && access.offerPro ? (
        <p data-prints-go-pro="" className="text-sm font-medium text-mulberry">
          <PaidMark state="locked" label={paidMarkLabel('locked', 'Event Hub Pro')} className="mr-1 align-middle" />
          Go Pro to print in {t.name}.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
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
  );
}

/** The 3D plan prints from the plan itself — said on the seat-plan item. */
export function SeatPlan3dNote({ eventId }: { eventId: string }) {
  return (
    <p className="text-sm text-ink/70" data-prints-seat-plan="3d">
      Your 3D plan prints from the plan itself —{' '}
      <Link href={`/dashboard/${eventId}/plan3d`} className="font-medium text-mulberry underline underline-offset-2">
        open the 3D plan
      </Link>
      .
    </p>
  );
}
