'use client';

/**
 * BUSINESS IDENTITY — the house form rows (`FormRows` + `TypedRow`, T22: a field edits in place, its name on the left,
 * its answer in the pill) over the SAME one save the Settings tab had (`saveBusinessIdentity`). Every field the old
 * form posted is posted here under the same name, so nothing the action reads went missing:
 *   business_name · business_tin · business_address · business_email · default_vat_rate_pct ·
 *   repost_watch_hamming_threshold · vendor_validate_email · vendor_validate_phone · drive_speed_kmh
 *
 * ⚖ MEASURED, NOT FALLBACK (2026-09-30): when the saved settings could not be read, Save is OFF — a save from fallback
 * blanks would write them over the real values printed on every receipt. The drive speed has its own read: unread, its
 * row is not posted at all, and the action leaves the stored speed alone (`formData.has('drive_speed_kmh')`).
 */
import { Check } from 'lucide-react';

import { ActionButton } from '@/components/action-button';
import { FactRow, FormRows, TypedRow } from '@/app/_components/form-row';
import { saveBusinessIdentity } from '@/app/admin/settings/actions';
import { formatTin } from '@/app/admin/settings/_components/tin-input';

export type BusinessIdentityValues = {
  business_name: string;
  business_tin: string;
  business_address: string;
  business_email: string;
  default_vat_rate_pct: string;
  repost_watch_hamming_threshold: string;
  vendor_validate_email: string;
  vendor_validate_phone: string;
  /** `null` = the speed could not be read; its row is locked and not posted. */
  drive_speed_kmh: string | null;
};

const keep = () => undefined;

const range = (lo: number, hi: number, what: string) => (t: string) => {
  if (t.trim() === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= lo && n <= hi ? null : `${what} must be ${lo}–${hi}`;
};

export function BusinessIdentityForm({ values, readFailed }: { values: BusinessIdentityValues; readFailed: boolean }) {
  return (
    <form action={saveBusinessIdentity} data-business-identity="">
      <FormRows width="wide" data="business-identity">
        <TypedRow name="Business name" value={values.business_name} fieldName="business_name" required onKeep={keep} maxLength={120} />
        <TypedRow
          name="TIN"
          about={{ words: 'Format 000-000-000-000. Shown on every transaction receipt. Dashes are inserted as you type.' }}
          value={formatTin(values.business_tin)}
          fieldName="business_tin"
          inputMode="numeric"
          maxLength={15}
          clean={formatTin}
          onKeep={keep}
        />
        <TypedRow name="Business address" value={values.business_address} fieldName="business_address" long onKeep={keep} maxLength={300} />
        <TypedRow name="Business email" value={values.business_email} fieldName="business_email" inputMode="email" onKeep={keep} />
        <TypedRow
          name="Default VAT rate (%)"
          about={{ words: 'Use the Philippine standard VAT rate. 0–100. Receipts already issued won’t be re-rated.' }}
          value={values.default_vat_rate_pct}
          fieldName="default_vat_rate_pct"
          inputMode="numeric"
          required
          check={range(0, 100, 'The VAT rate')}
          onKeep={keep}
        />
        <TypedRow
          name="Repost-watch match sensitivity"
          about={{
            words:
              'Reverse-image theft watch. Two supplier images flag as a repost when their perceptual hashes differ by ≤ this many bits (0–64). Lower = stricter. Detect-and-flag for Repost watch only — never auto-blocks.',
          }}
          value={values.repost_watch_hamming_threshold}
          fieldName="repost_watch_hamming_threshold"
          inputMode="numeric"
          required
          check={range(0, 64, 'The sensitivity')}
          onKeep={keep}
        />
        <TypedRow
          name="Supplier VALIDATE email"
          about={{ words: 'The Setnayan-owned inbox suppliers email “VALIDATE <shop name>” to during verification. Admins mark each received message on the verification queue.' }}
          value={values.vendor_validate_email}
          fieldName="vendor_validate_email"
          inputMode="email"
          required
          onKeep={keep}
        />
        <TypedRow
          name="Supplier VALIDATE mobile number"
          about={{ words: 'The Setnayan-owned number suppliers text “VALIDATE <shop name>” to. Leave blank to show “number coming soon” to suppliers until one exists.' }}
          value={values.vendor_validate_phone}
          empty="09XX XXX XXXX"
          fieldName="vendor_validate_phone"
          inputMode="tel"
          onKeep={keep}
        />
        {values.drive_speed_kmh === null ? (
          <FactRow
            name="Average driving speed (km/h)"
            value="—"
            where="Couldn’t read the current speed, so this field is locked to keep a save from clearing it. Reload to try again."
            attrs={{ 'data-drive-speed-locked': '' }}
          />
        ) : (
          <TypedRow
            name="Average driving speed (km/h)"
            about={{
              words:
                'Turns the straight-line distance between two same-day venues into a crew’s drive on the supplier schedule, so a crew booked too close together is flagged. 1–150 km/h. Blank flags only overlapping times.',
            }}
            value={values.drive_speed_kmh}
            empty="Not set"
            fieldName="drive_speed_kmh"
            inputMode="numeric"
            check={range(1, 150, 'The driving speed')}
            onKeep={keep}
          />
        )}
      </FormRows>
      <div className="mt-3 flex justify-end">
        <ActionButton type="submit" tone="ok" icon={Check} label="Save business identity" main disabled={readFailed} />
      </div>
    </form>
  );
}
