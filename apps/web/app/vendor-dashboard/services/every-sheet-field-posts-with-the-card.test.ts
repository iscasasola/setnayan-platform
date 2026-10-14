/**
 * every-sheet-field-posts-with-the-card.test.ts
 *
 * 🔴 LIVE 2026-09-07 → 2026-10-14: a supplier's service card saved WITHOUT its
 * photo, price, gift, what's included, discounts, crew or book-ahead rules.
 *
 * a1e6887ceb portaled the maker's sheets to <body> (to escape `.sn-page-enter`'s
 * identity transform — a real fault, see a-sheet-must-escape-the-page-transform).
 * The browser builds a form's data from the form's DOM descendants plus the
 * controls that name it with `form="<id>"`; a portaled control is neither. So
 * `new FormData(form)` and the submit saw only what sits on the card face —
 * kind, name, coverage — the card never painted the rest, and Publish (which
 * needs a cover photo and a price) never opened. Measured on the lab with
 * Playwright: the price input was not inside the form and the posted keys were
 * `category · collected_kind_phrase · coverage_id · title`.
 *
 * ⚖ WHAT IS PINNED, AND WHY EACH PART IS SEPARATE:
 *   1. the joining itself WORKS — every control under a portaled root gets
 *      `form=`, including ones mounted later (an upload that lands, a row added),
 *      and a sibling form's controls are left to their own form;
 *   2. every sheet INSIDE the card form in the React tree passes `formId` —
 *      one sheet without it is one block of fields that silently posts nothing;
 *   3. every field the maker renders sits in the card form or in a sheet that
 *      joins it (or in the audience sheet's own form) — no field outside a form;
 *   4. what reads the form across the portal (the live card, the local keep,
 *      FileUpload's in-flight refusal) finds it by ownership, not by DOM nesting.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from '@/lib/strip-comments';
import {
  FORM_CONTROL_SELECTOR,
  FORM_OWNER_ATTR,
  joinPortaledFieldsToForm,
  ownerFormOf,
} from '@/lib/portaled-fields-join-their-form';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = resolve(HERE, '..', '..', '..');
const read = (p: string) => stripComments(readFileSync(join(WEB, p), 'utf8'));

const MAKER = 'app/vendor-dashboard/services/_components/canvas-maker.tsx';
const FILE_UPLOAD = 'app/_components/file-upload.tsx';

// ── 1 · the joining, on a small fake DOM ────────────────────────────────────

const CONTROL_TAGS = FORM_CONTROL_SELECTOR.split(',').map((t) => t.trim().toUpperCase());

class FakeEl {
  tagName: string;
  attrs = new Map<string, string>();
  children: FakeEl[] = [];
  parent: FakeEl | null = null;
  nodeType = 1;
  ownerDocument: { getElementById(id: string): FakeEl | null } | null = null;
  constructor(tag: string, attrs: Record<string, string> = {}) {
    this.tagName = tag.toUpperCase();
    for (const [k, v] of Object.entries(attrs)) this.attrs.set(k, v);
  }
  add(...kids: FakeEl[]): this {
    for (const k of kids) {
      k.parent = this;
      this.children.push(k);
    }
    return this;
  }
  private test(selector: string): boolean {
    if (selector === FORM_CONTROL_SELECTOR) return CONTROL_TAGS.includes(this.tagName);
    if (selector === 'form') return this.tagName === 'FORM';
    const attr = /^\[(.+)\]$/.exec(selector);
    if (attr) return this.attrs.has(attr[1]!);
    throw new Error(`fake DOM: unsupported selector ${selector}`);
  }
  matches(selector: string): boolean {
    return this.test(selector);
  }
  closest(selector: string): FakeEl | null {
    for (let n: FakeEl | null = this; n; n = n.parent) if (n.test(selector)) return n;
    return null;
  }
  querySelectorAll(selector: string): FakeEl[] {
    const out: FakeEl[] = [];
    const walk = (n: FakeEl) => {
      for (const c of n.children) {
        if (c.test(selector)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }
  hasAttribute(n: string) {
    return this.attrs.has(n);
  }
  getAttribute(n: string) {
    return this.attrs.get(n) ?? null;
  }
  setAttribute(n: string, v: string) {
    this.attrs.set(n, v);
  }
}

type Cb = (records: Array<{ addedNodes: FakeEl[] }>) => void;
function withFakeObserver<T>(fn: (fire: Cb, state: { observing: boolean }) => T): T {
  const g = globalThis as unknown as { MutationObserver?: unknown };
  const prev = g.MutationObserver;
  let cb: Cb = () => {
    throw new Error('the joining never watched the sheet for fields mounted later');
  };
  const state = { observing: false };
  g.MutationObserver = class {
    constructor(c: Cb) {
      cb = c;
    }
    observe(_root: unknown, opts: { childList?: boolean; subtree?: boolean }) {
      assert.ok(opts.childList && opts.subtree, 'must watch the WHOLE sheet (childList + subtree)');
      state.observing = true;
    }
    disconnect() {
      state.observing = false;
    }
  };
  try {
    return fn((r) => cb(r), state);
  } finally {
    g.MutationObserver = prev;
  }
}

test('every control under a portaled sheet joins the card form — now and when mounted later', () => {
  withFakeObserver((fire, state) => {
    const price = new FakeEl('input', { name: 'starting_price_php' });
    const basis = new FakeEl('input', { type: 'hidden', name: 'pricing_basis' });
    const note = new FakeEl('textarea', { name: 'inclusion_label' });
    const pick = new FakeEl('select', { name: 'discount_kind' });
    const confirm = new FakeEl('button', { type: 'button' });
    const chosen = new FakeEl('input', { name: 'x', form: 'someone-else' });
    const sibling = new FakeEl('form').add(new FakeEl('input', { name: 'coverage_id' }));
    const root = new FakeEl('div').add(
      new FakeEl('div').add(price, basis),
      note,
      pick,
      confirm,
      chosen,
      sibling,
    );

    const stop = joinPortaledFieldsToForm(root as unknown as Element, 'card');

    for (const el of [price, basis, note, pick, confirm]) {
      assert.equal(el.getAttribute('form'), 'card', `${el.tagName} ${el.getAttribute('name') ?? ''} did not join`);
    }
    assert.equal(chosen.getAttribute('form'), 'someone-else', 'an author-chosen form= was overwritten');
    assert.equal(
      sibling.children[0]!.getAttribute('form'),
      null,
      "a sibling form's field was pulled into the card — it would post to the wrong action",
    );
    assert.equal(root.getAttribute(FORM_OWNER_ATTR), 'card', 'the root does not say which form it belongs to');

    // An upload lands / a vendor adds a row: new nodes mount into the open sheet.
    const landed = new FakeEl('input', { type: 'hidden', name: 'primary_photo_r2_key' });
    const row = new FakeEl('div').add(new FakeEl('input', { name: 'discount_label' }));
    fire([{ addedNodes: [landed, row] }]);
    assert.equal(landed.getAttribute('form'), 'card', 'a field mounted after open did not join');
    assert.equal(row.children[0]!.getAttribute('form'), 'card', 'a field inside a later-added row did not join');

    assert.ok(state.observing);
    stop();
    assert.equal(state.observing, false, 'the watcher outlives the sheet');
  });
});

test('ownerFormOf finds the form across the portal, and only that form', () => {
  const card = new FakeEl('form', { id: 'card' });
  const doc = { getElementById: (id: string) => (id === 'card' ? card : null) };
  const inside = new FakeEl('input');
  card.add(inside);
  const root = new FakeEl('div', { [FORM_OWNER_ATTR]: 'card' });
  const portaled = new FakeEl('button');
  root.add(new FakeEl('span').add(portaled));
  portaled.ownerDocument = doc;
  const stray = new FakeEl('input');
  stray.ownerDocument = doc;

  const of = (n: FakeEl) => ownerFormOf(n as unknown as Element) as unknown;
  assert.equal(of(inside), card, 'a field inside the form lost its form');
  assert.equal(of(portaled), card, 'a field in the portaled sheet cannot find its form');
  assert.equal(of(stray), null, 'a field in no form was given one');
  assert.equal(ownerFormOf(null), null);
});

// ── 2 + 3 · the maker wires it, for every sheet and every field ─────────────

/** End of a JSX opening tag starting at `start` (`<Tag`), skipping `{…}` props. */
function tagEnd(src: string, start: number): number {
  let depth = 0;
  for (let i = start; i < src.length; i++) {
    const c = src[i];
    if (c === '{') depth++;
    else if (c === '}') depth--;
    else if (c === '>' && depth === 0) return i;
  }
  throw new Error('unterminated tag');
}

function indicesOf(src: string, needle: RegExp): number[] {
  const out: number[] = [];
  const re = new RegExp(needle.source, needle.flags.includes('g') ? needle.flags : `${needle.flags}g`);
  for (let m = re.exec(src); m; m = re.exec(src)) out.push(m.index);
  return out;
}

const src = read(MAKER);
const makerStart = src.indexOf('export function CanvasMaker(');
const makerEnd = src.indexOf('\nfunction ', makerStart);
const maker = src.slice(makerStart, makerEnd);

/** The card <form>: from its opening tag to its own `</form>`. */
const cardOpen = indicesOf(maker, /<form\b/).find((i) =>
  /id=\{CARD_FORM_ID\}/.test(maker.slice(i, tagEnd(maker, i))),
);
const cardClose = cardOpen === undefined ? -1 : maker.indexOf('</form>', cardOpen);

test('the guard reads a real maker', () => {
  assert.ok(src.length > 50_000, `${MAKER} is ${src.length} chars — a guard on an empty file passes everything`);
  assert.ok(makerStart > -1 && makerEnd > makerStart, 'CanvasMaker is gone or renamed');
});

test('the card form has the id the sheets join, and does not refuse in silence over a closed sheet', () => {
  assert.ok(cardOpen !== undefined, 'the card <form> no longer carries id={CARD_FORM_ID}');
  const open = maker.slice(cardOpen, tagEnd(maker, cardOpen));
  assert.match(open, /action=\{commitVendorService\}/, 'the id moved off the form that saves the card');
  assert.match(src, /export const CARD_FORM_ID = '[a-z-]+';/, 'CARD_FORM_ID is not a plain constant');
  // Most fields live in CLOSED sheets: a native refusal there focuses nothing
  // and says nothing. The server re-validates and says why.
  assert.match(open, /\bnoValidate\b/, 'the card form lost noValidate');
});

test('every sheet inside the card form joins it', () => {
  const sheets = indicesOf(maker, /<CanvasSheet\b/);
  const inForm = sheets.filter((i) => i > cardOpen! && i < cardClose);
  console.log(`  sheets inside the card form: ${inForm.length} · outside: ${sheets.length - inForm.length}`);
  assert.ok(inForm.length >= 6, `only ${inForm.length} sheets found inside the card form — the region is mis-read`);
  for (const i of inForm) {
    const open = maker.slice(i, tagEnd(maker, i));
    const id = /\bid="([^"]+)"/.exec(open)?.[1] ?? '?';
    assert.match(
      open,
      /\bformId=\{CARD_FORM_ID\}/,
      `sheet ${id} sits in the card form but does not join it — every field in it posts NOTHING`,
    );
  }
  for (const i of sheets.filter((j) => j > cardClose)) {
    const close = maker.indexOf('</CanvasSheet>', i);
    const body = maker.slice(i, close);
    const id = /\bid="([^"]+)"/.exec(body)?.[1] ?? '?';
    assert.match(body, /<form\b/, `sheet ${id} sits outside the card form and carries no form of its own`);
    assert.doesNotMatch(
      maker.slice(i, tagEnd(maker, i)),
      /formId=/,
      `sheet ${id} has its own form — joining the card would post its fields twice`,
    );
  }
});

test('every field the maker renders sits in a form that saves it', () => {
  // A field is any element with a name=, or a shipped editor that renders named fields.
  const FIELD_COMPONENTS =
    /<(FileUpload|ShowcaseMediaFields|PricingBasisEditor|PriceBracketsEditor|DiscountsEditor|IncludedFlags|InclusionsEditor|CustomizationStep)\b/;
  const fields = [
    ...indicesOf(maker, /\sname=[{"]/),
    ...indicesOf(maker, new RegExp(FIELD_COMPONENTS.source)),
  ].sort((a, b) => a - b);
  // Sibling forms (the audience sheet's): their fields are theirs.
  const siblingForms = indicesOf(maker, /<form\b/)
    .filter((i) => i !== cardOpen)
    .map((i) => [i, maker.indexOf('</form>', i)] as const);
  const homeless = fields.filter(
    (i) => !(i > cardOpen! && i < cardClose) && !siblingForms.some(([a, b]) => i > a && i < b),
  );
  console.log(`  fields in the maker: ${fields.length} · outside any form: ${homeless.length}`);
  assert.ok(fields.length >= 15, `only ${fields.length} fields found — the scan is mis-reading the maker`);
  assert.deepEqual(
    homeless.map((i) => maker.slice(i, i + 60).replace(/\s+/g, ' ')),
    [],
    'a field outside every form posts nothing',
  );
});

test('the sheet joins its fields by construction, on the portaled root', () => {
  const at = src.indexOf('function CanvasSheet(');
  assert.ok(at > -1, 'CanvasSheet is gone');
  const body = src.slice(at);
  assert.match(body, /formId\?: string/, 'CanvasSheet no longer takes the form id');
  assert.match(
    body,
    /joinPortaledFieldsToForm\(root, formId\)/,
    'CanvasSheet no longer joins its fields to the form',
  );
  assert.match(
    body,
    /createPortal\(\s*<div ref=\{rootRef\}/,
    'the joining watches something other than the portaled root',
  );
});

test('what reads the card form across the portal finds it by ownership', () => {
  // The live card and the local keep listen on the document and keep to this
  // card's fields; a listener on the <form> element never hears a sheet.
  assert.doesNotMatch(
    maker,
    /form\.addEventListener\('(input|change|click)'/,
    'a field listener went back onto the <form> element — typing in a sheet never reaches it',
  );
  assert.equal(
    indicesOf(maker, /ownerFormOf\(e\.target as Element \| null\) === form/).length,
    2,
    'the live card read and the local keep must each filter by ownerFormOf',
  );
  // FileUpload refuses a save while a photo is still uploading — on the form
  // it belongs to, which closest('form') cannot find from inside a sheet.
  const fu = read(FILE_UPLOAD);
  assert.match(fu, /const form = ownerFormOf\(rootRef\.current\);/, 'FileUpload finds its form by DOM nesting again');
});
