import Link from 'next/link';
import { FREE_THEMES, INVITE_THEMES, themeNames, type InviteThemeId } from '@/lib/invite-themes';
import {
  CLASSIC_PRINT_THEME,
  PRINT_FORMATS,
  PRINT_PIECES,
  PRINT_SET_KEYS,
  isProPrint,
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
  type PosterPhoto,
  type PrintSetKey,
} from '@/lib/print-pieces';
import { freePrints, type FreePrint } from '@/lib/free-prints';
import { detailsItemHref } from '@/lib/maker-details-items';
import { PaidMark } from '@/app/_components/paid-mark';
import { makerProMark, paidMarkLabel } from '@/lib/paid-mark';
import {
  DEFAULT_PASS_CARD_DESIGN,
  PASS_CARD_DESIGNS,
  PASS_CARD_FORMAT_ID,
  PASS_CARDS_ZIP_ROUTE,
  PASS_CARD_WORDS,
  type PassCardDesign,
} from '@/lib/pass-card';
/* ⚡ The print pieces load when Details is opened — never with the Maker (`details-lazy.tsx`). */
import { ChangedSincePrinted, PassCardDesignPicker, PosterPhotoPicker, PrintChoicePicker, PrintMenuEditor, PrintPreview, PrintSaveButton } from './details-lazy';
import { DetailsGoTo } from './details-go';

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
 *      Without Pro a PRO-themed piece is a SAMPLE — flattened, watermarked, low
 *      resolution — and the web says "Go Pro to print in <theme>". In the store
 *      shell the Pro-themed print-ready buttons are ABSENT and no pitch or price
 *      is printed (App Review 3.1.1). A FREE theme (owner 2026-09-29: Modern and
 *      Cyber Neon beside Classic — `isProPrint`, the registry's tier) prints
 *      print-ready for everyone, like Classic, store shell included.
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
   * No Love Story to print yet — the Our Story poster is then never offered
   * for download (the route refuses it too); its picture says where the
   * story comes from and a button opens Details › Love Story in place.
   */
  storyEmpty?: boolean;
  /** 🖼 The Our Story poster's own photo, when the couple chose one (`print_details.poster_photo`). */
  posterPhoto?: PosterPhoto | null;
  /** The couple's saved pass card look (`print_details.pass_design`). */
  passDesign?: PassCardDesign;
  /** The zip's file name — `<Couple>-<date>-passes.zip` (`passCardsZipFileName`). */
  passCardsZip?: string;
  /**
   * ⚡ The hash of everything the pieces are drawn from (`printInputsVersion`),
   * put in each on-screen preview's address as `v` — a versioned preview is
   * cached `immutable` by the route. Null (the read failed): the old 60 s.
   */
  previewVersion?: string | null;
  /**
   * ✍ A hash of the couple's DRAFTED facts (names, date, name style, 🕒
   * ceremony time), when there are any — each on-screen preview's address
   * carries it as `draft`, so the route draws the draft and a new draft is a
   * new address (owner 2026-10-04: the invitation shows the new time before
   * Apply). Null / absent: the preview is drawn from what is live.
   */
  draftVersion?: string | null;
};

/** The addresses and file names every part below shares — computed once, one rule. */
export function printPlan({ eventId, slug, theme, ownsPro, storeShell, formats, previewVersion = null, draftVersion = null }: PrintsInput) {
  const access = printAccess({ ownsPro, storeShell });
  const t = INVITE_THEMES[theme];
  // "Themed" = not Classic (a file that names its theme, a "· Classic" twin
  // beside it). "Free" = the registry says every couple may print it — Classic,
  // Modern, Cyber Neon (owner 2026-09-29). Only a PRO theme without Pro is a
  // sample; a free theme prints print-ready, unwatermarked, for everyone.
  const themed = isThemedPrint(theme);
  const freeTheme = !isProPrint(theme);
  const themedReady = themed && (freeTheme || access.printReady);
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
    )}${mode === 'screen' && previewVersion ? `&v=${previewVersion}` : ''}${mode === 'screen' && draftVersion ? `&draft=${draftVersion}` : ''}`;
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
  return { access, t, themed, freeTheme, themedReady, spot, sizesFor, q, classic, file, hrefWith, formats };
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
  // The Our Story poster likewise, until there is a Love Story to print.
  const storyMissing = k === 'story-poster' && Boolean(input.storyEmpty);
  const cut = dieCutFor(theme, k, fam ? formats[fam] : null);
  return (
    <div data-print-piece={k} className="flex flex-col items-center gap-2">
      <PrintPreview
        src={q(k, 'screen')}
        alt={`${spec.label} — ${t.name}`}
        /* "Drawing your invitation…" — the piece's name without its article. */
        label={spec.label.replace(/^the\s+/i, '').toLowerCase()}
        priority={priority}
        tappable={tappable}
        /* …and a piece with its OWN size picker warms its other sizes, so a
           pick is instant. Only those three: warming every piece of the
           invitation family too doubled the first open's server requests. */
        prefetch={fam && HAS_SIZES(k) ? formatsFor(fam).filter((f) => f.id !== formats[fam].id).map((f) => q(k, 'screen', f.id)) : []}
        /* 📐 The box takes the piece's shape — a landscape pass is never a
           small card adrift in a tall grey box (`printPreviewBox`). */
        aspect={fam ? formats[fam].wMm / formats[fam].hMm : spec.widthPt / spec.heightPt}
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
      {/* The poster reads the Love Story — which lives in Details, so its door
          opens that item IN PLACE (never a link out of the Maker). */}
      {k === 'story-poster' ? (
        <DetailsGoTo item="love-story" className="font-medium text-link underline-offset-2 hover:underline">
          <span data-print-story-link="">{storyMissing ? 'Add your Love Story' : 'Edit your Love Story'}</span>
        </DetailsGoTo>
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
  const { t, themed, themedReady, q, classic, file, hrefWith, formats } = printPlan(input);
  const spec = PRINT_PIECES[k];
  const fam = formatFamilyOf(k);
  const menuEmpty = k === 'menu' && !menuHasDishes(menuPrints(menu ?? { saved: [], caterer: [], suggestions: [], flash: null }));
  // Never offered blank: no Love Story, no poster to save (the route refuses it too).
  const storyMissing = k === 'story-poster' && Boolean(input.storyEmpty);
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
      {/* 🖼 The A3 poster's background — the theme's picture or the couple's own
          photo (owner 2026-09-29, OWNER ANSWERS (1)). Offered only where there
          is a Love Story to print. */}
      {k === 'story-poster' && !storyMissing ? <PosterPhotoPicker eventId={input.eventId} saved={input.posterPhoto ?? null} /> : null}
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
      {menuEmpty || storyMissing ? null : (
        <div className="flex flex-col gap-1.5 border-t border-ink/10 pt-3" data-print-piece-saves={k}>
          <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">This piece</p>
          <ChangedSincePrinted eventId={input.eventId} piece={k} version={input.previewVersion} />
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            <PrintSaveButton href={classic(k)} file={file.classic(k)} variant="link">
              {themed ? 'Save · Classic (PDF)' : 'Save PDF'}
            </PrintSaveButton>
            {themedReady ? (
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
 * 🎫 THE PASS GUESTS SAVE (owner 2026-09-29) — one look for every card, and
 * its two outputs: *"print outs are PDF. digital versions are png"*. Each
 * guest saves their own card free; the couple's zip of every card is Event
 * Hub Pro (◆, never a padlock); the Phone card print is the SAME drawing as a
 * PDF. Drawn in Details › Pass, under the piece's own saves — the look is ONE
 * dropdown in the right part, beside the card it picks.
 */
export function PassCardsPanel({ input }: { input: PrintsInput }) {
  const { eventId, ownsPro, storeShell, passDesign = DEFAULT_PASS_CARD_DESIGN, passCardsZip = 'passes.zip' } = input;
  const { themed, themedReady, q, file } = printPlan(input);
  // The zip of every card is Event Hub Pro: ◆ unlocked when owned, ◆ PRO (a
  // door to the one unlock) on the web, absent in the store shell.
  const zipMark = makerProMark({ owns: ownsPro, storeShell });
  const classicPhoneCards = `/api/hub-print/passes?event=${eventId}&mode=print&theme=${CLASSIC_PRINT_THEME}&pass_format=${PASS_CARD_FORMAT_ID}`;
  return (
    <div data-pass-cards="" className="flex flex-col gap-3 border-t border-ink/10 pt-3">
      <p className="font-mono text-[10.5px] uppercase tracking-[0.18em] text-ink/55">{PASS_CARD_WORDS.section}</p>
      <ChangedSincePrinted eventId={eventId} piece="passes" version={input.previewVersion} />
      <PassCardDesignPicker
        eventId={eventId}
        saved={passDesign}
        previews={
          Object.fromEntries(
            PASS_CARD_DESIGNS.map((d) => [d, `${q('pass', 'screen', PASS_CARD_FORMAT_ID)}&pass_design=${d}`]),
          ) as Record<PassCardDesign, string>
        }
      />
      <div className="flex flex-col gap-2 text-sm">
        <div className="flex flex-wrap items-center gap-2" data-pass-cards-digital="">
          <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/60">{PASS_CARD_WORDS.digital}</span>
          {zipMark === null ? null : zipMark === 'unlocked' ? (
            <PrintSaveButton href={`${PASS_CARDS_ZIP_ROUTE}?event=${eventId}`} file={passCardsZip}>
              <PaidMark state="unlocked" label={paidMarkLabel('unlocked', 'Event Hub Pro')} className="mr-1 align-middle" />
              {PASS_CARD_WORDS.downloadAll}
            </PrintSaveButton>
          ) : (
            <Link
              href={`/dashboard/${eventId}/studio/website-pro`}
              data-pass-cards-zip-pro=""
              className="inline-flex min-h-10 items-center gap-1 rounded-full border border-ink/15 px-3 text-sm font-medium text-ink"
            >
              <PaidMark state={zipMark} label={paidMarkLabel(zipMark, 'Event Hub Pro')} className="mr-1 align-middle" />
              {PASS_CARD_WORDS.downloadAll}
            </Link>
          )}
          <span className="text-xs text-ink/55">One PNG per guest who is coming. Each guest&rsquo;s own saves free.</span>
        </div>
        <div className="flex flex-wrap items-center gap-2" data-pass-cards-print="">
          <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/60">{PASS_CARD_WORDS.print}</span>
          <PrintSaveButton
            href={themed && !themedReady ? classicPhoneCards : q('passes', 'print', PASS_CARD_FORMAT_ID)}
            file={themed && !themedReady ? file.classic('passes') : themed ? file.themed('passes') : file.classic('passes')}
          >
            Every guest&rsquo;s {PASS_CARD_WORDS.noun} · {PRINT_FORMATS[PASS_CARD_FORMAT_ID].label}
          </PrintSaveButton>
        </div>
      </div>
    </div>
  );
}

/**
 * THE FREE GROUP ("For the day") — every event, store shell included. Each
 * entry is an item: its first page in the body, its saves on the right. The
 * whole list, never an entry picked out (`free-prints.test.ts`).
 */
export function freePrintParts(
  eventId: string,
  slug: string | null,
  /** 💾 The previews' names — the live hash and the draft's (`FreePrintStamps`), so a QR look being tried shows on the sheet. */
  input?: Pick<PrintsInput, 'previewVersion' | 'draftVersion'>,
): Array<{ key: FreePrint['key']; label: string; body: React.ReactNode; editor: React.ReactNode }> {
  const stamps = { version: input?.previewVersion ?? null, draft: input?.draftVersion ?? null };
  return freePrints(eventId, slug, stamps).map((fp) => ({
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
  const { access, t, themed, freeTheme, themedReady, spot, q, classic, file, formats } = printPlan(input);
  return (
    <div
      data-prints-access={!themed ? 'classic' : freeTheme ? 'free-theme' : access.printReady ? 'print-ready' : 'sample'}
      className="flex flex-col gap-3"
    >
      <ChangedSincePrinted eventId={input.eventId} piece="set" version={input.previewVersion} />
      <p className="text-sm text-ink/75">
        <span data-prints-free-themes="" className="font-semibold text-ink">
          {themeNames(FREE_THEMES)} prints are free and print-ready
        </span>{' '}
        — 3 mm bleed and crop marks, no watermark.{' '}
        {!themed || freeTheme ? null : access.printReady ? (
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
      {!freeTheme && access.offerPro ? (
        <p data-prints-go-pro="" className="text-sm font-medium text-mulberry">
          <PaidMark state="try" label={paidMarkLabel('try', 'Event Hub Pro')} className="mr-1 align-middle" />
          Go Pro to print in {t.name}.
        </p>
      ) : null}
      <div className="flex flex-col gap-2">
        <PrintSaveButton href={classic('set')} file={file.classic('set')} variant={themedReady ? 'secondary' : 'primary'}>
          Whole set · Classic (PDF)
        </PrintSaveButton>
        <PrintSaveButton href={classic('passes')} file={file.classic('passes')}>
          Every guest&rsquo;s {PASS_CARD_WORDS.noun} · Classic
        </PrintSaveButton>
        {themedReady ? (
          <>
            <PrintSaveButton href={q('set', 'print')} file={file.themed('set')} variant="primary">
              <span data-prints-print-ready="">Whole set · {t.name} (PDF)</span>
            </PrintSaveButton>
            <PrintSaveButton href={q('passes', 'print')} file={file.themed('passes')}>
              <span data-prints-passes="">Every guest&rsquo;s {PASS_CARD_WORDS.noun} · {t.name}</span>
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
