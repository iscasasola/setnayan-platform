/**
 * 🔤 THE COUPLE PICKS A NAME STYLE — and every FORMAL surface prints it.
 *
 * Owner, verbatim, 2026-09-30: *"when we have their full name, for example Mr.
 * Manuel Cortez Casasola. We can pick the name style as well. Mr. Casasola,
 * Manuel C. / Mr. Manuel C. Casasola / Mr. Manuel Cortez Casasola"*
 * (DECISION_LOG "THE COUPLE PICKS A NAME STYLE"; lib/name-style.ts).
 *
 * Held four ways:
 *   1. THE WORDS — each style prints the owner's own example; a suffix is kept;
 *      a missing part is skipped cleanly (never "Mr. , Manuel").
 *   2. THE PRINTED LISTS — the entourage and the name list are built in the
 *      style, and a Display name is printed as given in every style.
 *   3. THE SETTING SURVIVES EVERY OTHER SAVE — `print_details` is one jsonb
 *      with several writers; each must carry what it does not own.
 *   4. THE STYLE REACHES THE CALL — every formal surface's name call is handed
 *      a style. A surface that composes a name WITHOUT one prints Full forever,
 *      and nothing else would turn red.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import ts from 'typescript';
import { middleInitials, nameStyleOfPrintDetails, styledName, ticketName, type NameStyle } from '@/lib/name-style';
import { guestFullName } from '@/lib/guests';
import { buildEntourage, lineNames, plainGuestNames, type EntourageGuestRow } from '@/lib/entourage';
import { parsePrintDetails, serializePrintDetails } from '@/lib/print-pieces';

const MANUEL = {
  display_name: null,
  name_prefix: 'Mr.',
  first_name: 'Manuel',
  middle_name: 'Cortez',
  last_name: 'Casasola',
  name_suffix: null,
};

// ── 1 · THE WORDS ──────────────────────────────────────────────────────────

test("each style prints the owner's own example", () => {
  assert.equal(styledName(MANUEL, 'full'), 'Mr. Manuel Cortez Casasola');
  assert.equal(styledName(MANUEL, 'middle-initial'), 'Mr. Manuel C. Casasola');
  assert.equal(styledName(MANUEL, 'surname-first'), 'Mr. Casasola, Manuel C.');
  assert.equal(styledName(MANUEL), 'Mr. Manuel Cortez Casasola', 'no style is Full — today');
});

test('a suffix is kept in every style', () => {
  const ii = { ...MANUEL, name_suffix: 'II' };
  assert.equal(styledName(ii, 'full'), 'Mr. Manuel Cortez Casasola II');
  assert.equal(styledName(ii, 'middle-initial'), 'Mr. Manuel C. Casasola II');
  // Owner "ok" 2026-09-30: the suffix stays with the surname.
  assert.equal(styledName(ii, 'surname-first'), 'Mr. Casasola II, Manuel C.');
});

test('a missing part is skipped cleanly — never a dangling comma or a double space', () => {
  const styles: NameStyle[] = ['full', 'middle-initial', 'surname-first'];
  const shapes = [
    { ...MANUEL, middle_name: null },
    { ...MANUEL, first_name: null, middle_name: null },
    { ...MANUEL, last_name: null },
    { ...MANUEL, name_prefix: null },
    { name_prefix: 'Mr.' },
    { first_name: '  Manuel  ', last_name: ' ' },
  ];
  for (const style of styles) {
    for (const shape of shapes) {
      const line = styledName(shape, style) ?? '';
      assert.doesNotMatch(line, /,\s*$|^\s*,|\s,|,\s*,|\s{2}|^\s|\s$/, `${style} → "${line}"`);
    }
  }
  assert.equal(styledName({ ...MANUEL, middle_name: null }, 'middle-initial'), 'Mr. Manuel Casasola');
  assert.equal(styledName({ ...MANUEL, first_name: null, middle_name: null }, 'surname-first'), 'Mr. Casasola');
  assert.equal(styledName({ ...MANUEL, last_name: null }, 'surname-first'), 'Mr. Manuel C.');
  assert.equal(styledName({}, 'surname-first'), null, 'nothing left → null, so the caller drops the line');
  // Owner "ok" 2026-09-30: ONE letter, the first of the middle name, whatever its words.
  assert.equal(middleInitials('de la Cruz'), 'D.');
  assert.equal(styledName({ ...MANUEL, middle_name: 'de la Cruz' }, 'middle-initial'), 'Mr. Manuel D. Casasola');
  assert.equal(styledName({ ...MANUEL, middle_name: 'de la Cruz' }, 'surname-first'), 'Mr. Casasola, Manuel D.');
});

test('Full is byte-identical to the name every formal surface printed before the style', () => {
  // The composition `guestFullName` did before 2026-09-30, verbatim.
  const before = (g: Record<string, string | null | undefined>) =>
    [g.name_prefix, g.first_name, g.middle_name, g.last_name, g.name_suffix]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(' ') || null;
  for (const g of [MANUEL, { ...MANUEL, name_suffix: 'Jr.' }, { first_name: ' Ana ', last_name: 'Cruz' }, {}]) {
    assert.equal(guestFullName(g), before(g));
    assert.equal(guestFullName(g, 'full'), before(g));
  }
});

test('a ticket prints the style — Full means full, tickets included', () => {
  // Owner "ok" 2026-09-30: Full is the whole name on the Digital and Printed ticket too.
  assert.equal(ticketName(MANUEL), 'Mr. Manuel Cortez Casasola');
  assert.equal(ticketName(MANUEL, 'full'), 'Mr. Manuel Cortez Casasola');
  assert.equal(ticketName({ ...MANUEL, name_suffix: 'II' }, 'surname-first'), 'Mr. Casasola II, Manuel C.');
  assert.equal(ticketName(MANUEL, 'middle-initial'), 'Mr. Manuel C. Casasola');
  assert.equal(ticketName(MANUEL, 'surname-first'), 'Mr. Casasola, Manuel C.');
  assert.equal(ticketName({ display_name: 'Tita Baby' }, 'surname-first'), 'Tita Baby');
  assert.equal(ticketName({}, 'middle-initial'), 'Guest', 'never a blank card');
});

// ── 2 · THE PRINTED LISTS ──────────────────────────────────────────────────

const ROWS: EntourageGuestRow[] = [
  { guest_id: 'a', pair_with_guest_id: 'b', ...MANUEL, role: 'principal_sponsor_ninong' },
  { guest_id: 'b', pair_with_guest_id: 'a', name_prefix: 'Mrs.', first_name: 'Rosa', middle_name: 'Lim', last_name: 'Casasola', role: 'principal_sponsor_ninang' },
  { guest_id: 'c', display_name: 'Tito Boy', first_name: 'Jose', last_name: 'Reyes', role: 'guest' },
  { guest_id: 'd', name_prefix: 'Ms.', first_name: 'Ana', middle_name: 'Bautista', last_name: 'Cruz', role: 'guest' },
];

const namesIn = (style?: NameStyle) =>
  buildEntourage(ROWS, null, null, style).flatMap((g) => g.rows.flatMap((r) => r.filter(Boolean).map((p) => p!.name)));

test('the entourage is built in the style — sponsors included', () => {
  assert.ok(namesIn().includes('Mr. Manuel Cortez Casasola'));
  assert.ok(namesIn('middle-initial').includes('Mr. Manuel C. Casasola'));
  assert.ok(namesIn('surname-first').includes('Mr. Casasola, Manuel C.'));
  assert.ok(namesIn('surname-first').includes('Mrs. Casasola, Rosa L.'));
});

test('a shared-surname pair line follows the style, and Surname first never shares one', () => {
  const line = (style?: NameStyle) => {
    const g = buildEntourage(ROWS, null, null, style).find((x) => x.rows.some((r) => r[0] && r[1]))!;
    return lineNames(g.rows.find((r) => r[0] && r[1])!);
  };
  assert.match(line('middle-initial'), /^Mr\. Manuel C\. & Mrs\. Rosa L\. Casasola$|^Mrs\. Rosa L\. & Mr\. Manuel C\. Casasola$/);
  // Both names whole — a shared-surname half ("Mr. Manuel C. & Mrs. Casasola, Rosa L.") is nonsense here.
  assert.match(
    line('surname-first'),
    /^Mr\. Casasola, Manuel C\. & Mrs\. Casasola, Rosa L\.$|^Mrs\. Casasola, Rosa L\. & Mr\. Casasola, Manuel C\.$/,
  );
});

test('the name list is built in the style, and a Display name is printed as given', () => {
  assert.deepEqual(plainGuestNames(ROWS, 'surname-first').sort(), ['Ms. Cruz, Ana B.', 'Tito Boy']);
  for (const style of ['full', 'middle-initial', 'surname-first'] as const) {
    assert.equal(guestFullName({ ...MANUEL, display_name: 'Tito Manny' }, style), 'Tito Manny');
  }
});

// ── 3 · THE SETTING SURVIVES EVERY OTHER SAVE ──────────────────────────────

test('print_details carries name_style through a round trip; unknown is Full', () => {
  const stored = parsePrintDetails({ name_style: 'surname-first', poster_photo: { ref: 'x', w: 1, h: 2 } });
  assert.equal(stored.nameStyle, 'surname-first');
  const back = serializePrintDetails(stored);
  assert.equal(back.name_style, 'surname-first');
  assert.equal(nameStyleOfPrintDetails(back), 'surname-first');
  assert.equal(nameStyleOfPrintDetails({ name_style: 'shouty' }), 'full');
  assert.equal(nameStyleOfPrintDetails(null), 'full');
});

const APP = join(__dirname, '..');
function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name.startsWith('.')) continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}
const SOURCES = [...walk(join(APP, 'app')), ...walk(join(APP, 'lib'))];

type Call = { file: string; line: number; callee: string; args: readonly ts.Expression[]; sf: ts.SourceFile };
function callsOf(names: ReadonlySet<string>): Call[] {
  const out: Call[] = [];
  for (const file of SOURCES) {
    const src = readFileSync(file, 'utf8');
    if (![...names].some((n) => src.includes(n))) continue;
    const sf = ts.createSourceFile(file, src, ts.ScriptTarget.Latest, true, file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
    const visit = (n: ts.Node) => {
      if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && names.has(n.expression.text)) {
        out.push({ file: relative(APP, file), line: sf.getLineAndCharacterOfPosition(n.getStart()).line + 1, callee: n.expression.text, args: n.arguments, sf });
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return out;
}

test('every writer of print_details carries what it does not own — the Name style included', () => {
  /* 🔑 A PROPERTY, NOT A KEY LIST. The `words` save once named the keys it
     carried (menu, message, pass look) and so dropped the poster's photo; a
     key list would drop `name_style` the same way. Every write must start from
     the stored value: `{ ...stored, … }`, or a variable built that way. */
  const calls = callsOf(new Set(['serializePrintDetails']));
  const bad: string[] = [];
  for (const c of calls) {
    if (c.file === 'lib/print-pieces.ts') continue;
    const arg = c.args[0];
    let text = arg ? arg.getText(c.sf) : '';
    if (arg && ts.isIdentifier(arg)) {
      const decl = new RegExp(`const ${arg.text}\\s*=\\s*([^;]+);`).exec(c.sf.getFullText());
      text = decl?.[1] ?? '';
    }
    if (!/^\{\s*\.\.\.stored\b/.test(text.trim())) bad.push(`${c.file}:${c.line}  ${text.slice(0, 90)}`);
  }
  assert.ok(calls.length >= 5, `found only ${calls.length} writes — the scan is not looking`);
  assert.deepEqual(bad, [], 'a print_details write that does not start from what is stored erases the other writers’ keys');
});

// ── 4 · THE STYLE REACHES THE CALL ─────────────────────────────────────────

/**
 * Each formal name builder and the argument index its style sits at. A call
 * with fewer arguments prints Full no matter what the couple picked.
 */
const STYLE_AT: Record<string, number> = {
  printedCardName: 1,
  buildEntourage: 3,
  plainGuestNames: 1,
  passCardGuestName: 1,
  ticketName: 1,
  guestFullName: 1,
};

/**
 * Calls that are NOT a formal surface, each with its reason. Anything else
 * without a style is a formal surface printing Full forever.
 */
const NOT_FORMAL: ReadonlyArray<{ file: RegExp; callee: string; why: string }> = [
  { file: /guest-list-multiselect\.tsx$/, callee: 'guestFullName', why: 'the Guest list’s own working rows and aria-labels — the couple’s editing list, not a printed one (its invite {name} IS styled)' },
  { file: /editorial\/data\.ts$/, callee: 'guestFullName', why: 'a byline under a guest’s own words on the story page — not one of the owner’s formal surfaces' },
];

test('every formal surface hands its name builder the event’s Name style', () => {
  const calls = callsOf(new Set(Object.keys(STYLE_AT)));
  const missing: string[] = [];
  for (const c of calls) {
    if (NOT_FORMAL.some((x) => x.file.test(c.file) && (x.callee === '*' || x.callee === c.callee))) continue;
    if (c.args.length <= STYLE_AT[c.callee]!) missing.push(`${c.file}:${c.line}  ${c.callee}(…) has no style`);
  }
  // The surfaces the owner named must each be found — a scan that finds none proves nothing.
  const reached = new Set(calls.map((c) => `${c.callee}@${c.file}`));
  for (const must of [
    'buildEntourage@app/[slug]/_lib/loaders.ts',
    'buildEntourage@app/[slug]/everyone/page.tsx',
    'buildEntourage@lib/print-set.server.ts',
    'plainGuestNames@app/[slug]/everyone/page.tsx',
    'printedCardName@app/dashboard/[eventId]/invitation/print/page.tsx',
    'ticketName@lib/print-set.server.ts',
  ]) {
    assert.ok(reached.has(must), `${must} — a formal surface the scan no longer finds`);
  }
  assert.deepEqual(missing, [], 'a formal surface composes a name without the event’s Name style');
});

test('the Guest list and the profile type a Prefix in the guest side’s dropdown', () => {
  /* Owner 2026-09-30: "the same dropdown as the guest side" — `PrefixSelect`
     (app/_components/formal-name-inputs.tsx, `NAME_PREFIX_CHOICES`). No
     visible free-text box may post `name_prefix` from these screens. */
  const screens = [
    'app/dashboard/[eventId]/guests/_components/guest-card-body.tsx',
    'app/dashboard/[eventId]/guests/_components/guest-name-fields.tsx',
    'app/dashboard/(account)/profile/page.tsx',
    'app/signup/you/page.tsx',
  ];
  for (const rel of screens) {
    const src = readFileSync(join(APP, rel), 'utf8');
    const sf = ts.createSourceFile(rel, src, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
    let selects = 0;
    const typed: number[] = [];
    const visit = (n: ts.Node) => {
      if (ts.isJsxSelfClosingElement(n) || ts.isJsxOpeningElement(n)) {
        const tag = n.tagName.getText(sf);
        if (tag === 'PrefixSelect') selects += 1;
        if (tag === 'input' || tag === 'Field') {
          const attrs = n.attributes.properties.filter(ts.isJsxAttribute);
          const val = (k: string) => attrs.find((a) => a.name.getText(sf) === k)?.initializer?.getText(sf) ?? '';
          const hidden = /hidden/.test(val('type'));
          if (!hidden && [val('name'), val('id')].some((v) => /name_prefix/.test(v))) {
            typed.push(sf.getLineAndCharacterOfPosition(n.getStart()).line + 1);
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
    assert.ok(selects >= 1, `${rel} draws no Prefix dropdown`);
    assert.deepEqual(typed, [], `${rel} still has a free-text Prefix box`);
  }
});
