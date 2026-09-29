/**
 * GUARD — a `<label>` that holds a button AND a form control must say which one
 * it labels (`htmlFor`), or a tap on the row goes to the button.
 *
 * 🚨 THIS SHIPPED. The Maker's Details print-set rows ("Seat plan", "Love
 * Story", "Schedule", …) could not be switched — owner, live: "why can't i
 * toggle them?". Each row was
 *
 *     <label>  <InfoTip …/>  <input type="checkbox" role="switch" class="sr-only"/>  </label>
 *
 * and per HTML a label with no `for` controls its FIRST LABELABLE DESCENDANT.
 * InfoTip renders a `<button>` (the ⓘ), which comes first — so every tap on the
 * row opened the tip and the switch never moved. The rows WITHOUT an ⓘ worked,
 * which is why it looked like a per-row fault and not a pattern.
 *
 * The fix is `htmlFor` + `id`: the label then controls the named field, and a
 * tap ON the ⓘ still opens the tip (activation behaviour skips a label's
 * interactive descendants).
 *
 * ── WHAT IT READS — the TypeScript AST, never a regex ─────────────────────
 * Every .tsx under app/ lib/ components/ (derived, never a hand list). Two
 * shapes are convicted:
 *
 *   1. DIRECT — a `<label>` without `htmlFor` whose own JSX contains a
 *      button-like element and a form control.
 *   2. THROUGH A PROP — a component whose `<label>` (no `htmlFor`) contains a
 *      form control and renders a prop (`{label}`, `{children}`), AND a call
 *      site that passes a button-like element into that prop. This is the
 *      Maker's RSVP-ask `Switch`, which received its InfoTip as `label={…}` —
 *      shape 1 alone cannot see it, because inside the component the InfoTip
 *      is only an identifier.
 *
 * Button-like = an intrinsic `<button>`, `<InfoTip>` (it renders one), or any
 * component whose name ends in `Button`. Form control = `<input>` (except
 * `type="hidden"`, which is not labelable), `<select>`, `<textarea>`.
 *
 * ⚠ Shape 1 fires even when the control comes BEFORE the button (and so the
 * label happens to work today): the order is one edit away from flipping, and
 * `htmlFor` costs one attribute. Say which one; never rely on position.
 *
 * Run: `pnpm test:unit` (from apps/web).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import ts from 'typescript';

const WEB = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ROOTS = ['app', 'lib', 'components'];

type Jsx = ts.JsxElement | ts.JsxSelfClosingElement;

function opening(n: Jsx): ts.JsxOpeningLikeElement {
  return ts.isJsxElement(n) ? n.openingElement : n;
}
function tagOf(n: Jsx): string {
  return opening(n).tagName.getText();
}
function attr(n: Jsx, name: string): ts.JsxAttribute | undefined {
  return opening(n).attributes.properties.find(
    (a): a is ts.JsxAttribute => ts.isJsxAttribute(a) && a.name.getText() === name,
  );
}
function isButtonLike(tag: string): boolean {
  return tag === 'button' || tag === 'InfoTip' || /Button$/.test(tag);
}
function isFormControl(n: Jsx): boolean {
  const tag = tagOf(n);
  if (tag === 'select' || tag === 'textarea') return true;
  if (tag !== 'input') return false;
  const type = attr(n, 'type')?.initializer;
  return !(type && ts.isStringLiteral(type) && type.text === 'hidden');
}

/** Every JSX element inside `root` (not `root` itself), in source order. */
function jsxInside(root: ts.Node): Jsx[] {
  const out: Jsx[] = [];
  const visit = (n: ts.Node) => {
    if (n !== root && (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n))) out.push(n);
    ts.forEachChild(n, visit);
  };
  ts.forEachChild(root, visit);
  return out;
}

/** The component a node sits in: `function X()` or `const X = (…) => …`. */
function enclosingComponent(n: ts.Node): string | null {
  for (let p: ts.Node | undefined = n.parent; p; p = p.parent) {
    if (ts.isFunctionDeclaration(p) && p.name) return p.name.text;
    if ((ts.isArrowFunction(p) || ts.isFunctionExpression(p)) && ts.isVariableDeclaration(p.parent)) {
      return ts.isIdentifier(p.parent.name) ? p.parent.name.text : null;
    }
  }
  return null;
}

type Finding = { file: string; line: number; why: string };
type Slot = { file: string; component: string; prop: string; exported: boolean };

function isExported(sf: ts.SourceFile, name: string): boolean {
  let found = false;
  const visit = (n: ts.Node) => {
    if (found) return;
    const mods = ts.canHaveModifiers(n) ? ts.getModifiers(n) : undefined;
    const exp = mods?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword);
    if (exp && ts.isFunctionDeclaration(n) && n.name?.text === name) found = true;
    if (exp && ts.isVariableStatement(n)) {
      for (const d of n.declarationList.declarations) if (ts.isIdentifier(d.name) && d.name.text === name) found = true;
    }
    if (ts.isExportDeclaration(n) && n.exportClause && ts.isNamedExports(n.exportClause)) {
      for (const e of n.exportClause.elements) if (e.name.text === name) found = true;
    }
  };
  ts.forEachChild(sf, visit);
  return found;
}

function importsName(sf: ts.SourceFile, name: string): boolean {
  return sf.statements.some(
    (s) =>
      ts.isImportDeclaration(s) &&
      s.importClause?.namedBindings &&
      ts.isNamedImports(s.importClause.namedBindings) &&
      s.importClause.namedBindings.elements.some((e) => e.name.text === name),
  );
}

/** Scan a set of sources. The self-test below feeds it fixtures. */
function scan(sources: Array<{ file: string; text: string }>): Finding[] {
  const findings: Finding[] = [];
  const slots = new Map<string, Slot[]>();
  const parsed = sources.map(({ file, text }) => ({
    file,
    sf: ts.createSourceFile(file, text, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX),
  }));
  const lineOf = (sf: ts.SourceFile, n: ts.Node) => sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1;

  // Pass 1 — every `<label>` with no `htmlFor`.
  for (const { file, sf } of parsed) {
    const visit = (n: ts.Node) => {
      if (ts.isJsxElement(n) && tagOf(n) === 'label' && !attr(n, 'htmlFor')) {
        const inside = jsxInside(n);
        const control = inside.find(isFormControl);
        const button = inside.find((e) => isButtonLike(tagOf(e)));
        if (control && button) {
          findings.push({
            file,
            line: lineOf(sf, n),
            why: `<label> holds <${tagOf(button)}> and <${tagOf(control)}> but has no htmlFor`,
          });
        } else if (control) {
          // A prop rendered inside the label could BE the button — remember it.
          const component = enclosingComponent(n);
          const visitExpr = (e: ts.Node) => {
            // A CHILD expression only — `value={x}` on the input is not content.
            if (ts.isJsxExpression(e) && e.expression && !ts.isJsxAttribute(e.parent)) {
              const x = e.expression;
              const prop = ts.isIdentifier(x)
                ? x.text
                : ts.isPropertyAccessExpression(x) && x.expression.getText() === 'props'
                  ? x.name.text
                  : null;
              if (prop && component) {
                const list = slots.get(component) ?? [];
                list.push({ file, component, prop, exported: isExported(sf, component) });
                slots.set(component, list);
              }
            }
            ts.forEachChild(e, visitExpr);
          };
          ts.forEachChild(n, visitExpr);
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }

  // Pass 2 — call sites that pour a button into one of those props.
  for (const { file, sf } of parsed) {
    const visit = (n: ts.Node) => {
      if (ts.isJsxElement(n) || ts.isJsxSelfClosingElement(n)) {
        const tag = tagOf(n);
        for (const slot of slots.get(tag) ?? []) {
          if (slot.file !== file && !(slot.exported && importsName(sf, tag))) continue;
          let carried: ts.Node[] = [];
          if (slot.prop === 'children') {
            carried = ts.isJsxElement(n) ? [...n.children] : [];
            const a = attr(n, 'children');
            if (a?.initializer) carried.push(a.initializer);
          } else {
            const a = attr(n, slot.prop);
            if (a?.initializer) carried = [a.initializer];
          }
          const button = carried
            .flatMap((c) => [c, ...jsxInside(c)])
            .find((c): c is Jsx => (ts.isJsxElement(c) || ts.isJsxSelfClosingElement(c)) && isButtonLike(tagOf(c)));
          if (button) {
            findings.push({
              file,
              line: lineOf(sf, n),
              why: `<${tag} ${slot.prop}={<${tagOf(button)}…>}> — ${slot.component}'s <label> (${slot.file}) has no htmlFor, so it controls that button, not its field`,
            });
          }
        }
      }
      ts.forEachChild(n, visit);
    };
    visit(sf);
  }
  return findings;
}

function tsxFiles(): Array<{ file: string; text: string }> {
  const out: Array<{ file: string; text: string }> = [];
  const walk = (dir: string) => {
    for (const name of readdirSync(dir)) {
      if (name === 'node_modules' || name.startsWith('.')) continue;
      const p = join(dir, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (p.endsWith('.tsx')) out.push({ file: relative(WEB, p), text: readFileSync(p, 'utf8') });
    }
  };
  for (const r of ROOTS) walk(join(WEB, r));
  return out;
}

// ── The detector itself, proven in BOTH directions before it is trusted ─────
test('self-test: it convicts both shapes and clears the fixed ones', () => {
  const direct = `export function T() {
    return <label><InfoTip label="x">tip</InfoTip><input type="checkbox" /></label>;
  }`;
  const directFixed = `export function T() {
    return <label htmlFor="a"><InfoTip label="x">tip</InfoTip><input id="a" type="checkbox" /></label>;
  }`;
  const hiddenOnly = `export function T() {
    return <label><button type="button">b</button><input type="hidden" name="n" /></label>;
  }`;
  const viaProp = `function Switch({ label }: { label: React.ReactNode }) {
    return <label><span>{label}</span><input type="checkbox" /></label>;
  }
  export function Page() {
    return <Switch label={<InfoTip label="Diet">tip</InfoTip>} />;
  }`;
  const viaPropPlain = `function Switch({ label }: { label: string }) {
    return <label><span>{label}</span><input type="checkbox" /></label>;
  }
  export function Page() { return <Switch label="Diet" />; }`;
  const viaChildren = `export function Row({ children }: { children: React.ReactNode }) {
    return <label>{children}<select /></label>;
  }`;
  const viaChildrenUser = `import { Row } from './row';
  export function P() { return <Row><SubmitButton>Go</SubmitButton></Row>; }`;

  assert.equal(scan([{ file: 'direct.tsx', text: direct }]).length, 1, 'direct shape not convicted');
  assert.equal(scan([{ file: 'fixed.tsx', text: directFixed }]).length, 0, 'fixed shape convicted');
  assert.equal(scan([{ file: 'hidden.tsx', text: hiddenOnly }]).length, 0, 'hidden input is not labelable');
  assert.equal(scan([{ file: 'prop.tsx', text: viaProp }]).length, 1, 'prop shape not convicted');
  assert.equal(scan([{ file: 'plain.tsx', text: viaPropPlain }]).length, 0, 'a string label convicted');
  assert.equal(
    scan([
      { file: 'row.tsx', text: viaChildren },
      { file: 'user.tsx', text: viaChildrenUser },
    ]).length,
    1,
    'children shape across files not convicted',
  );
});

test('every <label> holding a button and a form control names its control with htmlFor', () => {
  const files = tsxFiles();
  assert.ok(files.length > 500, `walked only ${files.length} .tsx files — the walk is broken, not the tree clean`);
  const findings = scan(files);
  assert.deepEqual(
    findings.map((f) => `${f.file}:${f.line} — ${f.why}`),
    [],
    'A <label> with no `for` controls its FIRST labelable descendant — a button here, so a tap on ' +
      'the row presses the button instead of the field. Add `htmlFor` on the label and a matching ' +
      '`id` on the field (useId() in a client component; a value derived from the field name in a ' +
      'server component).',
  );
});
