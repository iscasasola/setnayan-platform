/**
 * 📣 PROMOTE'S BODY — ONE body, mounted by the Promote page AND by Shop's cover sheets (THE ONE BUILD A3 W5/W6,
 * lane C4): `part="all"` = the page (My QRs · Prints · Gifts · Share your work); `part="promote"` = the Promote sheet
 * (Prints · Gifts · Share your work — no Boost, v112); `part="qr"` = the QR sheet, which IS the My QRs list now;
 * `part="prints"` = the prints alone. Each part reads only what it draws.
 *
 * 🔳 MY QRs REPLACES PROMOTE'S QR PART (owner 23 Nov 2026, verbatim: *"this also means we have to get cloud create a QR
 * Page that will replace our current QR page."*). The shop's four codes moved to `shop/qrs/` — the list here is that
 * page's own (`MyQrsList`), each row opening the code's page, where Shortlist's two picks, the own-link gift and the NFC
 * Tap test now live. Nothing about the codes is read here any more.
 *
 * 🖨 "Print it" on a code's page comes back here as an address (`printWithQrHref`: `?print=<code>[&piece=door]#prints`)
 * — the Prints section opens on THAT code (the old sheet's "Put it on…", which handed the code over on the same page).
 * The full story of each part is on `../page.tsx`'s docblock.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { PROMOTE_QR_MODES, type PromoteQrMode, SHOP_NAME_SETUP_HREF } from '@/lib/supplier-qr-codes';
import { printLine } from '@/lib/supplier-prints-shop';
import { MyQrsList } from '../../qrs/_components/my-qrs-list';

import { ShopGiftsSection } from './shop-gifts-section';
import { loadShopGiftsSection } from './shop-gifts-data';
import { ShareYourWork } from './share-your-work';
import { loadShareYourWork } from './share-your-work-data';
import { ShopPrintsSection } from './shop-prints-section';
import { createAdminClient } from '@/lib/supabase/admin';
import { readStoreLayout } from '@/lib/supplier-store.server';
import { hiddenQrs } from '@/lib/supplier-store';
import { readPrintMember } from '@/lib/supplier-prints.server';

/** `prints` = the Shop quick row's Prints tile (owner 17 Nov: "change Promote on Shop to Prints") — the prints alone. */
export type PromotePart = 'all' | 'promote' | 'qr' | 'prints';

/** `?print=<code>[&piece=door]` → the code the Prints section opens on (a code page's "Print it"); anything else = none. */
function printAskOf(search: { print?: string; piece?: string }): { qr: PromoteQrMode; piece: 'door' | null } | null {
  const qr = (PROMOTE_QR_MODES as readonly string[]).includes(search.print ?? '') ? (search.print as PromoteQrMode) : null;
  return qr ? { qr, piece: search.piece === 'door' ? 'door' : null } : null;
}

export async function PromoteBody({
  search,
  part,
  gifts: giftsRead,
}: {
  search: { et?: string; cat?: string; mode?: string; print?: string; piece?: string };
  part: PromotePart;
  /** The gift stock, when the caller already read it (the Promote page's pinned row shows its balance) — read once. */
  gifts?: Promise<Awaited<ReturnType<typeof loadShopGiftsSection>>>;
}) {
  const withQr = part === 'all' || part === 'qr';
  const withPromote = part !== 'qr';
  // The prints alone: no gifts, no stories — neither is read.
  const withRest = withPromote && part !== 'prints';
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // Every code is built on the shop's public address — minted by a trigger the moment a shop is named.
  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  const canShare = Boolean(slug);
  const shopName = (profile as { business_name?: string | null }).business_name?.trim() || 'Your shop';
  // 🎁 Each part reads only what it draws: the QR sheet never pays for the gifts, the stories or the prints.
  const giftsPromise = withRest ? (giftsRead ?? loadShopGiftsSection(supabase, profile.vendor_profile_id)) : Promise.resolve(null);
  // Awaited below; this only keeps a throw from being "unhandled" while the rest is read — it still surfaces there.
  giftsPromise.catch(() => undefined);
  // 📣 Row 4 — read beside the gifts; the loader says a refused read in words (never throws).
  const sharePromise = withRest ? loadShareYourWork(supabase, profile.vendor_profile_id) : Promise.resolve(null);
  // 🪪 The signed-in member's own calling card (owner 2026-11-06, "Yes") — their account name and Team label; no name =
  // no card. Read beside the gifts and the share read (a refused read = no personal card, never a broken sheet).
  const memberPromise = canShare && withPromote ? readPrintMember(createAdminClient(), profile.vendor_profile_id, user.id).catch(() => null) : Promise.resolve(null);

  const kindLabel = withPromote ? await cardKindLabeller() : null;
  const profileServices = ((profile as { services?: string[] | null }).services ?? []) as string[];
  // 🖨 YOUR FACTS (prints prototype, 5 Nov): the name and the line every print carries — the SAME builder the renderer uses.
  const printFacts = kindLabel ? { name: shopName, line: printLine(profileServices, (profile as { tagline?: string | null }).tagline ?? null, kindLabel) } : null;
  const printAsk = printAskOf(search);

  // 🧩 Toolkit v19: a QR design the shop removed in the Toolkit is not listed (Your page is built in). Read beside the
  // rest; a refused read hides nothing — every code still shows.
  const hidePromise = withQr ? readStoreLayout(supabase, profile.vendor_profile_id).then(hiddenQrs) : Promise.resolve([]);
  const [gifts, share, member] = await Promise.all([giftsPromise, sharePromise, memberPromise]);
  const hide = await hidePromise;

  return (
    <div className="space-y-4" data-promote-body={part}>
      {withQr ? <MyQrsList canShare={canShare} setupHref={SHOP_NAME_SETUP_HREF} embedded hide={hide} /> : null}
      {withPromote ? (
        <ShopPrintsSection
          canShare={canShare}
          setupHref={SHOP_NAME_SETUP_HREF}
          member={member}
          facts={printFacts}
          backTo={part === 'prints' ? 'Prints' : 'Promote'}
          initialAsk={printAsk}
        />
      ) : null}
      {gifts ? <ShopGiftsSection data={gifts} /> : null}
      {share ? <ShareYourWork data={share} /> : null}
    </div>
  );
}
