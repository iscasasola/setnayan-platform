/**
 * 📣 PROMOTE'S BODY — ONE body, mounted by the Promote page AND by Shop's two cover sheets (THE ONE BUILD A3 W5/W6,
 * lane C4): `part="all"` = the page as it was (QR codes · Prints · Gifts · Share your work); `part="promote"` = the
 * Promote sheet (Prints · Gifts · Share your work — no Boost, v112); `part="qr"` = the QR sheet ("Scan or tap": the
 * shop's codes, each with the shipped NFC writer, + the Tap test on this phone). Extracted from `../page.tsx` verbatim —
 * the reads, the words and the components are the page's; each part reads only what it draws.
 * The full story of each part is on `../page.tsx`'s docblock.
 */
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { fetchOwnVendorProfile } from '@/lib/vendor-profile';
import { renderUrlQrSvg } from '@/lib/qr';
import { checkADateQr } from '@/lib/check-a-date-qr';
import { buildVendorInviteUrl, vendorCoverageCategories } from '@/lib/vendor-couple-invite';
import { getCreatableEventTypes } from '@/lib/event-types-db';
import type { VendorCategory } from '@/lib/vendors';
import { cardKindLabeller } from '@/lib/card-kind-labeller';
import { siteOrigin } from '@/lib/site-origin';
import { PROMOTE_HREF, PROMOTE_QR_MODES, ownPageUrl, promoteQrModeOf, type PromoteQrMode } from '@/lib/supplier-qr-codes';
import { printLine, printQrUrl } from '@/lib/supplier-prints-shop';
import { QrCodes } from '../../../invite/_components/qr-codes';
import { PromoteBridge } from './promote-bridge';
import { ShopGiftsSection } from './shop-gifts-section';
import { loadShopGiftsSection } from './shop-gifts-data';
import { ShareYourWork } from './share-your-work';
import { loadShareYourWork } from './share-your-work-data';
import { ShopPrintsSection } from './shop-prints-section';
import { createAdminClient } from '@/lib/supabase/admin';
import { readPrintMember } from '@/lib/supplier-prints.server';
import { NfcTapTest } from '@/app/_components/nfc-tap-test';
import type { ReactNode } from 'react';

export type PromotePart = 'all' | 'promote' | 'qr';

export async function PromoteBody({
  search,
  part,
  gifts: giftsRead,
}: {
  search: { et?: string; cat?: string; mode?: string };
  part: PromotePart;
  /** The gift stock, when the caller already read it (the Promote page's pinned row shows its balance) — read once. */
  gifts?: Promise<Awaited<ReturnType<typeof loadShopGiftsSection>>>;
}) {
  const withQr = part !== 'promote';
  const withPromote = part !== 'qr';
  const mode: PromoteQrMode = promoteQrModeOf(search.mode);
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect('/login');

  const profile = await fetchOwnVendorProfile(supabase, user.id);
  if (!profile) redirect('/vendor-dashboard');

  // The codes encode the shop's public address — minted by a trigger the moment a shop is named (the twin note on
  // Customers › QR codes, `invite/page.tsx`: gating on `is_published` asked for a button suppliers do not have).
  const slug = (profile as { business_slug?: string | null }).business_slug ?? null;
  const canShare = Boolean(slug);
  const shopName = (profile as { business_name?: string | null }).business_name?.trim() || 'Your shop';
  // 🎁 Read alongside the codes (part 2): the gifts section and the row's figure share this one result.
  // Each part reads only what it draws: the QR sheet never pays for the gifts or the stories.
  const giftsPromise = withPromote ? (giftsRead ?? loadShopGiftsSection(supabase, profile.vendor_profile_id)) : Promise.resolve(null);
  // Awaited below; this only keeps a throw from being "unhandled" while the codes are drawn — it still surfaces there.
  giftsPromise.catch(() => undefined);
  // 📣 Row 4 — read beside the gifts; the loader says a refused read in words (never throws).
  const sharePromise = withPromote ? loadShareYourWork(supabase, profile.vendor_profile_id) : Promise.resolve(null);
  // 🪪 The signed-in member's own calling card (owner 2026-11-06, "Yes") — their account name and Team label; no name =
  // no card. Read beside the gifts and the share read (a refused read = no personal card, never a broken sheet).
  const memberPromise = canShare && withPromote ? readPrintMember(createAdminClient(), profile.vendor_profile_id, user.id).catch(() => null) : Promise.resolve(null);
  // 🔳 OPTION B (owner 2026-11-06, *"B"*): ONE LIST of the shop's four codes, every one drawn on this visit (each row
  // shows its code). `?mode=` names the code whose sheet opens on arrival (an old "Which code ▾" link, a Shortlist pick).
  const opened: PromoteQrMode | null = search.mode && (PROMOTE_QR_MODES as readonly string[]).includes(search.mode) ? mode : null;
  const common = { place: 'promote' as const, open: opened, backHref: PROMOTE_HREF, setupHref: '/vendor-dashboard/shop', booked: null };

  const kindLabel = await cardKindLabeller();
  const profileServices = ((profile as { services?: string[] | null }).services ?? []) as string[];
  // 🖨 YOUR FACTS (prints prototype, 5 Nov): the name and the line every print carries — the SAME builder the renderer uses.
  const printFacts = { name: shopName, line: printLine(profileServices, (profile as { tagline?: string | null }).tagline ?? null, kindLabel) };

  let body: ReactNode = null;
  let pageLink: string | null = null;
  if (!withQr) {
    body = null;
  } else if (!canShare) {
    body = <QrCodes {...common} canShare={false} shortlist={null} />;
  } else {
    const origin = siteOrigin();
    const eventTypes = await getCreatableEventTypes();
    const coverage = vendorCoverageCategories(profileServices);
    const selectedCat = search.cat && coverage.includes(search.cat as VendorCategory) ? (search.cat as VendorCategory) : null;
    const selectedEt = search.et && eventTypes.some((t) => t.key === search.et) ? search.et : null;
    const shortUrl = buildVendorInviteUrl(slug!, { eventType: selectedEt, category: selectedCat });
    // 💳 The "My page" code is the supplier's own: ?src=own (owner 2026-11-13, F-W1-58) — its couples are theirs, no fee.
    const pageUrl = ownPageUrl(origin, slug!);
    pageLink = pageUrl;
    const reviewsUrl = printQrUrl('reviews', origin, slug!);
    const [dates, shortSvg, pageSvg, reviewsSvg] = await Promise.all([
      checkADateQr(slug!),
      renderUrlQrSvg(shortUrl, 220).catch(() => null),
      renderUrlQrSvg(pageUrl, 220).catch(() => null),
      renderUrlQrSvg(reviewsUrl, 220).catch(() => null),
    ]);
    const href = (et: string | null, cat: string | null) => {
      const q = new URLSearchParams({ mode: 'shortlist' });
      if (et) q.set('et', et);
      if (cat) q.set('cat', cat);
      return `${PROMOTE_HREF}?${q.toString()}`;
    };
    const etLabel = eventTypes.find((t) => t.key === selectedEt)?.label ?? null;
    body = (
      <QrCodes
        {...common}
        canShare
        checkADate={{ ...dates, shopName }}
        myPage={{ url: pageUrl, svg: pageSvg, shopName }}
        reviews={{ url: reviewsUrl, svg: reviewsSvg, shopName }}
        shortlist={{
          url: shortUrl,
          svg: shortSvg,
          shopName,
          eventPick: {
            value: selectedEt ?? 'any',
            options: [{ key: 'any', label: 'Any event', href: href(null, selectedCat) }, ...eventTypes.map((t) => ({ key: t.key, label: t.label, href: href(t.key, selectedCat) }))],
          },
          servicePick: {
            value: selectedCat ?? 'all',
            options: [{ key: 'all', label: 'All my services', href: href(selectedEt, null) }, ...coverage.map((c) => ({ key: c, label: kindLabel(c), href: href(selectedEt, c) }))],
          },
          scope: `${selectedCat ? ` as ${kindLabel(selectedCat)}` : ''}${etLabel ? ` on their ${etLabel.toLowerCase()} plan` : ''}`,
        }}
      />
    );
  }


  const [gifts, share, member] = await Promise.all([giftsPromise, sharePromise, memberPromise]);

  return (
    <div className="space-y-4" data-promote-body={part}>
      {withQr ? (
        <PromoteBridge>
          {body}
          {/* 📡 Scan or tap (v110): the NFC tap carries the same link as the shop code — this phone's Tap test. */}
          {part === 'qr' && pageLink ? (
            <div className="border-t border-ink/10 pt-2" data-shop-qr-nfc="">
              <p className="pb-1 text-[12.5px] text-ink/60">Scan or tap · the NFC tap carries the same link as your shop code</p>
              <NfcTapTest url={pageLink} />
            </div>
          ) : null}
          {withPromote ? <ShopPrintsSection canShare={canShare} setupHref="/vendor-dashboard/shop" member={member} facts={printFacts} /> : null}
        </PromoteBridge>
      ) : (
        <PromoteBridge>
          <ShopPrintsSection canShare={canShare} setupHref="/vendor-dashboard/shop" member={member} facts={printFacts} />
        </PromoteBridge>
      )}
      {gifts ? <ShopGiftsSection data={gifts} /> : null}
      {share ? <ShareYourWork data={share} /> : null}
    </div>
  );
}
