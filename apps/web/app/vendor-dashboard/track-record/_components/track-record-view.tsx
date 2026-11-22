import { ToolEmpty, ToolFail, ToolPage, ToolPin, ToolSection } from '../../_components/tool-page';
import { VendorTrackRecordPanel, type VendorTrackRecordRow } from '../../_components/vendor-track-record-panel';

/**
 * Track record — the screen (owner-approved redraw v3, 21 Nov 2026 · `supplier_tools_redraw_v3_fable.html` § 07).
 * Presentational — the page and `/dev/supplier-tools-lab` mount it. `rows === null` is a refused read: said with its
 * own Try again, never as "No completed events yet" (controller 21 Nov).
 */
export function TrackRecordView({ rows }: { rows: VendorTrackRecordRow[] | null }) {
  return (
    <ToolPage name="track-record">
      <ToolPin route="/vendor-dashboard/track-record" title="Track record" />

      {rows === null ? (
        <ToolSection label="Across life events" data="track-record">
          <ToolFail
            data="track-record"
            title="We couldn’t read your track record."
            line="Your events are safe."
            retryHref="/vendor-dashboard/track-record"
          />
        </ToolSection>
      ) : rows.length > 0 ? (
        <VendorTrackRecordPanel rows={rows} />
      ) : (
        <ToolSection label="Across life events" data="track-record">
          <ToolEmpty data="track-record">
            No completed events yet. Once a couple marks a booking delivered, it lands here.
          </ToolEmpty>
        </ToolSection>
      )}
    </ToolPage>
  );
}
