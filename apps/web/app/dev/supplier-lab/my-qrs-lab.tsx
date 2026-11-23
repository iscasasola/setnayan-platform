import '@/app/vendor-dashboard/_components/supplier-look.css';
import type { ReactNode } from 'react';
import { renderUrlQrSvg } from '@/lib/qr';
import { ownGiftDataOf } from '@/lib/own-clients';
import { MY_QRS_HREF, MY_QR_WORDS, myQrCodeOf, myQrHref, type PromoteQrMode } from '@/lib/supplier-qr-codes';
import { ToolFail, ToolPage, ToolPin } from '@/app/vendor-dashboard/_components/tool-page';
import { MyQrsList } from '@/app/vendor-dashboard/shop/qrs/_components/my-qrs-list';
import { MyQrCode } from '@/app/vendor-dashboard/shop/qrs/_components/my-qr-code';
import type { MyQrCodeData } from '@/app/vendor-dashboard/shop/qrs/_components/my-qrs-data';

/**
 * 🔳 MY QRs LAB — the real pieces (`MyQrsList`, `MyQrCode`) on sample data, for the drawing check and the screenshots
 * (`supplier_store_graphs_badges_2026-11-23`, frames "My QRs" · "One QR, opened"). No reads, no writes.
 *
 *   ?s=my-qrs                    the list · &state=no-address · &state=fail
 *   ?s=my-qr&code=page|reviews|shortlist|dates   one code opened · &state=fail
 */
const SLUG = 'lumina-studio';
const URLS: Record<PromoteQrMode, string> = {
  page: `https://setnayan.com/${SLUG}?src=own`,
  reviews: `https://setnayan.com/${SLUG}/review?src=own`,
  shortlist: `https://setnayan.com/vendor-invite/${SLUG}?et=wedding`,
  dates: `https://setnayan.com/${SLUG}/dates?src=own`,
};

/** The supplier shell's own ground and blue look (`../template.tsx` carries the same attribute). */
function Look({ children }: { children: ReactNode }) {
  return (
    <div className="sn-ambient min-h-dvh pt-2" data-supplier-look="" data-lab-my-qrs="">
      {children}
    </div>
  );
}

/** An empty gift stock, read fine (a stock of nothing is not a refused read). */
const NONE = { balance: 0, held: 0 };
const LAB_STOCK = { papic: NONE, event_plus: NONE, event_pro: NONE, event_ultra: NONE, packs: {} };

export async function MyQrsLab({ s, code: raw, state }: { s: string; code?: string; state?: string }) {
  if (s === 'my-qrs') {
    return (
      <Look>
        <ToolPage name="my-qrs">
          <ToolPin route={MY_QRS_HREF} title="My QRs" sub="Every QR code your shop has" />
          {state === 'fail' ? (
            <ToolFail title="Couldn’t load your QR codes" line="Every code you printed or shared still works." retryHref="/dev/supplier-lab?s=my-qrs" data="my-qrs" />
          ) : (
            <MyQrsList canShare={state !== 'no-address'} setupHref="/dev/supplier-lab?s=my-qrs" />
          )}
        </ToolPage>
      </Look>
    );
  }
  const code = myQrCodeOf(raw) ?? 'page';
  const w = MY_QR_WORDS[code];
  const url = URLS[code];
  const lab = (q: string) => `/dev/supplier-lab?s=my-qr&code=shortlist${q}`;
  const d: MyQrCodeData = {
    code,
    url,
    svg: await renderUrlQrSvg(url, 220).catch(() => null),
    shopName: 'Lumina Studio',
    addGiftNotice: code === 'reviews',
    shortlist:
      code === 'shortlist'
        ? {
            eventPick: { value: 'wedding', options: [{ key: 'any', label: 'Any event', href: lab('') }, { key: 'wedding', label: 'Wedding', href: lab('&et=wedding') }, { key: 'debut', label: 'Debut', href: lab('&et=debut') }] },
            servicePick: { value: 'all', options: [{ key: 'all', label: 'All my services', href: lab('') }, { key: 'photo_video', label: 'Photo & video', href: lab('&cat=photo_video') }] },
            scope: ' on their wedding plan',
          }
        : null,
    ownGift: code === 'page' ? { verified: true, data: ownGiftDataOf({ stock: LAB_STOCK, packs: [], canBuy: false, openRails: [] }), current: null } : null,
  };
  return (
    <Look>
      <ToolPage name="my-qr">
        <ToolPin route={`${MY_QRS_HREF}/[code]`} title={w.name} sub={state === 'fail' ? w.line : url.replace(/^https:\/\//, '').replace(/\?.*$/, '')} />
        {state === 'fail' ? (
          <ToolFail title={`Couldn’t load your ${w.name} code`} line="Any copy you printed or shared still works." retryHref={myQrHref(code)} data="my-qr" />
        ) : (
          <MyQrCode d={d} />
        )}
      </ToolPage>
    </Look>
  );
}
