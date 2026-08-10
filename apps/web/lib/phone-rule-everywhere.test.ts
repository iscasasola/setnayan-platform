import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * The number rule has to hold everywhere a vendor's number can be set, not only
 * where a shop is created.
 *
 * 🔑 VALIDATING ONLY AT SIGNUP WOULD HAVE BEEN THE WEAKER HALF OF THE RULE. A
 * vendor passes on day one and replaces the number with anything the next day —
 * on My Shop, which is where a number actually gets changed. This repo has
 * shipped that shape before: a rule enforced on the path somebody was thinking
 * about, and absent on the path people use.
 */
const WEB = process.cwd();
const read = (p: string) => readFileSync(join(WEB, p), 'utf8');

test('signup checks it — against the country the pin landed in', () => {
  // ⚠ This asserted `parsePhPhone(` directly. Signup now goes through
  // `parseVendorPhone`, which picks the rule from the shop's country — the seam
  // that makes a second country a new entry rather than a change at every call
  // site. Pinning the old name would have blocked exactly that.
  assert.match(read('app/open-shop/actions.ts'), /parseVendorPhone\(/);
});

test('My Shop checks it — the screen where a number actually changes', () => {
  const src = read('app/vendor-dashboard/actions.ts');
  const branch = src.slice(src.indexOf("case 'contact_phone'"));
  const body = branch.slice(0, branch.indexOf("case '", 10));
  assert.match(body, /parsePhPhone\(/, 'My Shop stores whatever is typed');
  assert.match(
    body,
    /contact_phone: parsed\.e164/,
    'My Shop stores the raw text, so the same number has two spellings depending on the screen',
  );
});

test('the admin seeder checks it — a bad number would arrive wearing our approval', () => {
  const src = read('app/admin/vendors/actions.ts');
  assert.match(src, /parsePhPhone\(/, 'an admin can plant a number the vendor would be refused for');
});

test("the couple's own vendor list is deliberately NOT checked", () => {
  // ⚠ A JUDGEMENT CALL, RECORDED SO IT IS NOT "FIXED" LATER. That list is a
  // couple's private record of a supplier THEY hired — who may genuinely be
  // foreign, or a relative abroad. Refusing a real number a couple is trying to
  // save would be the rule applied to the wrong person entirely: the Philippine
  // constraint is about SETNAYAN VENDORS, not about everyone a couple knows.
  const src = read('app/dashboard/[eventId]/wizard-actions.ts');
  assert.doesNotMatch(
    src,
    /parsePhPhone\(/,
    "the couple's own vendor list now refuses foreign numbers — that list is their " +
      'private record of someone they hired, not a Setnayan vendor account',
  );
});

test('all three writers refuse with wording that names the format', () => {
  // "Invalid" alone leaves someone retyping the same number wondering what is
  // wrong with it.
  const msg = read('lib/open-shop-validation.ts');
  assert.match(msg, /09XX XXX XXXX/);
  assert.match(read('app/admin/vendors/actions.ts'), /09XX XXX XXXX/);
});
