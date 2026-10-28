import { CanvasMaker } from '../../_components/canvas-maker';
import { RefinementsEditor } from '../../_components/refinements-editor';
import type { MakerContext, loadKindDetails } from '@/lib/service-card-maker.server';

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
}: {
  vendorProfileId: string;
  shopName: string;
  ctx: MakerContext;
  details: Awaited<ReturnType<typeof loadKindDetails>>;
  error: string | null;
}) {
  return (
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
        initial={null}
      />
  );
}
