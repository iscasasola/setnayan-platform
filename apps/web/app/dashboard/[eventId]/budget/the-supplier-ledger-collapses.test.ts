/**
 * the-supplier-ledger-collapses.test.ts — on the budget screen a supplier is a
 * LEDGER ROW: the money shows without being asked, the history opens on a tap.
 *
 * ── What this pins ────────────────────────────────────────────────────────
 * The binding Ledger archetype (prototypes/archetype_data_roster_ledger_
 * comparison_2026-08-01.html, route chip `/dashboard/[event]/budget`), note 3:
 *
 *   "Summary first, history on demand. Each row expands to its dated payments
 *    and receipts; collapsed, the ledger stays one screen of truth."
 *
 * ── ⚠ REV 1 OF THIS GUARD WAS LOUD ON REFACTORS AND SILENT ON REGRESSIONS ──
 * An adversarial audit defeated it four ways, and each hole is a rule below:
 *
 *   · `<details open>` — five characters — put every supplier's full table and
 *     payment log back on screen at once, and a presence check for `<details`
 *     matched `<details open>` just as happily. GREEN.
 *   · The money rule tracked the POSITION OF AN IDENTIFIER. Empty out what
 *     `ledgerRow` renders and the collapsed row becomes a name and a status
 *     pill with no amounts, while `{ledgerRow}` still sits above `</summary>`.
 *     GREEN.
 *   · Hoisting the disclosure into a `const` above the branch split moved it
 *     outside both slices, so "the embed has no disclosure" saw nothing. GREEN.
 *   · And it went RED on `const isEmbed = variant === 'embed'` — a refactor
 *     that changes nothing a person sees. Loud where it should be quiet.
 *
 * 🔑 A guard that is loud on refactors and silent on regressions is worse than
 * none: it teaches you to edit the guard rather than the code. So the rules
 * below anchor on the `if (variant === 'embed') {` STATEMENT (not a bare
 * substring), count disclosures across the WHOLE component (not per slice), and
 * check what the row RENDERS rather than where its name appears.
 *
 * ⚠ EVIDENCE GRADE: source-derived. This card sits behind a login and a session
 * does not authenticate, so nothing here was observed in a browser.
 *
 * 🛡 Mutation-checked by printed occurrence count, before → after.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const CARD = join(__dirname, '..', '_components', 'vendor-itemization-card.tsx');

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

type Regions = {
  /** The whole exported component, start to close. */
  component: string;
  /** The early-return block for the workspace embed. */
  embed: string;
  /** Everything after it: the /budget card. */
  card: string;
  /** What `ledgerRow` is defined to render. */
  ledgerRowBody: string;
};

function regions(): Regions {
  const src = stripComments(readFileSync(CARD, 'utf8'));

  const componentAt = src.indexOf('export function VendorItemizationCard');
  assert.ok(
    componentAt > 0,
    'VendorItemizationCard is gone or renamed — teach this guard the new name rather than deleting it.',
  );
  // ⚠ NOT `indexOf('\n}')` — the component's own destructured parameter list
  // closes with a column-0 `}` about 130 characters in, so that lands inside
  // the signature and every rule below then reads an empty component. Bound it
  // by the NEXT top-level declaration instead.
  const nextDecl = src.indexOf('\nfunction ', componentAt);
  const componentEnd = nextDecl > 0 ? src.lastIndexOf('\n}', nextDecl) : src.length;
  assert.ok(
    componentEnd > componentAt + 400,
    'could not bound the component — the slice came back too small to contain a render branch, which is how a guard reports a clean file it never read.',
  );
  const component = src.slice(componentAt, componentEnd);

  // Anchor on the STATEMENT, never a bare substring: `const isEmbed = variant
  // === 'embed'` is a no-op refactor and must not move the split.
  const embedIf = /if \(variant === 'embed'\) \{/.exec(component);
  assert.ok(
    embedIf,
    "the `if (variant === 'embed') {` early return is gone. This card renders on /budget AND inside " +
      'the vendor workspace and the rules below depend on telling them apart — teach this guard the ' +
      'new shape rather than deleting it.',
  );
  const at = embedIf.index;
  const embedEnd = component.indexOf('\n  }', at);
  assert.ok(embedEnd > at, 'could not find the close of the embed branch');
  const embed = component.slice(at, embedEnd);
  const card = component.slice(embedEnd);

  const rowAt = component.indexOf('const ledgerRow = (');
  assert.ok(rowAt > 0, '`ledgerRow` is gone — re-anchor this guard on whatever renders the money.');
  const rowEnd = component.indexOf('\n  );', rowAt);
  assert.ok(rowEnd > rowAt, 'could not find the end of the ledgerRow definition');
  const ledgerRowBody = component.slice(rowAt, rowEnd);

  // Floor: a mis-cut slice passes every rule below in silence.
  assert.ok(
    embed.includes('return (') && card.includes('<article'),
    'the region split landed on the wrong text — embed must hold a return and card must hold the <article> shell.',
  );
  return { component, embed, card, ledgerRowBody };
}

test("a supplier's history opens on demand — and it is genuinely shut", () => {
  const { card } = regions();

  const summaryEnd = card.indexOf('</summary>');
  assert.ok(
    card.includes('<details') && summaryEnd > 0,
    'the /budget supplier card no longer has a disclosure: every supplier now holds its full line-item table and payment log open at once, which is the state the Ledger archetype calls out by name.',
  );

  // `<details open>` is a disclosure that discloses nothing — five characters
  // that undo the whole change while every presence check still passes.
  const openAttr = /<details\b[^>]*\bopen\b/.exec(card);
  assert.equal(
    openAttr,
    null,
    'the disclosure ships with `open`, so every supplier is expanded on arrival and the fold is decoration. If a default-open card is genuinely wanted, that is a design decision and belongs in the archetype, not in an attribute.',
  );
});

test('the money is above the fold, and it is really the money', () => {
  const { card, ledgerRowBody } = regions();
  const summaryEnd = card.indexOf('</summary>');
  const moneyAt = card.indexOf('{ledgerRow}');
  const historyAt = card.indexOf('{workingSections}');
  assert.ok(
    moneyAt > 0 && historyAt > 0,
    'the row and the history are no longer rendered by name — re-anchor this guard on whatever replaced them.',
  );

  assert.ok(
    moneyAt < summaryEnd,
    'the money moved BELOW the fold. A collapsed supplier now shows a name and a status pill and no amounts — a ledger row with no magnitude to scan.',
  );
  assert.ok(
    historyAt > summaryEnd,
    'the line items and the payment log are inside the summary, so the card is a disclosure that discloses nothing — everything is open again, one indirection later.',
  );

  // Position is not substance: `ledgerRow` can sit above the fold and render
  // nothing. Ask what it actually contains.
  const cells = [...ledgerRowBody.matchAll(/<Money\b/g)].length;
  assert.ok(
    cells >= 3,
    `the row above the fold renders ${cells} money cells, expected at least 3 (Budget · Paid · Remaining). ` +
      `A collapsed supplier with no amounts is a ledger row with nothing to scan, and moving the figures ` +
      `out of \`ledgerRow\` does that without moving the identifier this guard used to track.`,
  );
});

test('there is exactly ONE disclosure in this component, and the embed is not it', () => {
  const { component, embed } = regions();

  // Counted across the WHOLE component, so hoisting the <details> into a shared
  // const above the branch split cannot hide it from a per-slice check.
  const disclosures = [...component.matchAll(/<details\b/g)].length;
  assert.equal(
    disclosures,
    1,
    `${disclosures} disclosures in this component, expected exactly 1. The /budget card folds; the ` +
      `workspace embed must not. ` +
      `⚠ The reason the embed stays open is NOT that the workspace has its own Payments disclosure — ` +
      `it has none, and a comment here once claimed otherwise. It is that the workspace IS the page ` +
      `for a single supplier, reached by choosing that supplier, so folding away the only thing it ` +
      `exists to show is a door in front of the room you asked for.`,
  );
  assert.ok(
    !embed.includes('<details'),
    'the disclosure moved into the embed branch — the workspace page for one supplier now hides that supplier behind a fold.',
  );
});

test('a failed payments read is announced, and is not swallowed into a control’s name', () => {
  const { component, card, embed } = regions();

  assert.ok(
    component.includes('const refusedReadNotice'),
    'the refused-read notice is gone. A refused payments read makes `remaining` the FULL total, so silence there does not hide what the couple paid — it bills them for it again.',
  );
  assert.ok(
    embed.includes('{refusedReadNotice}'),
    'the workspace embed stopped rendering the refused-read notice.',
  );

  const noticeAt = card.indexOf('{refusedReadNotice}');
  const summaryStart = card.indexOf('<summary');
  assert.ok(noticeAt > 0, 'the /budget card stopped rendering the refused-read notice.');
  assert.ok(
    noticeAt < summaryStart,
    'the refused-read notice moved back inside the <summary>. A <summary> is announced as one control ' +
      'whose name is everything inside it, so a screen-reader user hears a paragraph of error prose read ' +
      'out as part of the button label. It is an alert about the card, not part of the row.',
  );
});

test('the row is a description list, and the disclosure keeps its state to itself', () => {
  const { card, ledgerRowBody } = regions();

  // <dt>/<dd> with no <dl> ancestor are orphans: the description-list
  // semantics are dropped entirely and assistive tech reads six unrelated
  // fragments instead of three labelled amounts. `dl > div > dt + dd` is the
  // valid grouping form, so the cell's own wrapper needs no change.
  assert.ok(
    ledgerRowBody.includes('<dl'),
    'the money strip stopped being a <dl>. Its cells render <dt>/<dd>, and outside a <dl> those are orphans — the pairing between each label and its amount is simply not conveyed.',
  );

  // `group-hover:` matches ANY `.group` ancestor, not the nearest, so a bare
  // `group` on this disclosure lights up a chevron three components deep in
  // vendor-direct-pay whenever the header is hovered.
  const bareGroup = /<details className="group"/.test(card);
  assert.equal(
    bareGroup,
    false,
    'the disclosure took the unnamed `group` class back. That makes it an ancestor `.group` for the whole card, and `group-hover:` inside vendor-direct-pay then fires on hovering the header — as if that button were under the cursor. Use `group/ledger` and `group-open/ledger:`.',
  );
  assert.ok(
    card.includes('group/ledger'),
    'the disclosure lost its named group — the Open/Close pair and the chevron no longer track its own state.',
  );
});
