/**
 * Vendor CARD-TEXT integrity gate — the server-side "no contact info" rule for
 * everything a vendor types onto a service card or a package, plus the
 * auto-naming that keeps a card from ever rendering a blank line.
 *
 * WHY THIS EXISTS (owner ruling 2026-07-27): "make sure no blanks. no placing
 * of contact information or anything to bypass our app." A card is a PUBLIC
 * surface — a phone number typed into an inclusion label ("Free album — text
 * 0917…") leaks the relationship off Setnayan exactly the way a chat message
 * would, and it does it in front of every couple who opens the card, not one.
 *
 * BLANKS ARE NAMED, NOT REFUSED (owner, same day: "saving builds blank will
 * make us autocreate a name for the build"). The outcome the owner wants is
 * "no blank lines on a card", and there are two ways to get there: bounce the
 * save, or fill the name in. A bounce punishes a vendor mid-build for a row
 * the editor itself seeded empty; naming it "Option 2" gets the same card and
 * loses nobody's work. So a blank field is SKIPPED here (never a violation) and
 * the save paths call `autoName()` before the write.
 *
 * REUSES THE SHIPPED DETECTOR — deliberately, through its `'card'` PROFILE.
 * `evaluateMessage()` from ./chat-contact-filter is the one place that knows
 * what a disguised phone number, an obfuscated email, a social link, a bare
 * @handle, and the blocklisted app-names / euphemisms / solicitations look
 * like. This module adds NO new detection rules: it is a field-aware wrapper
 * (which field, what does the vendor read) over that engine. Tune the rules —
 * and the card profile's four differences — there, never here.
 *
 * NEXT_PUBLIC_ so the server save gate and any client-side pre-save hint can
 * read ONE value. Only the exact truthy strings enable it — anything else
 * (including a missing var) is OFF, so the gate ships dark and the owner flips
 * it on. With the flag off, `findVendorTextViolation` returns null before it
 * looks at a single field, so the save path is byte-identical to before.
 * (`autoName` is NOT flag-gated — a blank name is a defect either way.)
 */
import { evaluateMessage } from './chat-contact-filter';

/** Feature flag. Ships dark; owner flips. */
export function serviceTextIntegrityEnabled(): boolean {
  const v = process.env.NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED;
  return v === 'true' || v === '1' || v === 'TRUE';
}

/** Vendor-facing copy when card text carries off-platform contact info. */
export const SERVICE_TEXT_BLOCK_MESSAGE =
  'Phone numbers, emails, links, and outside-app contacts are not allowed on ' +
  'service cards — couples book and chat with you here on Setnayan. Remove ' +
  'them and save again.';

export type VendorTextField = {
  /** Label the vendor sees in the error, e.g. `Inclusion 2`. */
  field: string;
  value: string | null | undefined;
};

/**
 * The first violation across `fields`, or null when the batch is clean.
 *
 * A BLANK IS NEVER A VIOLATION — it is skipped, and the caller names it with
 * `autoName()` before writing. See the module header for the owner ruling.
 *
 * FIRST VIOLATION WINS: the save paths bounce with a single `?error=` string,
 * so one clear sentence naming one field beats a concatenated list the vendor
 * has to parse. Order the `fields` array the way the form reads.
 *
 * Pure — no I/O, no throw. Safe on the server and the client.
 */
export function findVendorTextViolation(fields: VendorTextField[]): string | null {
  if (!serviceTextIntegrityEnabled()) return null;

  for (const { field, value } of fields) {
    const text = typeof value === 'string' ? value.trim() : '';
    if (text.length === 0) continue; // blank → the caller auto-names it
    // 'card' profile: card text is not chat text. Four measured differences,
    // documented in chat-contact-filter.ts.
    if (evaluateMessage(text, 'card').blocked) {
      return `${field}: ${SERVICE_TEXT_BLOCK_MESSAGE}`;
    }
  }

  return null;
}

const AUTO_NAME_NOUN = {
  item: 'Item',
  option: 'Option',
  inclusion: 'Inclusion',
  package: 'Package',
} as const;

/**
 * The name a blank line is saved under. 1-BASED, because it is read by a human
 * on a public card: the second option is "Option 2", not "Option 1".
 *
 * Deliberately dumb and un-i18n'd — it is a placeholder the vendor is expected
 * to overwrite, and a placeholder that reads like a real name would be worse.
 */
export function autoName(
  kind: 'item' | 'option' | 'inclusion' | 'package',
  index: number,
): string {
  return `${AUTO_NAME_NOUN[kind]} ${index + 1}`;
}
