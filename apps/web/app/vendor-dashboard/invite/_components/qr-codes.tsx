import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { InfoTip } from '@/app/_components/info-tip';
import { QrCard } from '@/app/_components/qr-card';
import { formatCount } from '@/lib/format-number';
import type { SupplierQrMode } from '@/lib/supplier-qr-codes';
import { CustomersPick } from '../../customers/_components/customers-pick';
import { DatesRow } from '../../customers/_components/dates-row';
import { QrCodeList, type QrRow } from './qr-code-list';
import { BookedQrsList } from './booked-qrs-list';

/**
 * QR CODES — ONE LIST, a row per code (owner 2026-11-06, QR codes Option B: *"The qr codes are unorganized"* ·
 * *"Seeing each kind of qr, and what it does. I also do not see the booked qr"* → *"B"*; prototype
 * `qr-list-proto/index.html`, claude.ai/artifact/Qgh3BmXSueMLFpUwPxLQHD). It REPLACES the one-code "Which code ▾"
 * dropdown (S-PR3, 2026-10-29) — a code's purpose is read on its row, not learned only after picking it.
 *
 *   QR codes ⓘ / "Tap a code to see it big and share it"
 *   row: name · sub (· per event) / what a scan does · small QR · ›      → tap: its sheet (`qr-code-list.tsx`)
 *   sheet: name · sub · ⓘ · Done / the full caption / its options / the shipped `QrCard` (Share · Copy link ·
 *          Download · Write to NFC — `QrCard` → `QrActions` → `NfcWriteButton`; the tag holds the card's own URL)
 *
 * TWO HOMES (Option B): Shop › Promote lists the shop's four codes — Check a date · Shortlist · My page · Reviews —
 * and each sheet ends with "Put it on…" (Door print · Prints), which hands THIS code to the Prints sheet. Customers ›
 * QR codes lists Booked · one-use and Crew for an event, "per event", in the same row + sheet: Booked's sheet holds the
 * deal form (or the issued code), Make another and the Issued ledger; Crew's sheet holds Event ▾ and that event's code.
 *
 * 🚪 NO DOOR STICKER HERE (owner 2026-11-06, "ONE HOME FOR EVERY PROMOTE TOOL": *"the door print and the badge print are
 * pieces INSIDE prints; the door sticker leaves Customers › QR codes"*). The door piece is the approved Ink & gold door
 * print in Prints, reached from any code's "Put it on… › Door print".
 *
 * Server component: every word arrives read; the list and its sheet are the client part.
 */

export type QrPick = { key: string; label: string; href: string };

/**
 * 📱 CREW FOR AN EVENT (owner 2026-10-29): pick the event → its ONE crew code. The code is made, replaced and turned off
 * in Hub › Crew, and every phone that scans waits there for the Allow — this page only shows the code, so nothing
 * about who is let in is decided twice. Each state is said in words; a refused read is never "no code yet".
 */
export type CrewQr = {
  /** null = the shop's events could not be read (said); [] options = no event today or ahead. */
  eventPick: { value: string; options: QrPick[] } | null;
  /** The picked event's name, for the card's title. */
  eventName: string | null;
  code:
    | { state: 'ready'; url: string; svg: string | null; endsWords: string; waiting: number | null }
    | { state: 'none' }
    | { state: 'unread' }
    | { state: 'not-admin' }
    | null;
  /** Hub › Crew for the picked event — where the code is made and phones are allowed in. */
  hubHref: string | null;
};

export type IssuedRow = {
  token: string;
  title: string;
  line: string;
  status: 'pending' | 'claimed' | 'void';
  showHref: string | null;
  /** #34: waiting → change it · used → that client's Details · deleted → null. */
  openHref: string | null;
};


/**
 * Each code's words (the prototype's "what it does" list): the row line is the shipped caption cut at the dash; the
 * sheet shows it whole. ⚠ Reviews: the prototype's "They scan to review you" describes `/v/<slug>/review` (PR #7329,
 * not merged) — this code opens `/v/<slug>#reviews` today, so its words say what it does now.
 */
const WORDS: Record<SupplierQrMode, { name: string; sub?: string; perEvent?: boolean; line: string; sheetLine: string }> = {
  dates: { name: 'Check a date', sub: 'free', line: 'They scan and see which days you can still be booked', sheetLine: 'They scan and see which days you can still be booked — never who booked or who is asking.' },
  shortlist: { name: 'Shortlist', sub: 'free', line: 'They scan, sign up free, and you join their shortlist', sheetLine: 'They scan, sign up free, and you join their shortlist.' },
  page: { name: 'My page', line: 'They scan and open your Setnayan page', sheetLine: 'They scan and open your Setnayan page — your services, photos and reviews.' },
  reviews: { name: 'Reviews', line: 'They scan and read your reviews', sheetLine: 'They scan and open your Setnayan page at its reviews.' },
  locked: { name: 'Booked', sub: 'one-use', perEvent: true, line: 'One use — give it to that one customer', sheetLine: 'One use — give it to that one customer. A Locked QR means you’ve agreed on a date.' },
  crew: { name: 'Crew for an event', perEvent: true, line: 'They scan, then wait for your Allow', sheetLine: 'They scan, then wait for your Allow.' },
};

type ShopCode = { url: string; svg: string | null; shopName: string };

type Booked = {
  /** The code just issued, drawn as the card. */
  issued: { url: string; svg: string | null; title: string; line: string; used: boolean; stamp?: string } | null;
  /** The generator's refusal, in words. */
  error: string | null;
  /** The deal form (the shipped `LockedQrGenerator`), handed in. */
  generator: ReactNode;
  /** null = the ledger could not be read — said, never "none". */
  ledger: IssuedRow[] | null;
  ledgerOpen: boolean;
  newHref: string;
};

export function QrCodes({
  place = 'customers',
  open = null,
  backHref,
  canShare,
  setupHref,
  shortlist,
  booked,
  checkADate = null,
  myPage = null,
  reviews = null,
  crew = null,
  hrefs = {},
}: {
  /** Which home draws it: Customers › QR codes (‹ Dates + the page title) or Shop › Promote (a section under the Shop row). */
  place?: 'customers' | 'promote';
  /** The code whose sheet opens on arrival — a link that names one (`?mode=` with something to show). */
  open?: SupplierQrMode | null;
  backHref: string;
  /** The shop has an address (a slug) — every code is built from it. */
  canShare: boolean;
  setupHref: string;
  shortlist: {
    url: string;
    svg: string | null;
    shopName: string;
    eventPick: { value: string; options: QrPick[] };
    servicePick: { value: string; options: QrPick[] };
    /** "as Photo & video on a wedding plan" — what a scan files them under. */
    scope: string;
  } | null;
  booked: Booked | null;
  /** 📅 Check a date (owner 2026-10-28): the shop's one permanent code → `/v/<slug>/dates` (`lib/check-a-date-qr.ts`). */
  checkADate?: ShopCode | null;
  /** 🔳 My page (owner 2026-10-29): the shop's own Setnayan page → `/v/<slug>` (`lib/supplier-qr-codes.ts`). */
  myPage?: ShopCode | null;
  /** ⭐ Reviews (Option B, 2026-11-06): the shop's page at its reviews — the address the printed code opens (`printQrUrl`). */
  reviews?: ShopCode | null;
  crew?: CrewQr | null;
  /** Where a row goes when its sheet is not drawn on this visit (Customers reads Booked OR Crew per visit). */
  hrefs?: Partial<Record<SupplierQrMode, string>>;
}) {
  const row = (key: SupplierQrMode, thumb: string | null, body: ReactNode | null): QrRow => ({
    key,
    ...WORDS[key],
    thumb,
    body,
    href: hrefs[key],
    putOn: place === 'promote' && (key === 'dates' || key === 'shortlist' || key === 'page' || key === 'reviews') ? key : undefined,
  });

  const rows: QrRow[] =
    place === 'promote'
      ? [
          row(
            'dates',
            checkADate?.svg ?? null,
            checkADate ? (
              <div className="mt-3.5">
                <QrCard svg={checkADate.svg} url={checkADate.url} title={checkADate.shopName} line={WORDS.dates.sheetLine} filename="setnayan-check-a-date-qr.svg" data="check-a-date" />
              </div>
            ) : null,
          ),
          row(
            'shortlist',
            shortlist?.svg ?? null,
            shortlist ? (
              <>
                <div className="mt-2">
                  <DatesRow title="For" line="The kind of event a scan starts" end={<CustomersPick label="For" value={shortlist.eventPick.value} options={shortlist.eventPick.options} dataAttr="data-qr-event" className="!min-h-11" />} />
                  <DatesRow title="Service" line="What they shortlist you as" end={<CustomersPick label="Service" value={shortlist.servicePick.value} options={shortlist.servicePick.options} dataAttr="data-qr-service" className="!min-h-11" />} />
                </div>
                <div className="mt-3.5">
                  <QrCard
                    svg={shortlist.svg}
                    url={shortlist.url}
                    title={shortlist.shopName}
                    line={`They scan, sign up free, and you join their shortlist${shortlist.scope}.`}
                    filename="setnayan-shortlist-qr.svg"
                    data="shortlist"
                  />
                </div>
              </>
            ) : null,
          ),
          row(
            'page',
            myPage?.svg ?? null,
            myPage ? (
              <div className="mt-3.5">
                <QrCard svg={myPage.svg} url={myPage.url} title={myPage.shopName} line={WORDS.page.sheetLine} filename="setnayan-my-page-qr.svg" data="my-page" />
              </div>
            ) : null,
          ),
          row(
            'reviews',
            reviews?.svg ?? null,
            reviews ? (
              <div className="mt-3.5">
                <QrCard svg={reviews.svg} url={reviews.url} title={reviews.shopName} line={WORDS.reviews.sheetLine} filename="setnayan-reviews-qr.svg" data="reviews" />
              </div>
            ) : null,
          ),
        ]
      : [
          row('locked', booked?.issued?.svg ?? null, booked ? <BookedBody booked={booked} /> : null),
          row('crew', crew?.code?.state === 'ready' ? crew.code.svg : null, crew ? <CrewCode crew={crew} /> : null),
        ];

  return (
    <div
      className={place === 'promote' ? 'w-full max-w-xl' : 'mx-auto w-full max-w-xl px-4 pb-16 pt-3 sm:px-6'}
      data-qr-codes="list"
      data-qr-place={place}
    >
      {place === 'customers' ? (
        <Link href={backHref} className="sn-press -ml-1 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-ink" data-qr-back="">
          <ChevronLeft aria-hidden className="h-5 w-5 text-sn-accent" strokeWidth={2} />
          Dates
        </Link>
      ) : null}
      {place === 'promote' ? (
        <InfoTip label="QR codes" labelAs="h2" labelClassName="text-[20px] font-bold leading-tight tracking-[-0.015em] text-ink" align="start" className="mt-3">
          Each code is one row: what a scan does, and the code itself. Tap a row to open it big, share it, copy its link, download it or write it to an NFC tag — and to put it on your prints. Your codes are built from your shop’s web address.
        </InfoTip>
      ) : (
        // The page's own title stays an <h1> (an inline ⓘ inside it — a <span> wrapper is valid in a heading).
        <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink">
          <InfoTip label="QR codes" align="start">
            Booked and Crew belong to one event. Tap a row to open it big, share it, copy its link, download it or write it to an NFC tag. Your codes are built from your shop’s web address.
          </InfoTip>
        </h1>
      )}
      <p className="mb-1 mt-0.5 text-[13px] text-[var(--sn-ink-500)]">Tap a code to see it big and share it</p>

      {!canShare ? (
        <div className="mt-3" data-qr-no-address="">
          <DatesRow title="Name your shop first" line="Your codes are built from your shop’s web address" href={setupHref} />
        </div>
      ) : (
        <QrCodeList rows={rows} openKey={open} />
      )}
    </div>
  );
}

/** Booked · one-use's sheet: the refusal in words · the issued code + Make another, or the deal form · the Issued ledger. */
function BookedBody({ booked }: { booked: Booked }) {
  const ledger = booked.ledger;
  const claimed = ledger?.filter((r) => r.status === 'claimed').length ?? 0;
  const voided = ledger?.filter((r) => r.status === 'void').length ?? 0;
  return (
    <>
      {booked.error ? (
        <p role="alert" className="mt-3 text-[13.5px] text-[rgb(var(--color-danger))]" data-qr-error="">
          {booked.error}
        </p>
      ) : null}
      {booked.issued ? (
        <div className="mt-3.5">
          <QrCard
            svg={booked.issued.svg}
            url={booked.issued.url}
            title={booked.issued.title}
            line={booked.issued.line}
            filename="setnayan-booked-qr.svg"
            state={booked.issued.used ? 'used' : 'ready'}
            stamp={booked.issued.stamp}
            data="booked"
          />
          <div className="mt-2">
            <DatesRow title="Make another" line="One code per customer — it works once" href={booked.newHref} />
          </div>
        </div>
      ) : (
        <div className="mt-3">{booked.generator}</div>
      )}
      <div className="mt-2 border-t border-ink/10" id="issued">
        <Fold
          title="Booked QRs"
          line={
            ledger === null
              ? 'Couldn’t load — any code you issued still works'
              : ledger.length === 0
                ? 'None yet'
                : `${formatCount(ledger.length - claimed - voided)} waiting · ${formatCount(claimed)} used · ${formatCount(voided)} deleted`
          }
          defaultOpen={booked.ledgerOpen}
          data="qr-issued"
        >
          <div className="pb-3">
            {ledger === null ? (
              <p role="alert" className="py-2 text-[13.5px] text-ink/70">
                We couldn&rsquo;t load your issued codes. This is not a statement that you have none — any code you issued still works. Reload
                before issuing a replacement.
              </p>
            ) : ledger.length === 0 ? (
              <p className="py-2 text-[13.5px] text-ink/60">The one-use codes you issue to lock in a customer show here.</p>
            ) : (
              // #34 Waiting · Used · Deleted — tap to change / open the client, swipe a waiting one to delete (Undo).
              <BookedQrsList rows={ledger} />
            )}
          </div>
        </Fold>
      </div>
    </>
  );
}

function CrewCode({ crew }: { crew: CrewQr }) {
  if (crew.eventPick === null) {
    return (
      <p role="alert" className="mt-3 text-[14px] text-ink/70" data-qr-crew="events-unread">
        We couldn&rsquo;t load your events just now. Any crew code you made still works — reload to try again.
      </p>
    );
  }
  if (crew.eventPick.options.length === 0) {
    return (
      <div className="mt-3" data-qr-crew="no-events">
        <DatesRow title="No event ahead yet" line="A crew code is made for a booked event, today or later" />
      </div>
    );
  }
  const code = crew.code;
  return (
    <>
      <div className="mt-2">
        <DatesRow
          title="Event"
          line="Whose crew this code lets in"
          end={<CustomersPick label="Event" value={crew.eventPick.value} options={crew.eventPick.options} dataAttr="data-qr-crew-event" className="!min-h-11" />}
        />
      </div>
      {code?.state === 'ready' ? (
        <div className="mt-3.5" data-qr-crew="ready">
          <QrCard
            svg={code.svg}
            url={code.url}
            title={`Crew · ${crew.eventName ?? 'this event'}`}
            line={`They scan, then wait for your Allow · ${code.endsWords}`}
            filename="setnayan-crew-qr.svg"
            data="crew"
          />
          {crew.hubHref ? (
            <div className="mt-2">
              <DatesRow
                title="Phones on the crew"
                line={
                  code.waiting === null
                    ? 'Couldn’t count who is waiting — open the crew to see'
                    : code.waiting === 0
                      ? 'Allow, change a role or replace the code'
                      : `${formatCount(code.waiting)} waiting for your Allow`
                }
                badge={code.waiting ? { tone: 'wait', word: 'Waiting' } : null}
                href={crew.hubHref}
                data="qr-crew-hub"
              />
            </div>
          ) : null}
        </div>
      ) : code?.state === 'unread' ? (
        <p role="alert" className="mt-3 text-[14px] text-ink/70" data-qr-crew="code-unread">
          We couldn&rsquo;t load this event&rsquo;s crew code. If you made one, it still works — reload to try again.
        </p>
      ) : code?.state === 'not-admin' ? (
        <div className="mt-3" data-qr-crew="not-admin">
          <DatesRow title="Only the shop’s owner or an admin" line="They make the crew code and let phones in" />
        </div>
      ) : (
        <div className="mt-3" data-qr-crew="none">
          <DatesRow title="Make the crew code" line="In this event’s Hub — then it shows here too" href={crew.hubHref} />
        </div>
      )}
    </>
  );
}
