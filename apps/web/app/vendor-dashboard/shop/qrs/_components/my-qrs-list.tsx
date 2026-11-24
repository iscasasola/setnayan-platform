import Link from 'next/link';
import { Printer, QrCode } from 'lucide-react';
import { TemplateRow, TemplateRows } from '@/app/_components/template-rows';
import { ToolSection } from '@/app/vendor-dashboard/_components/tool-page';
import { RowIcon } from '@/app/vendor-dashboard/_components/row-icon';
import { MY_QRS_HREF, MY_QRS_SHOP_ORDER, MY_QR_WORDS, myQrHref, printWithQrHref, type PromoteQrMode } from '@/lib/supplier-qr-codes';

/**
 * 🔳 MY QRs — the list (drawing `supplier_store_graphs_badges_2026-11-23`, frame "My QRs", v18). ONE list, drawn in three
 * places, so the shop's codes are never listed twice in two ways:
 *
 *   · the My QRs page itself (`shop/qrs/page.tsx`)
 *   · Shop's QR sheet (`PromoteBody part="qr"` — the sheet the cover's QR button opens, and Promote's "My QRs" tab)
 *   · the Promote page's first section (`PromoteBody part="all"`)
 *
 *   Your shop      Your page · Reviews · Shortlist · Check a date   → each opens its own page ("One QR, opened")
 *   QR designs     Print your QR on a card, a sticker or a poster   → the Toolkit's QR designs shelf; until that shelf
 *                                                                     ships, Shop › Promote's Prints (never a dead link)
 *
 * The drawing's "From your widgets" group (a saved widget's code, Date check's code) needs Save to My QRs, which is not
 * built — so it is NOT drawn: no empty group. The rows show no small code: the drawing draws the QR mark, and each code is
 * made only on its own page.
 *
 * Server-safe: no hooks, no reads — the caller says whether the shop has a web address yet (every code is built on it).
 */
export function MyQrsList({
  canShare,
  setupHref,
  embedded = false,
  hide = [],
}: {
  canShare: boolean;
  setupHref: string;
  embedded?: boolean;
  /** 🧩 Toolkit v19: the QR designs the shop removed in the Toolkit — not listed (Your page is built in, never hidden). The code still works. */
  hide?: readonly PromoteQrMode[];
}) {
  return (
    <div data-my-qrs={embedded ? 'embedded' : 'page'}>
      {embedded ? (
        <ToolSection
          label="My QRs"
          data="my-qrs"
          right={
            <Link href={MY_QRS_HREF} className="sn-press inline-flex min-h-11 items-center text-[rgb(var(--color-link))]" data-my-qrs-open="">
              Open page
            </Link>
          }
        />
      ) : null}
      <ToolSection label="Your shop" data="my-qrs-shop">
        {canShare ? (
          <TemplateRows label="Your shop’s codes">
            {MY_QRS_SHOP_ORDER.map((code) => {
              if (code !== 'page' && hide.includes(code)) return null;
              const w = MY_QR_WORDS[code];
              return (
                <TemplateRow
                  key={code}
                  lead={<RowIcon icon={QrCode} />}
                  title={
                    <>
                      {w.name}
                      {w.sub ? <span className="font-normal text-[color:var(--m-slate-2)]"> · {w.sub}</span> : null}
                    </>
                  }
                  line={w.line}
                  href={myQrHref(code)}
                  data={`my-qr-${code}`}
                />
              );
            })}
          </TemplateRows>
        ) : (
          <TemplateRows label="Your shop’s codes">
            <TemplateRow title="Name your shop first" line="Your codes are built from your shop’s web address" href={setupHref} data="my-qr-no-address" />
          </TemplateRows>
        )}
      </ToolSection>
      <ToolSection label="QR designs" data="my-qrs-designs">
        <TemplateRows label="QR designs">
          <TemplateRow
            lead={<RowIcon icon={Printer} />}
            title="Print your QR"
            line="On a card, a sticker or a poster, from your Prints"
            href={printWithQrHref(null)}
            data="my-qr-designs"
          />
        </TemplateRows>
      </ToolSection>
    </div>
  );
}
