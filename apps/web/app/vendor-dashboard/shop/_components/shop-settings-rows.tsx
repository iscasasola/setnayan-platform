import type { ReactNode } from 'react';
import { BadgeCheck, Bell, Gem, Users, type LucideIcon } from 'lucide-react';
import { Badge } from '@/app/_components/badge';
import { Fold } from '@/app/_components/fold';
import { formatCount } from '@/lib/format-number';
import type { DetailsRow } from '@/lib/supplier-details';
import { DatesRow } from '../../customers/_components/dates-row';
import { PushToggle } from '../../notifications/push-toggle';
import { SHOP_GEAR_TITLE } from './shop-gear-sections';

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
 */
const ic = (Icon: LucideIcon) => <Icon aria-hidden className="h-[18px] w-[18px] flex-none text-ink/55" strokeWidth={1.75} />;
const lead = (Icon: LucideIcon) => <span className="mr-1 flex">{ic(Icon)}</span>;

export function ShopSettingsRows({
  planLine,
  wallet,
  plan,
  team,
  docs,
}: {
  planLine: string;
  /** The shop wallet's row, worded by `lib/shop-wallet.ts` (an unread balance says so, never 0). */
  wallet: { title: string; line: string };
  plan: ReactNode;
  team: ReactNode;
  docs: { isVerified: boolean; docsIn: number; docsTotal: number; measured: boolean; row: Pick<DetailsRow, 'state' | 'badge'>; section: ReactNode };
}) {
  const docsChecking = docs.row.state === 'checking';
  return (
    <div className="divide-y divide-ink/10" data-shop-settings-body="">
      <Fold anchor="plan" lead={lead(Gem)} data="shop-gear-plan" title={SHOP_GEAR_TITLE.plan} line={planLine}>
        <div className="space-y-3 pb-4" data-shop-gear="plan">
          <DatesRow data="shop-gear-wallet" title={wallet.title} line={wallet.line} />
          {plan}
        </div>
      </Fold>

      <Fold anchor="team" lead={lead(Users)} data="shop-gear-team" title={SHOP_GEAR_TITLE.team} line="Who else manages the shop, and what each can open">
        <div className="pb-4" data-shop-gear="team">
          {team}
        </div>
      </Fold>

      <Fold
        anchor="docs"
        lead={lead(BadgeCheck)}
        data="shop-gear-docs"
        title={SHOP_GEAR_TITLE.docs}
        line={
          docsChecking
            ? 'Setnayan is checking your documents'
            : docs.isVerified
              ? 'Verified · kept private'
              : `${formatCount(docs.docsIn)} of ${formatCount(docs.docsTotal)} required in · DTI or SEC · BIR 2303 · permit · a bank proof`
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
          <p className="text-xs text-ink/55">Kept private — only Setnayan sees them.</p>
          {docs.section}
        </div>
      </Fold>

      <Fold anchor="notifications" lead={lead(Bell)} data="shop-gear-notifications" title={SHOP_GEAR_TITLE.notifications} line="This phone · email">
        <div className="pb-3" data-shop-gear="notifications">
          <div className="py-2" data-shop-gear-push="">
            <PushToggle />
          </div>
          <DatesRow data="shop-gear-email" title="Email" line="Bookings · payments · messages after your yes" />
        </div>
      </Fold>
    </div>
  );
}
