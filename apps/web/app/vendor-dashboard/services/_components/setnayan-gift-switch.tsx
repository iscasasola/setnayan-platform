'use client';

import { Gift, Lock } from 'lucide-react';

/**
 * setnayan-gift-switch.tsx — the WHOLE of a supplier's control over the
 * Setnayan Exclusive: one yes/no.
 *
 * ── WHY IT IS A SWITCH AND NOT A SENTENCE (owner, 2026-09-09) ──────────────
 * The Exclusive used to be `vendor_services.exclusive_perk_text`, a free-text
 * box a shop could type anything into — and typing something was a HARD
 * CONDITION OF PUBLISHING AT ALL. Four rulings in one sitting replaced it:
 *
 *   • *"ok then only offer papic credits. so it is simple and useful"* — the
 *     Exclusive is ONE thing, Papic credits. Not a free-text promise, not the
 *     five-product shelf, not the two-product one it was narrowed to first.
 *   • *"papic credits will be auto computed based on what they pay. it will be
 *     proportionally computed to the value. (so it is either a yes or a no)."*
 *   • *"no. just max to 40%. nothing more."* — 40% of the booking fee is a
 *     CEILING with no top-up.
 *   • *"exclusive setnayan gift then should be optional."*
 *
 * ⛔ SO THERE IS NOTHING TO BUILD HERE BUT A CHECKBOX. No amount, no slider, no
 * picker, no "give a bit more". Each of those was ruled out by name, and each
 * would also break something: an amount re-opens the collision the yes/no
 * dissolved (a card advertises before a price exists, so any figure it names
 * can be broken by a lower quote, and honouring it would breach the ceiling).
 *
 * 🔑 AND IT PROMISES NO NUMBER, ON PURPOSE. The photo count is derived from
 * what the supplier actually pays, which is not known until a price is agreed,
 * so it belongs on the QUOTE. A gift named at the moment of decision closes; a
 * gift revealed after booking is only a thank-you — which is why the card says
 * the true thing at every price instead of a figure it might not keep.
 *
 * ── THE OLD FREE TEXT IS RETIRED AS A CONTROL, NOT AS DATA ─────────────────
 * A card that already promises something keeps promising it. Where a stored
 * `exclusive_perk_text` exists this shows it, read-only, so its owner can see
 * what their card still says — and the SERVER preserves it by leaving the
 * column alone whenever a save does not name the field (`namesExclusivePerk`
 * in the services actions; `p_fields ? 'exclusive_perk_text'` in
 * `save_vendor_service`). `carryLegacyPerk` is the ONE exception: the maker's
 * "start from this card" copy is an INSERT with nothing behind it to preserve,
 * so a copy has to carry the promise forward explicitly or lose it.
 *
 * Controlled on purpose. Every screen that mounts it already draws the card
 * beside it, and a card that does not repaint the instant the switch flips is
 * a preview that lies about what is being saved.
 */
export function SetnayanGiftSwitch({
  id,
  checked,
  onChange,
  legacyPerk,
  carryLegacyPerk = false,
}: {
  /** Unique per mount — this list renders one switch PER CARD. */
  id: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  /** The retired free-text promise this card still carries, if any. */
  legacyPerk?: string | null;
  /** Post the legacy text back. Only the COPY path needs this — see above. */
  carryLegacyPerk?: boolean;
}) {
  const perk = (legacyPerk ?? '').trim();
  return (
    <div
      className="space-y-3 rounded-xl border p-3"
      style={{ borderColor: 'var(--m-orange-3)', background: 'var(--m-orange-4)' }}
    >
      <div className="flex items-center gap-2">
        <Gift
          aria-hidden
          className="h-4 w-4"
          strokeWidth={1.75}
          style={{ color: 'var(--m-orange-2)' }}
        />
        <p className="text-sm font-semibold" style={{ color: 'var(--m-ink)' }}>
          Setnayan gift
        </p>
        <span
          className="inline-flex items-center rounded-full px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.1em]"
          style={{ background: 'var(--m-paper)', color: 'var(--m-orange-2)' }}
        >
          Optional
        </span>
      </div>

      {/* 44px minimum target, this repo's floor — and the whole row is the
          label, so the text is part of the control rather than beside it. */}
      <label
        htmlFor={id}
        className="flex min-h-[44px] cursor-pointer items-start gap-2.5 rounded-lg px-1 py-1"
      >
        <input
          id={id}
          name="setnayan_gift_enabled"
          type="checkbox"
          value="on"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 shrink-0"
        />
        <span className="text-sm" style={{ color: 'var(--m-ink)' }}>
          <span className="font-medium">
            Give couples free Papic photos when they book you here.
          </span>{' '}
          <span style={{ color: 'var(--m-slate)' }}>
            We fund it out of your booking fee — 40% of it, added to that fee, and
            only ever on a booking you actually win. The number of photos is worked
            out from the price you agree and appears on your quote, so your card
            never promises a figure you have not set.
          </span>
        </span>
      </label>

      {perk ? (
        <div
          className="space-y-1 rounded-lg border px-3 py-2"
          style={{ borderColor: 'var(--m-line)', background: 'var(--m-paper)' }}
        >
          <p
            className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.1em]"
            style={{ color: 'var(--m-slate)' }}
          >
            <Lock aria-hidden className="h-3 w-3" strokeWidth={1.75} />
            Your card also still promises
          </p>
          <p className="text-sm" style={{ color: 'var(--m-ink)' }}>
            {perk}
          </p>
          <p className="text-xs" style={{ color: 'var(--m-slate)' }}>
            Written before the gift became a switch. It stays on your card and is
            still revealed in chat; it can no longer be edited here.
          </p>
          {carryLegacyPerk ? (
            <input type="hidden" name="exclusive_perk_text" value={perk} />
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
