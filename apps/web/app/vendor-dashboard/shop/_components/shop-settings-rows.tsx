import type { ReactNode } from 'react';
import { Badge } from '@/app/_components/badge';
import { Fold } from '@/app/_components/fold';
import { formatCount } from '@/lib/format-number';
import type { DetailsRow } from '@/lib/supplier-details';
import { DatesRow } from '../../customers/_components/dates-row';
import { PushToggle } from '../../notifications/push-toggle';
import { SHOP_GEAR_TITLE, YOUR_PAGE_HREF } from './shop-gear-sections';
import { SettingsSection } from '@/app/_components/settings/settings-section';

/**
 * 🏪 THE SHOP ⚙'S FOLDS, drawn (owner 2026-10-31, verbatim *"Yes follow your recommendation"* — DECISION_LOG "SHOP ⚙ —
 * WHAT A SUPPLIER SETS ONCE"). Presentational: the server body (`shop-settings-body.tsx`) hands in the SHIPPED editors
 * it read — the Plan screen, the Helpers screen, the documents — and the dev lab hands in its fixtures, so the lab shows
 * what ships. One fold per thing a supplier sets once; title + one short line on each, the rest inside.
 *   · Plan and billing — the shop wallet's Papic credits, then the Plan screen (plan · what it gives · receipts);
 *   · Team — the Helpers screen;
 *   · Verification and documents — moved here from Shop › Details, with its "Setnayan is checking your documents" line
 *     and status badge (owner 2026-10-31, "Come back to shop"): both show only while the documents are in review;
 *   · Notifications — this phone's push switch and what email carries, moved here from the account menu's Settings.
 * ⏳ Shop status (open or pause bookings, transfer or close) is NOT drawn: nothing stores it yet (`shop-gear-sections.ts`).
 *
 * 🧭 YOUR PAGE LEADS THE SHEET (Build 2 §10 #31, owner 8 Nov: *"these menu are lost… isn't your page inside the shop
 * settings?"*): the Shop page has no loose rows under its cover any more — Your page is the ⚙'s first row ("what couples
 * see · all your reviews inside", its own door to `/vendor-dashboard/website`), and Your details is the top-right
 * account sheet's (`supplier-avatar-rows.ts`). 🔒 lib/my-shop-doors-keep-every-control.test.ts
 *
 * 🧭 SETTINGS V2 (owner 2026-11-13, *"one setting shell approved"*; prototype § 7): the same five things, now under the
 * ONE section heading (Your page · Plan and team · Papers · Notifications), with NO icon tile in front of a row (a frame on
 * something you cannot press). The notification switches leave their fold — one tap, not two; the `notifications`
 * anchor stays, so a deep link still lands there.
 */

export function ShopSettingsRows({
  pageLive = true,
  planLine,
  wallet,
  plan,
  team,
  docs,
}: {
  /** Your page is shown to couples (a slug + a public visibility) — else its line says it is not shown yet. */
  pageLive?: boolean;
  planLine: string;
  /** The shop wallet's row, worded by `lib/shop-wallet.ts` (an unread balance says so, never 0). */
  wallet: { title: string; line: string };
  plan: ReactNode;
  team: ReactNode;
  docs: {
    isVerified: boolean;
    docsIn: number;
    docsTotal: number;
    measured: boolean;
    row: Pick<DetailsRow, 'state' | 'badge'>;
    section: ReactNode;
    /** 🗓 The Mayor's Permit renewal line (`shopPermitLine`, THE ONE BUILD) — where Today's "permit renews" row lands. */
    permit?: { line: string; badge: { tone: 'ok' | 'wait' | 'quiet'; word: string } | null };
  };
}) {
  const docsChecking = docs.row.state === 'checking';
  return (
    <div className="px-4" data-shop-settings-body="">
      <SettingsSection title="Your page" data="shop-your-page">
      <div data-shop-gear-page="">
        <DatesRow
          data="shop-gear-page"
          tour="shop-your-page"
          title="Your page"
          line={pageLive ? 'What couples see, part by part · all your reviews inside' : 'What couples will see · not shown yet · all your reviews inside'}
          href={YOUR_PAGE_HREF}
        />
      </div>
      </SettingsSection>
      <SettingsSection title="Plan and team" data="shop-plan-team">
      <Fold anchor="plan" data="shop-gear-plan" title={SHOP_GEAR_TITLE.plan} line={planLine}>
        <div className="space-y-3 pb-4" data-shop-gear="plan">
          <DatesRow data="shop-gear-wallet" title={wallet.title} line={wallet.line} />
          {plan}
        </div>
      </Fold>

      <Fold anchor="team" data="shop-gear-team" title={SHOP_GEAR_TITLE.team} line="Who else manages the shop, and what each can open">
        <div className="pb-4" data-shop-gear="team">
          {team}
        </div>
      </Fold>
      </SettingsSection>

      <SettingsSection title="Papers" data="shop-papers">
      <Fold
        anchor="docs"
        data="shop-gear-docs"
        title={SHOP_GEAR_TITLE.docs}
        line={
          docsChecking
            ? 'Setnayan is checking your documents'
            : docs.isVerified
              ? 'Verified · kept private'
              : `${formatCount(docs.docsIn)} of ${formatCount(docs.docsTotal)} required in · DTI or SEC · BIR 2303 · permit`
        }
        aside={
          docsChecking ? (
            <Badge tone={docs.row.badge.tone} data="shop-gear-docs">
              {docs.row.badge.word}
            </Badge>
          ) : undefined
        }
      >
        <div className="space-y-3 pb-4" data-shop-gear="docs">
          {!docs.measured ? (
            <p role="status" className="text-[13.5px] text-ink/70" data-shop-gear-docs-unread="">
              Your documents couldn&rsquo;t load just now — nothing was lost. Close and open this again.
            </p>
          ) : null}
          {docs.permit ? (
            <div id="permit" className="scroll-mt-24">
              <DatesRow data="shop-gear-permit" title="Business permit" line={docs.permit.line} badge={docs.permit.badge} />
            </div>
          ) : null}
          <p className="text-xs text-ink/55">Kept private — only Setnayan sees them.</p>
          {docs.section}
        </div>
      </Fold>
      </SettingsSection>

      <div id="notifications" className="scroll-mt-24">
        <SettingsSection title={SHOP_GEAR_TITLE.notifications} data="shop-notifications">
          <div data-shop-gear="notifications">
            <div className="py-2" data-shop-gear-push="">
              <PushToggle />
            </div>
            <DatesRow data="shop-gear-email" title="Email" line="Bookings · payments · messages after your yes" />
          </div>
        </SettingsSection>
      </div>
    </div>
  );
}
