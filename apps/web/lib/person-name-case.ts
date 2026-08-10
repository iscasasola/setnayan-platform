/**
 * Capitalise a person's name for display and storage.
 *
 * Owner 2026-08-10: *"Your Name must always have the first letter in capital."*
 * Vendors type their own name in a hurry on a phone — "ana reyes" — and it then
 * appears on their public shop page and in messages to couples.
 *
 * ── WHAT IT DELIBERATELY DOES NOT DO ────────────────────────────────────────
 * It capitalises the first letter of each word and LEAVES THE REST ALONE. It
 * does not lowercase anything, because the shapes that would break are all real
 * Filipino names: **JR**, **III**, **MJ**, and above all **de la Cruz**,
 * **dela Peña**, **del Rosario** — where the particle is conventionally lower
 * case and "fixing" it to "De La Cruz" is getting someone's name wrong.
 *
 * So `titleCasePersonName('ana reyes')` → `'Ana Reyes'`, and
 * `titleCasePersonName('Juan de la Cruz III')` → unchanged. Only a word that
 * STARTS lower case and was not deliberately typed that way mid-name gets
 * touched — the first word always, later words only when the whole name was
 * typed lower case, which is the actual complaint.
 */

/** True when the name looks like it was typed without any capitals at all. */
function isAllLower(name: string): boolean {
  return name === name.toLowerCase();
}

function upperFirst(word: string): string {
  // Preserve leading punctuation — "(nickname)" and "'Nay" keep their opener.
  const i = word.search(/[a-zà-öø-ÿ]/i);
  if (i === -1) return word;
  return word.slice(0, i) + word[i]!.toUpperCase() + word.slice(i + 1);
}

export function titleCasePersonName(raw: string | null | undefined): string {
  const name = (raw ?? '').trim().replace(/\s+/g, ' ');
  if (!name) return '';

  // Typed entirely in lower case → capitalise every word. This is the case the
  // owner is complaining about, and the one where no intent can be destroyed:
  // nobody deliberately writes their whole name lower case in a business form.
  if (isAllLower(name)) {
    return name.split(' ').map(upperFirst).join(' ');
  }

  // Otherwise the vendor has capitalised SOMETHING, so their casing is
  // intentional — "Juan de la Cruz", "Ana MJ Reyes". Only guarantee the very
  // first letter, which is what was asked for, and touch nothing else.
  return upperFirst(name);
}
