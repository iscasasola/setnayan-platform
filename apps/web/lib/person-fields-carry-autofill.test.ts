/**
 * person-fields-carry-autofill.test.ts — every field that asks for a PERSON's name, email, phone or address
 * tells the phone what it is.
 *
 * Owner, 2026-11-08, verbatim: *"for the forms … their name, their email, their address. Does our app …
 * already accept autofill functions? So, if they already have a specific address saved on their account, or a
 * specific name, or a specific number … we accept also?"* — corpus
 * `plans/autofill_and_self_prefill_2026-11-08/BUILD_BRIEF.md`, Part A.
 *
 * Safari and Chrome only offer a saved name / email / number / address when the field says which one it is
 * (`autoComplete="email"`, `"tel"`, `"given-name"`, `"street-address"` …) and the keyboard matches (`type` /
 * `inputMode`). A field that says nothing gets a guess — and on a form about SOMEONE ELSE (a guest row, a
 * sponsor, a co-host invite, an admin lookup) the guess is the account holder's own details, which is wrong.
 * So every person-data field must carry a decision: the right token, or `off` where the details are not the
 * typist's own.
 *
 * WHAT COUNTS AS A PERSON-DATA FIELD is read from what the field declares about itself — a literal `type`,
 * `name` or `id` — never from a variable name, so the scan is exact and cannot drift with a refactor's
 * wording. A field named plainly `name` counts too: Chrome fills a `name="name"` box with the person's name
 * whether it is a package name or not, so it must say `off` when it is not a person.
 *
 * SABOTAGE (2026-11-08): deleting `autoComplete="email"` from the Help page's "Your email" field turned
 * the first test RED naming `app/(shell)/help/page.tsx`, and the second RED on the pinned own-data list;
 * restored → GREEN.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const web = process.cwd();

type Kind = 'email' | 'phone' | 'address' | 'name';

/** The tokens each kind may carry (WHATWG autofill field names), `off` aside. */
const TOKENS: Record<Kind, RegExp> = {
  email: /^(?:section-\S+ )?(?:(?:home|work|shipping|billing) )?(?:email|username)$/,
  phone: /^(?:section-\S+ )?(?:(?:home|work|mobile|shipping|billing) )?(?:tel|tel-national|tel-local)$/,
  address:
    /^(?:section-\S+ )?(?:(?:shipping|billing) )?(?:street-address|address-line[123]|address-level[1-4]|postal-code|country|country-name)$/,
  name: /^(?:section-\S+ )?(?:(?:shipping|billing) )?(?:name|given-name|additional-name|family-name|nickname|honorific-prefix|honorific-suffix|organization|cc-name|username)$/,
};

const SKIP_DIRS = new Set(['node_modules', '.next', 'dev']);

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    if (e.name.startsWith('.') || SKIP_DIRS.has(e.name)) continue;
    const p = join(dir, e.name);
    if (e.isDirectory()) tsxFiles(p, out);
    else if (e.name.endsWith('.tsx') && !e.name.includes('.test.')) out.push(p);
  }
  return out;
}

/** Each `<input …>` / `<textarea …>` opening tag, brace- and quote-aware. */
function elements(src: string): { attrs: string; line: number }[] {
  const out: { attrs: string; line: number }[] = [];
  const re = /<(input|textarea|StepInput)\b/g; // StepInput = the onboarding shared input (Lane P)
  let m: RegExpExecArray | null;
  while ((m = re.exec(src))) {
    let i = m.index + m[0].length;
    let depth = 0;
    let q: string | null = null;
    for (; i < src.length; i++) {
      const c = src[i]!;
      if (q) {
        if (c === q && src[i - 1] !== '\\') q = null;
        continue;
      }
      if ((c === '"' || c === "'" || c === '`') && (depth > 0 || src[i - 1] === '=')) q = c;
      else if (c === '{') depth++;
      else if (c === '}') depth--;
      else if (c === '>' && depth === 0) break;
    }
    out.push({ attrs: src.slice(m.index, i + 1), line: src.slice(0, m.index).split('\n').length });
  }
  return out;
}

/** A literal attribute value (`x="…"` or `x={'…'}`), else null. */
function literal(attrs: string, name: string): string | null {
  const m = new RegExp(`\\s${name}=(?:"([^"]*)"|\\{\\s*'([^']*)'\\s*\\}|\\{\\s*"([^"]*)"\\s*\\})`).exec(attrs);
  return m ? (m[1] ?? m[2] ?? m[3] ?? null) : null;
}

export function kindOf(attrs: string): Kind | null {
  const type = literal(attrs, 'type') ?? '';
  if (/^(hidden|checkbox|radio|file|date|datetime-local|time|number|range|color|search|url|password|submit|button)$/.test(type)) {
    return null;
  }
  const key = [literal(attrs, 'name'), literal(attrs, 'id')].filter(Boolean).join(' ');
  if (type === 'email' || /e-?mail/i.test(key)) return 'email';
  if (type === 'tel' || /phone|mobile|contact_number|gcash_number/i.test(key)) return 'phone';
  if (/address|street|barangay|(?:^|[_-])city(?:$|[_-])|province|postal|zip_?code/i.test(key)) return 'address';
  if (/(?:^|[_-])(?:first|last|middle|full|given|family|legal|contact|sender|payer|account|owner|your|guest)_?name(?:$|[_-])|(?:^| )name(?:$| )/i.test(key)) {
    return 'name';
  }
  return null;
}

export type Finding = { file: string; line: number; kind: Kind; token: string | null; problem: string | null };

export function scan(root: string): Finding[] {
  const found: Finding[] = [];
  for (const f of [...tsxFiles(join(root, 'app')), ...tsxFiles(join(root, 'components'))]) {
    const src = readFileSync(f, 'utf8');
    for (const el of elements(src)) {
      const kind = kindOf(el.attrs);
      if (!kind) continue;
      const hasAc = /\sautoComplete=/.test(el.attrs);
      const token = literal(el.attrs, 'autoComplete');
      let problem: string | null = null;
      if (!hasAc) problem = 'no autoComplete — say the token, or "off" when it is not the typist’s own details';
      else if (token !== null && token !== 'off' && !TOKENS[kind].test(token)) {
        problem = `autoComplete="${token}" is not a ${kind} token`;
      } else if (token !== null && kind === 'email' && token !== 'off' && literal(el.attrs, 'type') !== 'email') {
        problem = 'an email token needs type="email" (the @ keyboard)';
      } else if (
        token !== null &&
        kind === 'phone' &&
        token !== 'off' &&
        literal(el.attrs, 'type') !== 'tel' &&
        literal(el.attrs, 'inputMode') !== 'tel'
      ) {
        problem = 'a tel token needs type="tel" or inputMode="tel" (the number pad)';
      }
      found.push({ file: relative(root, f), line: el.line, kind, token: hasAc ? (token ?? '{expr}') : null, problem });
    }
  }
  return found;
}

test('every person-data field carries an autofill decision that fits it', () => {
  const findings = scan(web);
  assert.ok(findings.length > 40, `the scan found only ${findings.length} person-data fields — it went blind`);
  const bad = findings.filter((f) => f.problem);
  assert.deepEqual(
    bad.map((f) => `${f.file}:${f.line} [${f.kind}] ${f.problem}`),
    [],
    'a person-data field is missing its autofill token',
  );
});

/**
 * The typist's OWN details — these must OFFER autofill, never fall back to `off`. Anchored by the field's
 * literal name/id (a string, not a line number — rule 7). Sign-up, sign-in, the supplier sign-up, Your
 * details, the help desk, payment details and the guest's own name on a song request / gift.
 */
const OWN: [file: string, field: string, token: string][] = [
  ['app/signup/page.tsx', 'email', 'email'],
  ['app/login/_components/sign-in-card.tsx', 'email', 'email'],
  ['app/forgot-password/page.tsx', 'email', 'email'],
  ['app/signup/you/_components/you-card.tsx', 'phone', 'tel'],
  ['app/open-shop/_components/open-shop-wizard.tsx', 'contact_name', 'name'],
  ['app/open-shop/_components/open-shop-wizard.tsx', 'contact_email', 'email'],
  ['app/open-shop/_components/city-pin.tsx', 'hq_address', 'street-address'],
  ['app/open-shop/_components/city-pin.tsx', 'location_city', 'address-level2'],
  ['app/dashboard/(account)/profile/page.tsx', 'display_name', 'name'],
  ['app/dashboard/(account)/profile/page.tsx', 'phone', 'tel'],
  ['app/(shell)/help/page.tsx', 'sender_email', 'email'],
  ['app/(shell)/help/page.tsx', 'sender_name', 'name'],
  ['app/vendor-dashboard/shop/_components/editable-row.tsx', 'business_owner_name', 'name'],
  ['app/vendor-dashboard/shop/_components/editable-row.tsx', 'contact_email', 'email'],
  ['app/vendor-dashboard/shop/_components/editable-row.tsx', 'contact_phone', 'tel'],
  ['app/vendor-dashboard/shop/_components/editable-row.tsx', 'hq_address', 'street-address'],
  ['app/vendor-dashboard/payment-options/_components/add-payment-method.tsx', 'account_name', 'name'],
  ['app/papic/order/[token]/page.tsx', 'payer_name', 'name'],
  ['app/join/[eventId]/_components/request-form.tsx', 'contact_mobile', 'tel'],
  ['app/[slug]/_components/song-request-card.tsx', 'songreq-name', 'name'],
];

/** ANOTHER person's details — never offered the account holder's own (brief: "never prefill another person's form"). */
const OTHERS: [file: string, field: string][] = [
  ['app/dashboard/[eventId]/guests/_components/guest-name-fields.tsx', 'first_name'],
  ['app/dashboard/[eventId]/guests/_components/guest-name-fields.tsx', 'last_name'],
  ['app/dashboard/[eventId]/sponsors/_components/add-sponsor-modal.tsx', 'full_name'],
  ['app/dashboard/[eventId]/sponsors/_components/add-sponsor-modal.tsx', 'email'],
  ['app/dashboard/[eventId]/sponsors/_components/add-sponsor-modal.tsx', 'phone'],
  ['app/dashboard/(account)/people/_components/add-alaga-fields.tsx', 'name'],
  ['app/dashboard/(account)/people/_components/dependents-section.tsx', 'godparent_email'],
];

function fieldTag(file: string, field: string): string {
  const src = readFileSync(join(web, file), 'utf8');
  const hit = elements(src).filter(
    (el) =>
      literal(el.attrs, 'type') !== 'hidden' && literal(el.attrs, 'name') === field || literal(el.attrs, 'id') === field || literal(el.attrs, 'id') === `open-shop-${field}`,
  );
  assert.ok(hit.length > 0, `${file}: no field named "${field}" — it moved; re-anchor this guard`);
  return hit[0]!.attrs;
}

test('the typist’s own details offer autofill', () => {
  const wrong: string[] = [];
  for (const [file, field, token] of OWN) {
    const got = literal(fieldTag(file, field), 'autoComplete');
    if (got !== token) wrong.push(`${file} "${field}": autoComplete=${got ?? '(none)'} — want "${token}"`);
  }
  assert.deepEqual(wrong, []);
});

test('another person’s details are never offered the account holder’s', () => {
  const wrong: string[] = [];
  for (const [file, field] of OTHERS) {
    const tag = fieldTag(file, field);
    if (literal(tag, 'autoComplete') !== 'off') wrong.push(`${file} "${field}" must say autoComplete="off"`);
  }
  assert.deepEqual(wrong, []);
});
