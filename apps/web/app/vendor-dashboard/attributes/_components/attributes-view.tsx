import { formatCount } from '@/lib/format-number';
import type { ResolvedSchema } from '@/lib/vendor-service-attributes';
import { InfoTip } from '@/app/_components/info-tip';
import { SupplierToast } from '../../_components/supplier-toast';
import { ToolEmpty, ToolFail, ToolPage, ToolPin, ToolSection } from '../../_components/tool-page';
import { AddService, type AddableService } from './add-service';
import { ServiceRows, type ServiceRow } from './service-rows';

/**
 * Attributes — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 01). Look
 * only: every field type, Required / Filter / "required if" mark, Save per service, "Add service + save", retired
 * options kept when answered, and the saved / missing / removed / unknown-service notices are the shipped page's.
 * Presentational — the page and `/dev/supplier-tools-lab` mount it.
 */
export type AttributesNotices = {
  error: string | null;
  /** The saved service's name, as couples read it — the toast's words. */
  savedService: string | null;
  /** …and its key — the row that opens itself. */
  savedKey: string | null;
  /** The visibility gate's missing fields, as LABELS — never keys (controller 21 Nov). */
  missing: readonly string[];
  removed: boolean;
  unknownAdd: string | null;
};

const INTRO =
  'Fill in the per-category fields couples will use to find suppliers like you. Each service you offer has its own set of attributes — silhouettes if you design gowns, cuisine specialties if you cater, edit aesthetics if you shoot. Completing more fields raises your marketplace ranking and unlocks listing visibility.';

export function AttributesView({
  rows,
  fresh,
  addable,
  notices,
}: {
  rows: readonly ServiceRow[];
  fresh: ResolvedSchema | null;
  addable: readonly AddableService[];
  notices: AttributesNotices;
}) {
  const { error, savedService, savedKey, missing, removed, unknownAdd } = notices;
  return (
    <ToolPage name="attributes">
      <ToolPin
        route="/vendor-dashboard/attributes"
        title="Attributes"
        right={`${formatCount(rows.length)} ${rows.length === 1 ? 'service' : 'services'}`}
        sub={
          <InfoTip label="Fields couples use to find suppliers like you." align="start">
            {INTRO}
          </InfoTip>
        }
      />

      {error ? <ToolFail data="attributes-save" title="Couldn’t save:" line={error} /> : null}
      {unknownAdd ? (
        <ToolFail data="attributes-unknown" title={`Unknown service: ${unknownAdd} isn’t in the catalog.`} line="Pick a different one from ＋." />
      ) : null}
      {/* Saved and removed are toasts now (the drawing); a save that left the gate unmet is said inside its own row. */}
      {savedService && missing.length === 0 ? <SupplierToast tone="ok" text={`Saved attributes for ${savedService}.`} line={false} /> : null}
      {removed ? <SupplierToast tone="ok" text="Removed that service’s attribute payload." line={false} /> : null}

      <ToolSection label="Your services" count={rows.length > 0 ? rows.length : undefined} right={rows.length > 0 ? 'Swipe left to remove' : undefined} data="attributes">
        {rows.length === 0 && !fresh ? (
          <ToolEmpty data="attributes">No services yet. Tap ＋ to add your first one — it shows in the marketplace under its category once saved.</ToolEmpty>
        ) : (
          <ServiceRows rows={rows} fresh={fresh} justSaved={savedKey} missing={missing} />
        )}
      </ToolSection>

      <AddService addable={addable} />
    </ToolPage>
  );
}

/** The loader failed — said, with its own Try again (the shipped behaviour, the drawing's look). */
export function AttributesUnread() {
  return (
    <ToolPage name="attributes">
      <ToolPin route="/vendor-dashboard/attributes" title="Attributes" />
      <ToolSection label="Your services" data="attributes">
        <ToolFail
          data="attributes"
          title="We couldn’t load your services."
          line="Nothing is lost. The team has been told."
          retryHref="/vendor-dashboard/attributes"
        />
      </ToolSection>
    </ToolPage>
  );
}
