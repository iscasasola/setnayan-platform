import Link from 'next/link';
import type { ReactNode } from 'react';
import { ChevronLeft } from 'lucide-react';
import { Fold } from '@/app/_components/fold';
import { QrCard } from '@/app/_components/qr-card';
import { formatCount } from '@/lib/format-number';
import { CustomersPick } from '../../customers/_components/customers-pick';
import { DatesRow } from '../../customers/_components/dates-row';

/**
 * QR CODES — ONE page for the shop's two codes (S-PR3; plan § 2 "`/invite` (Shortlist / Locked QR toggle) +
 * `/locked-qr` ledger — Merge: one 'QR codes' (Shortlist · Booked — one dropdown), ledger inside"; prototype frames
 * 10 and 40; control templates round 2, kind 24 QR card — Share main, Download second).
 *
 *   ‹ Dates · QR codes · [Shortlist · free ▾ | Booked · one-use ▾]
 *   Shortlist — For ▾ (event) · Service ▾ · the card (they scan, you join their shortlist).
 *   Booked    — the generator (the deal: who, total, first payment, proof) · the issued code's card · Issued ⌄ (the
 *               ledger that was `/locked-qr`: each code claimed / pending / void, a pending one shown again).
 *
 * Reached from Customers › Dates (the QR codes row); `/locked-qr` forwards to Booked with Issued open.
 * Server component: every word arrives read.
 */

export type QrPick = { key: string; label: string; href: string };

export type IssuedRow = {
  token: string;
  title: string;
  line: string;
  status: 'pending' | 'claimed' | 'void';
  showHref: string | null;
};

const STATUS_BADGE = {
  pending: { tone: 'wait', word: 'Pending' },
  claimed: { tone: 'ok', word: 'Claimed' },
  void: { tone: 'quiet', word: 'Void' },
} as const;

export function QrCodes({
  mode,
  backHref,
  modeOptions,
  canShare,
  setupHref,
  shortlist,
  booked,
}: {
  mode: 'shortlist' | 'locked';
  backHref: string;
  modeOptions: QrPick[];
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
  booked: {
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
  } | null;
}) {
  const ledger = booked?.ledger ?? null;
  const claimed = ledger?.filter((r) => r.status === 'claimed').length ?? 0;
  const voided = ledger?.filter((r) => r.status === 'void').length ?? 0;
  return (
    <div className="mx-auto w-full max-w-xl px-4 pb-16 pt-3 sm:px-6" data-qr-codes={mode}>
      <Link href={backHref} className="sn-press -ml-1 inline-flex min-h-11 items-center gap-1 text-[15px] font-medium text-ink" data-qr-back="">
        <ChevronLeft aria-hidden className="h-5 w-5 text-sn-accent" strokeWidth={2} />
        Dates
      </Link>
      <h1 className="mt-2 text-[28px] font-semibold leading-tight tracking-tight text-ink">QR codes</h1>
      <div className="mt-3">
        <CustomersPick label="Which code" value={mode} options={modeOptions} dataAttr="data-qr-mode" className="!min-h-11" />
      </div>

      {!canShare ? (
        <div className="mt-6" data-qr-no-address="">
          <DatesRow title="Name your shop first" line="Your codes are built from your shop’s web address" href={setupHref} />
        </div>
      ) : mode === 'shortlist' && shortlist ? (
        <>
          <div className="mt-4">
            <DatesRow title="For" line="The kind of event a scan starts" end={<CustomersPick label="For" value={shortlist.eventPick.value} options={shortlist.eventPick.options} dataAttr="data-qr-event" compact />} />
            <DatesRow title="Service" line="What they shortlist you as" end={<CustomersPick label="Service" value={shortlist.servicePick.value} options={shortlist.servicePick.options} dataAttr="data-qr-service" compact />} />
          </div>
          <div className="mt-6">
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
      ) : booked ? (
        <>
          {booked.error ? (
            <p role="alert" className="mt-4 text-[13.5px] text-[rgb(var(--color-danger))]" data-qr-error="">
              {booked.error}
            </p>
          ) : null}
          {booked.issued ? (
            <div className="mt-6">
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
              <div className="mt-4">
                <DatesRow title="Make another" line="One code per customer — it works once" href={booked.newHref} />
              </div>
            </div>
          ) : (
            <div className="mt-4">{booked.generator}</div>
          )}
          <div className="mt-6 border-t border-ink/10" id="issued">
            <Fold
              title="Issued"
              line={
                ledger === null
                  ? 'Couldn’t load — any code you issued still works'
                  : ledger.length === 0
                    ? 'None yet'
                    : `${formatCount(ledger.length)} · ${formatCount(claimed)} claimed · ${formatCount(voided)} void`
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
                  ledger.map((r) => <DatesRow key={r.token} data="issued" title={r.title} line={r.line} badge={STATUS_BADGE[r.status]} href={r.showHref} />)
                )}
              </div>
            </Fold>
          </div>
        </>
      ) : null}
    </div>
  );
}
