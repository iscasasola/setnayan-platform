'use client';

/**
 * Shared ceremony-type radio group.
 *
 * Used by:
 *   - create-event form (Task #44, 2026-05-22) — REQUIRED field; new
 *     events must land with ceremony_type SET, not silent-default to
 *     'catholic'.
 *   - dashboard CeremonyTypeModal (Task #37) — chip-driven setter on
 *     existing events whose ceremony_type was left NULL by older flows.
 *
 * Surfaces share the same 8 options, the same one-line descriptions, and
 * the same brand-voice. Extracting here keeps both copies aligned: any
 * future option-list change lands once.
 *
 * Brand-voice per [[feedback_setnayan_no_dev_text_post_launch]]: editorial,
 * no exclamation marks, no marketing jargon. Mobile responsive — each
 * label gets a ≥44px tap target per WCAG 2.2 SC 2.5.8.
 */

export type CeremonyTypeKey =
  | 'catholic'
  | 'civil'
  | 'inc'
  | 'christian'
  | 'muslim'
  | 'cultural'
  | 'chinese'
  | 'mixed';

type CeremonyOption = {
  key: CeremonyTypeKey;
  label: string;
  description: string;
};

export const CEREMONY_TYPE_OPTIONS: CeremonyOption[] = [
  {
    key: 'catholic',
    label: 'Catholic',
    description: 'Mass at a Catholic church with priest, ninong/ninang, cord & veil',
  },
  {
    key: 'civil',
    label: 'Civil',
    description: 'City hall ceremony with witnesses',
  },
  {
    key: 'inc',
    label: 'INC',
    description: 'Iglesia ni Cristo ceremony with minister',
  },
  {
    key: 'christian',
    label: 'Christian',
    description: 'Born Again, Evangelical, or other Christian ceremony',
  },
  {
    key: 'muslim',
    label: 'Muslim',
    description: 'Nikah ceremony with imam',
  },
  {
    key: 'cultural',
    label: 'Cultural',
    description: 'Indigenous Filipino tradition (Maranao, Tausug, Maguindanao, Sama, Yakan, other)',
  },
  {
    key: 'chinese',
    label: 'Chinese',
    description: 'Tea ceremony and Chinese customs, often with a church or civil rite',
  },
  {
    key: 'mixed',
    label: 'Mixed',
    description: 'Two ceremonies on the same day (e.g. Catholic morning + civil afternoon)',
  },
];

type Props = {
  /** Currently selected key. `null` renders the group with no value selected. */
  value: CeremonyTypeKey | null;
  /** Called with the new key when the host picks an option. */
  onChange: (key: CeremonyTypeKey) => void;
  /**
   * Per-row disable predicate. Used by the create-event picker to grey-out
   * "Coming soon" faiths whose launch_status row isn't yet 'active'. The
   * disabled label keeps its description visible but the radio input is
   * non-clickable and the label is dimmed.
   */
  isOptionDisabled?: (key: CeremonyTypeKey) => boolean;
  /**
   * Optional badge renderer per row. Returned ReactNode lands at the
   * right edge of the label (used for "Coming soon" pills). Returning
   * `null` renders no badge.
   */
  renderOptionBadge?: (key: CeremonyTypeKey) => React.ReactNode;
  /** Name attribute on the inner `<input type="radio">` elements. Defaults to `ceremony_type`. */
  name?: string;
  /** Accessibility — fieldset legend text. Hidden visually; surfaces for screen readers. */
  legend?: string;
};

export function CeremonyTypeRadioGroup({
  value,
  onChange,
  isOptionDisabled,
  renderOptionBadge,
  name = 'ceremony_type',
  legend = 'Wedding type',
}: Props) {
  return (
    <fieldset className="space-y-2">
      <legend className="sr-only">{legend}</legend>
      {CEREMONY_TYPE_OPTIONS.map((opt) => {
        const checked = value === opt.key;
        const disabled = isOptionDisabled?.(opt.key) ?? false;
        const badge = renderOptionBadge?.(opt.key) ?? null;

        return (
          <label
            key={opt.key}
            className={
              'flex min-h-[3rem] cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 text-left transition ' +
              (disabled
                ? 'cursor-not-allowed border-ink/10 bg-ink/[0.02] opacity-60'
                : checked
                  ? 'border-terracotta bg-terracotta/[0.06]'
                  : 'border-ink/10 hover:border-ink/25 hover:bg-ink/[0.02]')
            }
          >
            <input
              type="radio"
              name={name}
              value={opt.key}
              checked={checked}
              disabled={disabled}
              onChange={() => !disabled && onChange(opt.key)}
              className="mt-1 h-4 w-4 accent-terracotta"
            />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-ink">{opt.label}</span>
                {badge}
              </div>
              <p className="text-xs text-ink/65">{opt.description}</p>
            </div>
          </label>
        );
      })}
    </fieldset>
  );
}
