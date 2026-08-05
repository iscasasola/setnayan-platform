import { Camera, EyeOff } from 'lucide-react';

import { SubmitButton } from '@/app/_components/submit-button';
import { createClient } from '@/lib/supabase/server';
import { setVendorCapturesHidden } from '../vendor-visibility-actions';

/**
 * "Suppliers' photos in your gallery" — one row per supplier who has actually
 * shot something, with a switch.
 *
 * ── ONLY SUPPLIERS WHO HAVE SHOT SOMETHING ──────────────────────────────────
 * Listing every booked vendor would put a photo control next to a couple's
 * florist who will never take a picture, and teach them the list is noise. The
 * row appears when there is something to hide.
 *
 * ── WHAT THE COPY HAS TO BE HONEST ABOUT ────────────────────────────────────
 * Hiding does NOT delete. The supplier keeps their own view of their own work —
 * they shot it for their records — and the files stay for the retention period.
 * A couple who reads "hide" as "destroy" would be misled at exactly the moment
 * they are trying to exercise control, so the line under the switch says it.
 */
export async function VendorMediaControls({ eventId }: { eventId: string }) {
  const supabase = await createClient();

  // Suppliers on this event, with their current setting.
  const { data: vendorRows, error } = await supabase
    .from('event_vendors')
    .select('vendor_id, vendor_name, linked_vendor_profile_id, papic_captures_hidden')
    .eq('event_id', eventId)
    .not('linked_vendor_profile_id', 'is', null);

  // A failed read renders NOTHING rather than an empty list — "no suppliers
  // have taken photos" is a claim, and a query that fell over has not earned it.
  if (error || !vendorRows || vendorRows.length === 0) return null;

  // Which of them actually have captures? One read, ids only.
  const { data: captureRows } = await supabase
    .from('vendor_papic_captures')
    .select('vendor_profile_id')
    .eq('event_id', eventId);

  const shooters = new Set(
    (captureRows ?? [])
      .map((r) => (r as { vendor_profile_id: string | null }).vendor_profile_id)
      .filter((v): v is string => typeof v === 'string'),
  );

  const rows = (
    vendorRows as {
      vendor_id: string;
      vendor_name: string | null;
      linked_vendor_profile_id: string | null;
      papic_captures_hidden: boolean | null;
    }[]
  ).filter((v) => v.linked_vendor_profile_id && shooters.has(v.linked_vendor_profile_id));

  if (rows.length === 0) return null;

  return (
    <section className="space-y-3 sn-tile p-5 sm:p-6">
      <div className="space-y-1">
        <h2 className="flex items-center gap-2 text-lg font-semibold tracking-tight">
          <Camera aria-hidden className="h-5 w-5 text-ink/55" strokeWidth={1.75} />
          Suppliers&rsquo; photos
        </h2>
        <p className="max-w-prose text-sm text-ink/60">
          Suppliers who shot at your event put their photos in your gallery. Turn one
          off and their photos leave your gallery — they keep their own copies, and
          nothing is deleted.
        </p>
      </div>

      <ul className="divide-y divide-ink/10">
        {rows.map((v) => {
          const hidden = v.papic_captures_hidden === true;
          return (
            <li key={v.vendor_id} className="flex items-center gap-3 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-ink">
                  {v.vendor_name?.trim() || 'Your supplier'}
                </p>
                <p className="text-xs text-ink/55">
                  {hidden ? 'Not in your gallery' : 'In your gallery'}
                </p>
              </div>
              <form action={setVendorCapturesHidden}>
                <input type="hidden" name="event_id" value={eventId} />
                <input type="hidden" name="vendor_id" value={v.vendor_id} />
                <input type="hidden" name="hidden" value={hidden ? '0' : '1'} />
                <SubmitButton
                  pendingLabel="Saving…"
                  className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium ${
                    hidden
                      ? 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                      : 'bg-ink/5 text-ink/70 hover:bg-ink/10'
                  }`}
                >
                  {hidden ? (
                    'Show again'
                  ) : (
                    <>
                      <EyeOff aria-hidden className="h-3.5 w-3.5" strokeWidth={2} />
                      Hide
                    </>
                  )}
                </SubmitButton>
              </form>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
