import { CanvasMaker } from '../../_components/canvas-maker';
import { RefinementsEditor } from '../../_components/refinements-editor';
import type { MakerContext, loadKindDetails } from '@/lib/service-card-maker.server';
import type { PickerParentView } from '@/app/_components/service-picker';
import { AddServicePicker } from './add-service-picker';

/**
 * THE NEW-SERVICE MAKER, as one element — drawn by `/vendor-dashboard/services/new` and, as a SHEET over Today, by a
 * new shop's "What you offer" step (owner 2026-10-28: "big tools such as the service maker open as a SHEET over
 * Today"). ONE drawing of the maker's props, so the page and the sheet can never offer two different makers. The
 * caller reads `loadMakerContext` + `loadKindDetails`; this only draws.
 */
export function NewServiceMaker({
  vendorProfileId,
  shopName,
  ctx,
  details,
  error,
  quoteReturn = null,
  picker = null,
}: {
  /**
   * ➕ THE ONE ADD-A-SERVICE PICKER (ruling 5820) — the tree `/open-shop` draws (`getServicePickerTree`). Given, the
   * page opens on the picker ("Make N cards"), the maker one press away; absent (Today's setup sheet), the maker as it was.
   */
  picker?: { tree: PickerParentView[] } | null;
  /** ＋ Opened from a quote: where it is (checked by the page, `quoteReturnPath`) — a new card goes back there. */
  quoteReturn?: string | null;
  vendorProfileId: string;
  shopName: string;
  ctx: MakerContext;
  details: Awaited<ReturnType<typeof loadKindDetails>>;
  error: string | null;
}) {
  const maker = (
      <CanvasMaker
        categoryValue=""
        categoryLabel=""
        categoryOptions={ctx.categoryOptions}
        tradeOptions={ctx.tradeOptions}
        firstCardEver={ctx.firstCardEver}
        coverageNames={ctx.coverageNames}
        shopName={shopName}
        otherCategories={ctx.otherCategories}
        coverages={ctx.coverages}
        vendorProfileId={vendorProfileId}
        claimToken={null}
        eventTypeOptions={ctx.eventTypeOptions}
        faithOptions={ctx.faithOptions}
        coverageAudience={ctx.coverageAudience}
        coverageAllowed={ctx.coverageAllowed}
        supplierType={ctx.supplierType}
        folderOfKind={ctx.folderOfKind}
        coverageAsk={ctx.coverageAsk}
        schedules={ctx.schedules}
        scheduleOfKind={ctx.scheduleOfKind}
        branches={ctx.branches}
        giftPacks={ctx.giftPacks}
        giftFree={ctx.giftFree}
        bookingsPerDate={ctx.bookingsPerDate}
        checkRules={ctx.checkRules}
        detailsKind={details ? ctx.onlyKind : null}
        detailsSlot={
          details && ctx.onlyKind ? (
            <RefinementsEditor
              canonicalService={ctx.onlyKind}
              refinements={details.refinements}
              initial={details.values}
              leafLabel={ctx.kindLabel(ctx.onlyKind)}
              bare
            />
          ) : null
        }
        errorLine={error}
        returnTo="/vendor-dashboard/services/new"
        quoteReturn={quoteReturn}
        initial={null}
      />
  );
  if (!picker) return maker;
  return <AddServicePicker tree={picker.tree} onShop={ctx.ownKinds} maker={maker} startOnMaker={quoteReturn !== null} />;
}
