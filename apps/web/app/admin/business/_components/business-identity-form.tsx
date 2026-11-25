'use client';

/**
 * BUSINESS IDENTITY — the house form rows (`FormRows` + `TypedRow`, T22: a field edits in place, its name on the left,
 * its answer in the pill) over the SAME one save the Settings tab had (`saveBusinessIdentity`). Every field the old
 * form posted is posted here under the same name, so nothing the action reads went missing:
 *   business_name · business_tin · business_address · business_email · default_vat_rate_pct ·
 *   repost_watch_hamming_threshold · drive_speed_kmh
 * (The two VALIDATE contact fields went with the VALIDATE step itself — PR #7793; nothing reads them.)
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
  /** `null` = the speed could not be read; its row is locked and not posted. */
  drive_speed_kmh: string | null;
  /**
   * A8·I-6: the owner's numbers (`saveBusinessIdentity` writes each one it is posted). `null` = they could not be
   * read; their rows are locked and not posted, so a save cannot clear them. Blank = not set.
   */
  owner_numbers: Record<OwnerNumberKey, string> | null;
};

/**
 * A8·I-6: the owner's numbers lost their only editor when Settings moved to Business (only the test-only
 * `SettingsSurface` drew them). Same names, words and ranges as there and as `saveBusinessIdentity` checks.
 */
export const OWNER_NUMBERS = [
  { key: 'grow_few_inquiries_28d', name: 'Few inquiries — in 28 days', min: 1, max: 10000 },
  { key: 'grow_few_bookings_month', name: 'Few bookings — this month', min: 1, max: 10000 },
  { key: 'story_photo_silence_days', name: 'Shared photos — days of silence', min: 1, max: 90 },
  { key: 'today_soon_ask_hours', name: '“Soon” — inquiry or booking ask, in hours', min: 1, max: 720 },
  { key: 'today_soon_event_days', name: '“Soon” — an event beyond tomorrow, in days', min: 1, max: 60 },
  { key: 'inquiry_split_own_enough', name: 'Who gets new inquiries — own clients before a shop’s own split', min: 1, max: 100000 },
  { key: 'proof_real_guests_min', name: 'Reviews that count — real guests at an event the couple did not find here', min: 1, max: 100000 },
  { key: 'trust_search_step', name: 'Trust in search — how much more trust each step needs', min: 2, max: 10 },
  { key: 'deep_search_runs_per_month', name: 'Deep Search — searches each paid month on Plus, Pro and Ultra', min: 1, max: 31 },
] as const;
export type OwnerNumberKey = (typeof OWNER_NUMBERS)[number]['key'];

const keep = () => undefined;

const range = (lo: number, hi: number, what: string) => (t: string) => {
  if (t.trim() === '') return null;
  const n = Number(t);
  return Number.isFinite(n) && n >= lo && n <= hi ? null : `${what} must be ${lo}–${hi}`;
};

export function BusinessIdentityForm({ values, readFailed }: { values: BusinessIdentityValues; readFailed: boolean }) {
  // A8·I-3: a failed settings read shows every field as "Couldn't read" — never the fallback VAT of 0 or blanks
  // drawn as facts — and posts nothing (Save is off, as the banner says).
  if (readFailed) {
    return (
      <div data-business-identity="" data-business-unread="">
        <FormRows width="wide" data="business-identity">
          {[
            'Business name',
            'TIN',
            'Business address',
            'Business email',
            'Default VAT rate (%)',
            'Repost-watch match sensitivity',
            'Average driving speed (km/h)',
            ...OWNER_NUMBERS.map((n) => n.name),
          ].map((name) => (
            <FactRow key={name} name={name} value="Couldn’t read" />
          ))}
        </FormRows>
        <div className="mt-3 flex justify-end">
          <ActionButton type="button" tone="ok" icon={Check} label="Save business identity" main disabled />
        </div>
      </div>
    );
  }
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
        {values.owner_numbers === null
          ? OWNER_NUMBERS.map((n) => (
              <FactRow
                key={n.key}
                name={n.name}
                value="—"
                where="Couldn’t read the current number, so this row is locked to keep a save from clearing it. Reload to try again."
                attrs={{ 'data-owner-number-locked': '' }}
              />
            ))
          : OWNER_NUMBERS.map((n) => (
              <TypedRow
                key={n.key}
                name={n.name}
                about={{ words: `A whole number ${n.min}–${n.max.toLocaleString('en-US')}. Blank = not set.` }}
                value={values.owner_numbers?.[n.key] ?? ''}
                empty="Not set"
                fieldName={n.key}
                inputMode="numeric"
                check={range(n.min, n.max, 'This number')}
                onKeep={keep}
              />
            ))}
      </FormRows>
      <div className="mt-3 flex justify-end">
        <ActionButton type="submit" tone="ok" icon={Check} label="Save business identity" main disabled={readFailed} />
      </div>
    </form>
  );
}
