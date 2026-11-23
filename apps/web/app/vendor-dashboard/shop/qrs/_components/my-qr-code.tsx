import { DoorOpen, Printer } from 'lucide-react';
import { QrCard } from '@/app/_components/qr-card';
import { NfcTapTest } from '@/app/_components/nfc-tap-test';
import { TemplateRow, TemplateRows } from '@/app/_components/template-rows';
import { ToolSection } from '@/app/vendor-dashboard/_components/tool-page';
import { RowIcon } from '@/app/vendor-dashboard/_components/row-icon';
import { MY_QR_WORDS, printWithQrHref } from '@/lib/supplier-qr-codes';
import { CustomersPick } from '../../../customers/_components/customers-pick';
import { DatesRow } from '../../../customers/_components/dates-row';
import { OwnLinkAddGiftNotice, OwnLinkGift } from '../../../invite/_components/own-client-gift';
import type { MyQrCodeData } from './my-qrs-data';

/**
 * 🔳 ONE QR, OPENED (drawing `supplier_store_graphs_badges_2026-11-23`, frame "One QR, opened", v18): the code big, its
 * buttons, then "Print it". Everything the old sheet on Promote held stays, on this page (owner ruling, DECISION_LOG
 * "STORE DRAWING v13→v18 RULINGS" (1): *"must keep Shortlist's two picks, the own-link gift and the NFC test"*):
 *
 *   · Shortlist          its two picks — For (the kind of event a scan starts) · Service (what they shortlist you as)
 *   · every code         the shipped `QrCard`: tap = the code full screen · Download (filled, the drawing's) · Share ·
 *                        Copy link · Write to NFC (`QrActions` → `NfcWriteButton`)
 *   · Your page          the own-link gift (`OwnLinkGift`) and the NFC Tap test on this phone (`NfcTapTest`, v110: the tap
 *                        carries the same link as the shop code)
 *   · Your page · Reviews · Check a date   the "add a gift to your link" notice, when a verified shop's link has none
 *   · Print it           Door print · Prints — the old sheet's "Put it on…", now an address: Promote's Prints opens on
 *                        THIS code (`printWithQrHref`)
 *
 * Server component: every word arrives read.
 */
export function MyQrCode({ d }: { d: MyQrCodeData }) {
  const w = MY_QR_WORDS[d.code];
  return (
    <div data-my-qr={d.code}>
      {d.shortlist ? (
        <div className="mt-2" data-my-qr-picks="">
          <DatesRow
            title="For"
            line="The kind of event a scan starts"
            end={<CustomersPick label="For" value={d.shortlist.eventPick.value} options={d.shortlist.eventPick.options} dataAttr="data-qr-event" className="!min-h-11" />}
          />
          <DatesRow
            title="Service"
            line="What they shortlist you as"
            end={<CustomersPick label="Service" value={d.shortlist.servicePick.value} options={d.shortlist.servicePick.options} dataAttr="data-qr-service" className="!min-h-11" />}
          />
        </div>
      ) : null}
      {d.addGiftNotice ? <OwnLinkAddGiftNotice /> : null}
      <div className="mt-3">
        <QrCard
          svg={d.svg}
          url={d.url}
          title={d.shopName}
          line={d.shortlist ? `They scan, sign up free, and you join their shortlist${d.shortlist.scope}.` : w.sheetLine}
          filename={w.file}
          primary="download"
          data={w.data}
        />
      </div>
      {d.ownGift ? <OwnLinkGift verified={d.ownGift.verified} data={d.ownGift.data} current={d.ownGift.current} /> : null}
      {d.code === 'page' ? (
        <ToolSection label="Scan or tap" data="my-qr-nfc">
          <p className="pb-1 text-sn-md text-[color:var(--m-slate-2)]" data-shop-qr-nfc="">
            The NFC tap carries the same link as this code
          </p>
          <NfcTapTest url={d.url} />
        </ToolSection>
      ) : null}
      <ToolSection label="Print it" data="my-qr-print">
        <TemplateRows label="Print it">
          <TemplateRow lead={<RowIcon icon={DoorOpen} />} title="Door print" line="We are part of Setnayan, with this code" href={printWithQrHref(d.code, 'door')} data="my-qr-print-door" />
          <TemplateRow lead={<RowIcon icon={Printer} />} title="Prints" line="This code on your cards, stickers and posters" href={printWithQrHref(d.code)} data="my-qr-print-prints" />
        </TemplateRows>
      </ToolSection>
    </div>
  );
}
