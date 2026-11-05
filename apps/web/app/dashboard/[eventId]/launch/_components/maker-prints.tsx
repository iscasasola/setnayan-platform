import Link from 'next/link';
import { guestsViewHref } from '@/lib/guests-views';
import { INVITE_THEMES, type InviteThemeId } from '@/lib/invite-themes';
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
  PASS_CARD_PX,
  PASS_CARD_ROUTE,
  PASS_CARDS_ZIP_ROUTE,
  PASS_CARD_WORDS,
  type PassCardDesign,
} from '@/lib/pass-card';
/* ⚡ The print pieces load when Details is opened — never with the Maker (`details-lazy.tsx`). */
import { ChangedSincePrinted, PassCardDesignPicker, PosterPhotoPicker, PrintChoicePicker, PrintMenuEditor, PrintPreview, PrintSaveButton } from './details-lazy';
import { DetailsGoTo } from './details-go';
import { EVERYTHING_PRO_NOTE, PLACE_CARDS_PRO_NOTE, WHOLE_SET_PRO_NOTE } from '@/lib/studio-prints-six';
import { GUEST_TOKEN, GUEST_WORD_TOKEN, EVERYTHING_LABEL, DIGITAL_TICKET_TIP, everythingLine, guestPrintCountLine, printSetTip, type PrintGuest } from '@/lib/studio-prints-settings';
import { formatCount } from '@/lib/format-number';
import { printHeadLine } from '@/lib/print-head-line';
import { StudioTool } from './details-lazy';
import type { StudioChartInput, StudioPaper } from './print-paper';
import {
  DEFAULT_ENTRANCE_CHART_SIZE,
  ENTRANCE_CHART_LAYOUTS,
  ENTRANCE_CHART_LAYOUT_LABELS,
  ENTRANCE_CHART_SIZES,
  chartFileStem,
} from '@/lib/print-entrance-chart';

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
   * 🎟 Who has a pass, by name, in the printed passes' order (`loadPassGuestNames`; Studio only) — "Pass for ▾" and the count over
   * every guest's file. `null`: the list could not be read (said, never "nobody"); absent: not read here.
   */
  passGuests?: PrintGuest[] | null;
  /**
   * 🔳 Who is on the Guest QR sheet, by name — the sheet's own read (`loadQrGuestNames`: every guest with a QR, can't-come included;
   * Studio only). The QR row's View as ▾, Pick guests and count line. `null`: could not be read; absent: not read here.
   */
  qrGuests?: PrintGuest[] | null;
  /**
   * 🪑 Who has a place card, by name — the seating pack's own read and grouping (`loadSeatedGuestNames`; Studio only). The place
   * cards row's View as ▾, Pick guests and count line. `null`: could not be read; absent: not read here.
   */
  seatedGuests?: PrintGuest[] | null;
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
    if (piece === 'set' || piece === 'everything') return `&pass_format=${f.pass}&invitation_format=${f.invitation}&card_format=${f.card}`;
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

/**
 * 🗂 AN ALL-IN-ONE FILE IS EVENT HUB PRO (owner 2026-10-16, DECISION_LOG "PRINTS: ONE AT A TIME IS FREE — EVERY 'DOWNLOAD ALL' IS
 * EVENT HUB PRO"; `isAllInOnePrint`, refused by the route too). The 2026-09-29 ticket zip's pattern (`makerProMark`; the zip itself is free since 2026-10-22): owned → the file,
 * ◆ unlocked in the icon's place; a free couple on the web → the ◆ door that opens the centred note (`StudioProDoor`); the store
 * shell without it → nothing. An unlock belongs to the event: an internal host's event reads as owned (`printOwnsPro`).
 */
export type AllInOneFile =
  | { kind: 'save'; href: string; file: string; label: string; icon?: React.ReactElement }
  | { kind: 'door'; href: string; label: string; icon: React.ReactElement; note: { title: string; body: string } }
  | null;
export function allInOneFile(
  input: Pick<PrintsInput, 'eventId' | 'ownsPro' | 'storeShell'>,
  save: { href: string; file: string; label: string },
  note: { title: string; body: string },
): AllInOneFile {
  const mark = makerProMark({ owns: input.ownsPro, storeShell: input.storeShell });
  if (mark === null) return null;
  if (mark === 'unlocked') return { kind: 'save', ...save, icon: <PaidMark state="unlocked" label={paidMarkLabel('unlocked', 'Event Hub Pro')} /> };
  return { kind: 'door', href: `/dashboard/${input.eventId}/studio/website-pro`, label: save.label, icon: <PaidMark state={mark} label={paidMarkLabel(mark, 'Event Hub Pro')} />, note };
}
/**
 * 🎟 A FREE ALL-GUESTS FILE (owner 2026-10-22, DECISION_LOG "FREE IS READY, PRO IS PERSONAL — ALL TICKETS AND THE QR SHEET ARE FREE";
 * verbatim: *"the goal of the free is to keep everything minimum ready but no personalization."*): every guest's pass in one file and
 * the Guest QR sheet are what a free event needs to run its day — a plain Download (the arrow, no ◆) for EVERY event, the store shell
 * included (a free file is not a purchase). A free event's passes are plain white (`printLookForEvent`). `isAllInOnePrint` is false
 * for both, so the route serves them free too.
 */
export function freeAllGuestsFile(save: { href: string; file: string; label: string }): AllInOneFile {
  return { kind: 'save', ...save };
}
/** The shipped Details' look of the same file: the save with ◆ before its words, or the link to the unlock (the zip's own shipped look). */
function AllInOneShipped({ f, children, primary = false, data }: { f: AllInOneFile; children: React.ReactNode; primary?: boolean; data?: string }) {
  if (f === null) return null;
  if (f.kind === 'save') {
    return (
      <PrintSaveButton href={f.href} file={f.file} variant={primary ? 'primary' : 'secondary'}>
        {/* ◆ unlocked on a Pro file only — a free all-guests file (`freeAllGuestsFile`) carries no mark. */}
        {f.icon ? <PaidMark state="unlocked" label={paidMarkLabel('unlocked', 'Event Hub Pro')} className="mr-1 align-middle" /> : null}
        {data ? <span {...{ [data]: '' }}>{children}</span> : children}
      </PrintSaveButton>
    );
  }
  return (
    <Link href={f.href} data-print-all-in-one-pro="" className="inline-flex min-h-10 items-center gap-1 rounded-full border border-ink/15 px-3 text-sm font-medium text-ink">
      {f.icon}
      {children}
    </Link>
  );
}

/** 🍽 The Menu's shipped editor in Studio — it saves as you go (`studio-prints-six.tsx`). */
function studioMenu(eventId: string, menu: { saved: MenuMoment[]; caterer: MenuMoment[]; suggestions: string[] }) {
  return (
    <StudioTool
      part="menu"
      eventId={eventId}
      initial={menuHasDishes(menu.saved) || menu.saved.length ? menu.saved : menu.caterer}
      fromCaterer={!menuHasDishes(menu.saved) && !menu.saved.length && menu.caterer.length > 0}
      suggestions={menu.suggestions}
    />
  );
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
  studio = false,
}: {
  input: PrintsInput;
  piece: PrintSetKey;
  menu?: { saved: MenuMoment[]; caterer: MenuMoment[]; suggestions: string[]; flash: 'saved' | 'error' | null };
  children?: React.ReactNode;
  /**
   * 🧭 The new Maker's Studio › Prints — ONE PRINT PER SLIDE since 2026-10-26 (owner: *"So we can make like a swipe
   * carousel type where they can see the preview larger then under is the toolbar to pick style? and download options?"*;
   * prototype `prints_carousel_2026-10-26`): the piece's parts REGISTER its slide — its name, its chosen size, its size ▾,
   * its picture, its ONE Download — and `studio-prints-carousel.tsx` draws it. Same pickers, same files, same switches.
   */
  studio?: boolean;
}) {
  const { t, themed, themedReady, q, classic, file, hrefWith, formats } = printPlan(input);
  const spec = PRINT_PIECES[k];
  const fam = formatFamilyOf(k);
  const menuEmpty = k === 'menu' && !menuHasDishes(menuPrints(menu ?? { saved: [], caterer: [], suggestions: [], flash: null }));
  // Never offered blank: no Love Story, no poster to save (the route refuses it too).
  const storyMissing = k === 'story-poster' && Boolean(input.storyEmpty);
  const sizePicker =
    fam && HAS_SIZES(k) ? (
      <PrintChoicePicker
        label={`${spec.label} size`}
        value={formats[fam].id}
        dataAttr="data-print-format-picker"
        options={formatsFor(fam).map((f) => ({ key: f.id, label: f.label, href: hrefWith(k, { family: fam, format: f.id }) }))}
      />
    ) : null;
  const saves =
    menuEmpty || storyMissing || studio ? null : (
      <>
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
      </>
    );
  if (studio) {
    /* 🖨 ONE DOWNLOAD PER PIECE (owner 2026-10-17, DECISION_LOG "PRINTS: ONE SETTINGS SHEET, ONE DOWNLOAD PER PIECE, VIEW AS ▾ ON GUEST
       PRINTS, ALL GUESTS ◆, EVERYTHING ◆"; prototype `prints_settings_and_downloads_2026-10-17.html`): the row is picture · name · size
       line · size ▾ · Download. What the piece includes moved into ⚙ Print settings (`maker-details.tsx`). The Download is the file
       the row's filled step always saved — the theme's own print-ready PDF where it prints ready, else Classic (free for everyone;
       said on the button when the picture shows a Pro theme the couple has not unlocked). */
    const one = themedReady ? { href: q(k, 'print'), file: file.themed(k) } : { href: classic(k), file: file.classic(k) };
    const label = themed && !themedReady ? 'Download · Classic' : 'Download';
    const changed = <ChangedSincePrinted eventId={input.eventId} piece={k} version={input.previewVersion} again={one} />;
    const printed = { eventId: input.eventId, piece: k, version: input.previewVersion ?? null };
    /* 🖼 THE PIECE'S PICTURE IN ITS HEAD (owner 2026-10-14): the SAME address its body draws (`PrintPieceBody`), at its paper's shape. */
    const paper: StudioPaper = {
      item: k,
      eventId: input.eventId,
      src: q(k, 'screen'),
      aspect: fam ? formats[fam].wMm / formats[fam].hMm : spec.widthPt / spec.heightPt,
      title: spec.label,
      chips: [
        fam ? `${formats[fam].label} · ${formats[fam].wMm} × ${formats[fam].hMm} mm` : spec.size,
        themed && !themedReady ? `◆ ${t.name} · sample until Pro` : t.name,
      ],
      empty: menuEmpty
        ? { title: 'No menu yet', line: 'The moments of your night and the dishes of each — this card is never printed blank.', door: { kind: 'edit', label: 'Add your menu' } }
        : storyMissing
          ? { title: 'No Love Story yet', line: 'The poster prints your chapters, moment by moment. It is never printed blank.', door: { kind: 'item', item: 'love-story', label: 'Add your Love Story' } }
          : null,
    };
    const picker =
      sizePicker && fam
        ? {
            label: `${spec.label} size`,
            value: formats[fam].id,
            dataAttr: 'data-print-format-picker',
            options: formatsFor(fam).map((f) => ({ key: f.id, label: f.label, href: hrefWith(k, { family: fam, format: f.id }) })),
          }
        : null;
    const name = spec.label.replace(/^the\s+/i, '');
    if (k === 'pass' && fam) {
      /* 🎟 THE EVENT PASS IS A GUEST PRINT (owner 2026-10-17): View as ▾ — one guest's pass, free (`pass_guest=<id>`, the size picked)
         — and All guests, every guest's pass ganged on A4 (◆ Event Hub Pro 2026-10-17, FREE since 2026-10-22: `freeAllGuestsFile`).
         "Pass for ▾" and "Sample (PDF)" are retired: the
         Download IS one real guest's pass. The picture is the guest picked. */
      const guests = input.passGuests ?? null;
      return (
        <div data-print-editor={k} data-print-studio="" className="flex flex-col gap-1">
          <StudioTool
            part="guest-piece"
            eventId={input.eventId}
            item={k}
            name={name}
            line={printHeadLine(k, formats[fam])}
            picker={picker}
            paper={{ ...paper, src: `${paper.src}&pass_guest=${GUEST_TOKEN}` }}
            guestPicture
            guests={guests}
            one={{ href: `${one.href}&pass_guest=${GUEST_TOKEN}`, file: one.file.replace(/\.pdf$/, `-${GUEST_WORD_TOKEN}.pdf`) }}
            all={freeAllGuestsFile({ href: themedReady ? q('passes', 'print') : classic('passes'), file: themedReady ? file.themed('passes') : file.classic('passes'), label: 'All guests' })}
            holds={guestPrintCountLine('pass', guests)}
            none="No guest has a pass yet — a pass appears once a guest is on your list and coming."
            changed={changed}
            pickNoun={{ one: 'pass', many: 'passes' }}
            printed={printed}
            tip={printSetTip(input.storeShell)}
          />
        </div>
      );
    }
    /* 🍽 The Menu's dishes are content, not settings: its shipped editor (it saves as you go), opened from the slide's ⓘ — and, with
       no dishes yet, from its empty line ("Add your menu"). Nothing to download until there are dishes. */
    const edit = k === 'menu' && menu ? { label: menuEmpty ? 'Add your menu' : 'Edit menu', body: studioMenu(input.eventId, menu) } : null;
    return (
      <div data-print-editor={k} data-print-studio="" className="flex flex-col gap-1">
        {/* 🎠 The piece's slide: its name, its CHOSEN size (`lib/print-head-line.ts`), its size ▾ (every size stays in the dropdown), its picture. */}
        <StudioTool part="print-head" name={name} line={fam ? printHeadLine(k, formats[fam]) : spec.size} paper={paper} changed={changed} printed={printed} picker={picker} tip={printSetTip(input.storeShell)} />
        {/* ⬇ …and its ONE Download — withheld while the piece would print blank (no menu, no Love Story). */}
        <StudioTool part="piece-download" item={k} name={name} href={menuEmpty || storyMissing ? null : one.href} file={menuEmpty || storyMissing ? null : one.file} label={label} edit={edit} />
      </div>
    );
  }
  return (
    <div data-print-editor={k} className="flex flex-col gap-3">
      {fam && HAS_SIZES(k) ? (
        <div data-print-formats={fam} className="flex min-h-11 items-center justify-between gap-3 border-b border-ink/5 pb-2">
          <span className="text-sm text-ink">Size</span>
          {sizePicker}
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
          <div className="flex flex-wrap gap-x-4 gap-y-1">{saves}</div>
        </div>
      )}
    </div>
  );
}

/**
 * 🎫 THE PASS GUESTS SAVE (owner 2026-09-29) — one look for every card, and
 * its two outputs: *"print outs are PDF. digital versions are png"*. Each
 * guest saves their own card free; the couple's zip of every card is FREE
 * since 2026-10-22 (`freeAllGuestsFile` — it was Event Hub Pro from
 * 2026-09-29); the Phone card print is the SAME drawing as a PDF. Drawn in
 * Details › Pass, under the piece's own saves — the look is ONE dropdown in
 * the right part, beside the card it picks.
 */
export function PassCardsPanel({ input }: { input: PrintsInput }) {
  const { eventId, passDesign = DEFAULT_PASS_CARD_DESIGN, passCardsZip = 'passes.zip' } = input;
  const { themed, themedReady, q, file } = printPlan(input);
  /* 🎟 The zip of every digital ticket — FREE for every event since 2026-10-22, the store shell included (owner "yes", DECISION_LOG
     "THE DIGITAL TICKET ZIP IS FREE": it is how couples hand out tickets). A free event's tickets are plain white (`printLookForEvent`). */
  const zip = freeAllGuestsFile({ href: `${PASS_CARDS_ZIP_ROUTE}?event=${eventId}`, file: passCardsZip, label: PASS_CARD_WORDS.downloadAll });
  const classicPhoneCards = `/api/hub-print/passes?event=${eventId}&mode=print&theme=${CLASSIC_PRINT_THEME}&pass_format=${PASS_CARD_FORMAT_ID}`;
  /* 🎟 Every guest's ticket, Phone card, in one PDF — Event Hub Pro 2026-10-16, FREE again 2026-10-22 (`freeAllGuestsFile`). */
  const printedAll = freeAllGuestsFile({
    href: themed && !themedReady ? classicPhoneCards : q('passes', 'print', PASS_CARD_FORMAT_ID),
    file: themed && !themedReady ? file.classic('passes') : themed ? file.themed('passes') : file.classic('passes'),
    label: `Every guest’s ${PASS_CARD_WORDS.noun} · ${PRINT_FORMATS[PASS_CARD_FORMAT_ID].label}`,
  });
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
          <AllInOneShipped f={zip}>{PASS_CARD_WORDS.downloadAll}</AllInOneShipped>
          <span className="text-xs text-ink/55">One PNG per guest who is coming. Each guest&rsquo;s own saves free.</span>
        </div>
        {/* 🎟 Every guest's ticket in one PDF — free for every event since 2026-10-22, the store shell included. */}
        {printedAll === null ? null : (
          <div className="flex flex-wrap items-center gap-2" data-pass-cards-print="">
            <span className="w-24 shrink-0 text-xs font-semibold uppercase tracking-wide text-ink/60">{PASS_CARD_WORDS.print}</span>
            <AllInOneShipped f={printedAll}>
              Every guest&rsquo;s {PASS_CARD_WORDS.noun} · {PRINT_FORMATS[PASS_CARD_FORMAT_ID].label}
            </AllInOneShipped>
          </div>
        )}
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
  /**
   * 💾 The previews' names — the live hash and the draft's (`FreePrintStamps`), so a QR look being tried shows on the sheet — and
   * (2026-10-17) who may save the all-guests files (`ownsPro`, `storeShell`) and who View as ▾ lists (`passGuests`).
   */
  input?: Pick<PrintsInput, 'previewVersion' | 'draftVersion'> & Partial<Pick<PrintsInput, 'ownsPro' | 'storeShell' | 'passGuests' | 'qrGuests' | 'seatedGuests'>>,
  /** 🧭 The new Maker's Studio › Prints: the blurb as the row's small line, the saves as small buttons (prototype `.pr-sv`). */
  studio = false,
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
    editor: studio ? (
      studioFreeEditor(eventId, slug, fp, input)
    ) : (
      <div className="flex flex-col gap-2" data-free-print-saves={fp.key}>
        <p className="text-xs text-ink/60">
          {/* Names, parents and tables on these prints come from the Guest list —
              the one place to fix them (DECISION_LOG 2026-09-25 "PRINT CONTENT
              COMES FROM WHERE IT ALREADY LIVES"). */}
          {ALL_GUESTS_NOTE[fp.key] ? 'From your guest list and seating.' : 'Free for every event, from your guest list and seating.'}
        </p>
        <div className="flex flex-wrap gap-x-3 gap-y-1">
          {fp.saves.map((s, i) => {
            /* 🗂 The whole place-card pack is an all-guests file — Event Hub Pro since 2026-10-17 (the route refuses it too): the zip's
               ◆ pattern here as well (`AllInOneShipped`); absent in the store shell without it. Every guest's QR is free again
               (2026-10-22), a plain save like the rest of the group. */
            const pro = ALL_GUESTS_NOTE[fp.key];
            if (pro) {
              const f = allInOneFile({ eventId, ownsPro: input?.ownsPro ?? false, storeShell: input?.storeShell ?? false }, { href: s.href, file: s.file, label: s.label }, pro);
              return (
                <AllInOneShipped key={s.href} f={f} primary={i === 0}>
                  {s.label}
                </AllInOneShipped>
              );
            }
            return (
              <PrintSaveButton key={s.href} href={s.href} file={s.file} variant={i === 0 ? 'secondary' : 'link'}>
                {s.label}
              </PrintSaveButton>
            );
          })}
        </div>
      </div>
    ),
  }));
}

/**
 * 🗂 The free prints whose all-guests file is Event Hub Pro (owner 2026-10-17) and the ◆ note each opens. The Guest QR sheet left on
 * 2026-10-22 (owner: *"the goal of the free is to keep everything minimum ready but no personalization."*) — it downloads free.
 */
const ALL_GUESTS_NOTE: Partial<Record<FreePrint['key'], { title: string; body: string }>> = {
  'seating-pack': PLACE_CARDS_PRO_NOTE,
};

/**
 * 🖨 A PRINT FOR THE DAY, STUDIO'S ROW (owner 2026-10-17): picture · name · line · ONE Download — and
 *   · Guest QR codes, Table signs & place cards: guest prints — View as ▾, one guest's file (free: their own QR PNG, their own place
 *     card) and All guests ◆ (the sheet / the pack: Event Hub Pro);
 *   · the 2D seat plan's "Colours ▾" and the caterer's "File ▾": two files, one dropdown + one Download;
 *   · the entrance seating chart: its size ▾ on the row, its layout (By table · A to Z) in Print settings.
 */
function studioFreeEditor(eventId: string, slug: string | null, fp: FreePrint, input?: Parameters<typeof freePrintParts>[2]): React.ReactNode {
  if (fp.key === 'seating-chart') return <StudioTool part="chart" chart={studioChartInput(eventId, slug, fp)} />;
  const paper = freePaper(eventId, fp);
  const e = encodeURIComponent(eventId);
  /* Each guest print lists ITS OWN file's guests (owner 2026-10-26): the QR sheet everyone with a QR, the place cards everyone
     seated — so View as ▾, Pick guests and the count line say what that file holds. Not read (absent) → the pass list, as before. */
  const own = fp.key === 'qr-codes' ? input?.qrGuests : fp.key === 'seating-pack' ? input?.seatedGuests : undefined;
  const guests = own !== undefined ? own : (input?.passGuests ?? null);
  const proOf = (s: { href: string; file: string }, note: { title: string; body: string }) =>
    allInOneFile({ eventId, ownsPro: input?.ownsPro ?? false, storeShell: input?.storeShell ?? false }, { ...s, label: 'All guests' }, note);
  if (fp.key === 'qr-codes' || fp.key === 'seating-pack') {
    const qr = fp.key === 'qr-codes';
    return (
      <div data-free-print-saves={fp.key} data-print-studio="">
        <StudioTool
          part="guest-piece"
          eventId={eventId}
          item={fp.key}
          name={fp.label}
          line={qr ? 'A4 · 12 to a page' : 'A4 · directory, signs, a place card per seat'}
          paper={paper}
          guests={guests}
          one={
            qr
              ? { href: `/api/website/qr/guest/${GUEST_TOKEN}`, file: printFileName(slug, `qr-${GUEST_WORD_TOKEN}`, 'png') }
              : { href: `/dashboard/${e}/seating/print?format=pdf&guest=${GUEST_TOKEN}`, file: printFileName(slug, `place-card-${GUEST_WORD_TOKEN}`) }
          }
          all={qr ? freeAllGuestsFile({ ...fp.saves[0]!, label: 'All guests' }) : proOf(fp.saves[0]!, ALL_GUESTS_NOTE[fp.key]!)}
          holds={guestPrintCountLine(fp.key, guests)}
          none={qr ? 'No guest is on your list yet — add your guests, then pick one here.' : 'No guest is seated yet — seat your guests in the seat plan, then pick one here.'}
          /* 🎟 Pick guests on both (owner 2026-10-26, "all guest related prints"): the place cards' picked file is those guests'
             cards only — offered where All guests saves (Event Hub Pro for the pack), refused by the route otherwise too. */
          pickNoun={qr ? { one: 'QR code', many: 'QR codes' } : { one: 'place card', many: 'place cards' }}
          tip={fp.blurb}
        />
      </div>
    );
  }
  if ((fp.key === 'seat-plan' || fp.key === 'caterer') && fp.saves.length > 1) {
    const seat = fp.key === 'seat-plan';
    return (
      <div data-free-print-saves={fp.key} data-print-studio="">
        <StudioTool
          part="file-choice"
          item={fp.key}
          name={fp.label}
          line={seat ? 'A3 landscape · your room from above' : 'A4 · attending guests'}
          paper={paper}
          label={seat ? 'Colours' : 'File'}
          choices={fp.saves.map((s, i) => ({
            key: String(i),
            label: seat ? (i === 0 ? 'In your colours' : 'Blueprint') : i === 0 ? 'PDF' : 'Spreadsheet (CSV)',
            href: s.href,
            file: s.file,
          }))}
          tip={fp.blurb}
        />
      </div>
    );
  }
  const first = fp.saves[0]!;
  return (
    <div className="flex flex-col gap-1" data-free-print-saves={fp.key} data-print-studio="">
      {/* 🖼 Its name and its picture — the route's own page 1, at its paper's shape (owner 2026-10-14); the blurb is the row's small line. */}
      <StudioTool part="print-head" name={fp.label} line={fp.paper} picker={null} paper={paper} tip={fp.blurb} />
      <StudioTool part="piece-download" item={fp.key} name={fp.label} href={first.href} file={first.file} />
    </div>
  );
}

/** 🖼 A free print's picture: its route's own preview (`fp.preview`), at its paper's shape — page 1, the pages flipped in the sheet. */
function freePaper(eventId: string, fp: FreePrint): StudioPaper {
  return { item: fp.key, eventId, src: fp.preview, aspect: fp.aspect, title: fp.label, chips: [fp.paper, 'free'], ...(fp.pages ? { pages: true } : {}) };
}

/** 🪧 The entrance chart's row, read from the chart's own sizes and layouts (`lib/print-entrance-chart.ts`) — the files named as the route names them. */
export function studioChartInput(eventId: string, slug: string | null, fp: FreePrint): StudioChartInput {
  return {
    eventId,
    route: `/dashboard/${encodeURIComponent(eventId)}/seating/print`,
    sizes: ENTRANCE_CHART_SIZES.map((s) => ({ key: s.key, label: s.label, mm: s.mm, aspect: s.wMm / s.hMm })),
    defaultSize: DEFAULT_ENTRANCE_CHART_SIZE,
    layouts: ENTRANCE_CHART_LAYOUTS.map((l) => ({ key: l, label: ENTRANCE_CHART_LAYOUT_LABELS[l] })),
    files: { table: printFileName(slug, chartFileStem('table')), az: printFileName(slug, chartFileStem('az')) },
    saveLabels: {
      table: fp.saves.find((s) => s.href.includes('chart=table'))?.label ?? 'Entrance chart · by table',
      az: fp.saves.find((s) => s.href.includes('chart=az'))?.label ?? 'Entrance chart · A to Z',
    },
    title: fp.label,
    blurb: fp.blurb,
  };
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
  /* 🗂 THE WHOLE SET IS EVENT HUB PRO (owner 2026-10-16, "EVERY 'DOWNLOAD ALL' IS EVENT HUB PRO"): the zip's ◆ pattern (`allInOneFile`);
     the route refuses it without it. Every guest's ticket in one file is FREE again (2026-10-22, `freeAllGuestsFile`), and each
     piece's own PDF, on its own row, stays free. */
  const wholeSet = (href: string, f: string, label: string) => allInOneFile(input, { href, file: f, label }, WHOLE_SET_PRO_NOTE);
  const everyTicket = (href: string, f: string, label: string) => freeAllGuestsFile({ href, file: f, label });
  return (
    <div
      data-prints-access={!themed ? 'classic' : freeTheme ? 'free-theme' : access.printReady ? 'print-ready' : 'sample'}
      className="flex flex-col gap-3"
    >
      <ChangedSincePrinted
        eventId={input.eventId}
        piece="set"
        version={input.previewVersion}
      />
      <p className="text-sm text-ink/75">
        {/* 🤍 Owner 2026-10-21: *"Free version is the plain white. Themes that follows the event hub is pro"* — the free list of
            themes is no longer what prints free. */}
        <span data-prints-free-themes="" className="font-semibold text-ink">
          Free prints are plain white and print-ready
        </span>{' '}
        — 3 mm bleed and crop marks, no watermark.{' '}
        {input.storeShell ? null : (
          <>
            <PaidMark state={input.ownsPro ? 'unlocked' : 'try'} label={paidMarkLabel(input.ownsPro ? 'unlocked' : 'try', 'Event Hub Pro')} className="mr-1 align-middle" />
            Your Event Hub look on paper is Event Hub Pro.{' '}
          </>
        )}
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
      {
      <div className="flex flex-col gap-2">
        <AllInOneShipped f={wholeSet(classic('set'), file.classic('set'), 'Whole set · Classic (PDF)')} primary={!themedReady}>
          Whole set · Classic (PDF)
        </AllInOneShipped>
        <AllInOneShipped f={everyTicket(classic('passes'), file.classic('passes'), `Every guest’s ${PASS_CARD_WORDS.noun} · Classic`)}>
          Every guest&rsquo;s {PASS_CARD_WORDS.noun} · Classic
        </AllInOneShipped>
        {themedReady ? (
          <>
            <AllInOneShipped f={wholeSet(q('set', 'print'), file.themed('set'), `Whole set · ${t.name} (PDF)`)} primary data="data-prints-print-ready">
              Whole set · {t.name} (PDF)
            </AllInOneShipped>
            <AllInOneShipped f={everyTicket(q('passes', 'print'), file.themed('passes'), `Every guest’s ${PASS_CARD_WORDS.noun} · ${t.name}`)} data="data-prints-passes">
              Every guest&rsquo;s {PASS_CARD_WORDS.noun} · {t.name}
            </AllInOneShipped>
          </>
        ) : themed ? (
          <PrintSaveButton href={q('set', 'sample')} file={file.sample('set')}>
            Sample sheet · {t.name} (JPG)
          </PrintSaveButton>
        ) : null}
      </div>
      }
      <p className="text-xs text-ink/55">Passes print {formats.pass.label} size, ganged on A4 with cut lines.</p>
    </div>
  );
}

/**
 * 🎫 THE DIGITAL TICKET (owner 2026-10-17) — a guest print of its own row: the PNG each guest saves, drawn for the guest View as ▾
 * shows (`/api/guest/pass-card?guest=<id>`, the Guest list's own per-guest file, free), and All guests — the zip of every ticket
 * (`PASS_CARDS_ZIP_ROUTE`): Event Hub Pro from 2026-09-29, FREE for every event since 2026-10-22 (owner "yes", DECISION_LOG "THE
 * DIGITAL TICKET ZIP IS FREE" — it is how couples hand out tickets), so a plain Download (`freeAllGuestsFile`), the store shell
 * included, and the route asks no Pro question. Its look is its own slide's Ticket style ▾ (Classic ▾, owner 2026-10-26 — it left Print settings); a free event's is plain white.
 */
export function DigitalTicketEditor({ input }: { input: PrintsInput }) {
  const { eventId, slug, passDesign = DEFAULT_PASS_CARD_DESIGN, passCardsZip = 'passes.zip' } = input;
  const { q } = printPlan(input);
  const guests = input.passGuests ?? null;
  const zip = freeAllGuestsFile({ href: `${PASS_CARDS_ZIP_ROUTE}?event=${eventId}`, file: passCardsZip, label: 'All guests' });
  return (
    <div data-print-editor="digital-ticket" data-print-studio="" className="flex flex-col gap-1">
      <StudioTool
        part="guest-piece"
        eventId={eventId}
        item="digital-ticket"
        name="Digital ticket"
        line={`PNG · ${PASS_CARD_PX.w} × ${PASS_CARD_PX.h} · what each guest saves`}
        paper={{
          item: 'digital-ticket',
          eventId,
          src: `${PASS_CARD_ROUTE}?guest=${GUEST_TOKEN}&design=${passDesign}`,
          aspect: PASS_CARD_PX.w / PASS_CARD_PX.h,
          title: 'Digital ticket',
          chips: [`PNG · ${PASS_CARD_PX.w} × ${PASS_CARD_PX.h}`, 'free'],
        }}
        guestPicture
        guests={guests}
        one={{ href: `${PASS_CARD_ROUTE}?guest=${GUEST_TOKEN}`, file: printFileName(slug, `ticket-${GUEST_WORD_TOKEN}`, 'png') }}
        all={zip}
        holds={guestPrintCountLine('digital-ticket', guests)}
        none="No guest has a ticket yet — a ticket appears once a guest is on your list and coming."
        /* 🎟 Pick guests (owner 2026-10-26, *"Why cant i pick specific guests to download and compile?"*): ONE .zip of just the
           guests ticked — the zip route narrowed by `guests=` (`/api/guest/pass-card/all`, each id checked against this event). */
        pickNoun={{ one: 'ticket', many: 'tickets', verb: 'Download' }}
        tip={DIGITAL_TICKET_TIP}
        /* 🎫 ITS THREE LOOKS ARE ON ITS SLIDE (owner 2026-10-26, verbatim: *"The 3 designs for the digital ticket should be on the carousel
           and not on settings."*): Classic ▾ beside View as ▾ — the look the couple is editing (the drafted one, else live), each look's
           menu picture the same the settings strip drew. A pick still waits for Apply (`usePassLookPick`, the one draft save). */
        ticketStyle={{
          saved: passDesign,
          previews: Object.fromEntries(PASS_CARD_DESIGNS.map((d) => [d, `${q('pass', 'screen', PASS_CARD_FORMAT_ID)}&pass_design=${d}`])) as Record<PassCardDesign, string>,
        }}
      />
    </div>
  );
}

/**
 * 🗂 EVERYTHING ◆ (owner 2026-10-17): every piece above in one PDF — the set, every guest's pass and place card, the day's sheets
 * (`/api/hub-print/everything`, Event Hub Pro, refused by the route too). It replaces "Download the set"'s buttons in Studio; the
 * piece bar's ⬇ offers it beside "This piece".
 */
export function PrintEverythingStudio({ input }: { input: PrintsInput }) {
  const { t, themedReady, q, classic, file } = printPlan(input);
  const guests = input.passGuests;
  const passes = Array.isArray(guests) && guests.length ? `${formatCount(guests.length)} ${guests.length === 1 ? 'pass' : 'passes'} · every place card · the day’s sheets` : null;
  const all = allInOneFile(
    input,
    {
      href: themedReady ? q('everything', 'print') : classic('everything'),
      file: themedReady ? file.themed('everything') : file.classic('everything'),
      label: EVERYTHING_LABEL,
    },
    EVERYTHING_PRO_NOTE,
  );
  return (
    <div data-print-editor="download" data-print-studio="">
      <StudioTool part="everything" line={everythingLine(themedReady ? t.name : INVITE_THEMES[CLASSIC_PRINT_THEME].name)} holds={passes} all={all} />
    </div>
  );
}

/** The 3D plan prints from the plan itself — said on the seat-plan item. */
export function SeatPlan3dNote({ eventId }: { eventId: string }) {
  return (
    <p className="text-sm text-ink/70" data-prints-seat-plan="3d">
      Your 3D plan prints from the plan itself —{' '}
      {/* 🗂 R4: the 3D room lives inside Guests › Seats. */}
      <Link href={guestsViewHref(eventId, 'seats', { seat: '3d' })} className="font-medium text-mulberry underline underline-offset-2">
        open the 3D plan
      </Link>
      .
    </p>
  );
}
