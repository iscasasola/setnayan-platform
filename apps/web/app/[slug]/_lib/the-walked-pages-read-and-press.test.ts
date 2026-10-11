/**
 * ON THE PAGES THE GUEST WALKED: THE WORDS CAN BE READ, AND THE WAY BACK CAN BE PRESSED.
 *
 * A guest's walk, 2026-10-11 (faults N22 · N23): 78 pieces of text under 4.5:1 and a list of presses under 44px —
 * among them the sub-pages' back links and the grey sentences of their waiting states. This holds the ones on the
 * pages that walk's fixes already touched (the list is the bill: each row is a place a guest reads or presses).
 * It is NOT a sweep of the whole Event Hub — the rest of N22/N23 is reported, not built.
 *
 *   READ  — the element that holds the sentence wears an ink no fainter than 4.5:1 on the page (worked out from
 *           the house tokens in `globals.css`), or one of the page's solid colours.
 *   PRESS — the link is at least 44px tall.
 *
 * SABOTAGE RUN 2026-10-11 (committed first, put back by `git checkout`): the everyone page's back link put back to
 * `min-h-[40px] … text-ink/60` → red twice (read and press), naming the line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { stripComments } from '@/lib/strip-comments';

const ROOT = join(__dirname, '..');
const WEB = join(ROOT, '..', '..');

/**
 * The WORST ratio of `text-ink/<pct>` on the page, across the house look AND every Event Hub theme that sets its own
 * ink and paper in globals.css (`[data-hub-theme='…']` — velvet, gatsby and cyber are dark). Light and dark, one number.
 */
function inkContrast(alphaPct: number): number {
  const css = stripComments(readFileSync(join(WEB, 'app/globals.css'), 'utf8'));
  const tokenIn = (body: string, name: string) => {
    const m = body.match(new RegExp(`--color-${name}:\\s*(\\d+)\\s+(\\d+)\\s+(\\d+)`));
    return m ? ([Number(m[1]), Number(m[2]), Number(m[3])] as const) : null;
  };
  const houseInk = tokenIn(css, 'ink');
  const housePage = tokenIn(css, 'cream');
  assert.ok(houseInk && housePage, '--color-ink / --color-cream were not found in globals.css');
  const looks: Array<readonly [readonly number[], readonly number[]]> = [[houseInk!, housePage!]];
  for (const m of css.matchAll(/\[data-hub-theme='[a-z0-9-]+'\]\s*\{([^{}]*)\}/g)) {
    const ink = tokenIn(m[1]!, 'ink');
    const page = tokenIn(m[1]!, 'cream');
    if (ink && page) looks.push([ink, page]);
  }
  assert.ok(looks.length > 3, `only ${looks.length - 1} Event Hub theme(s) were read — the dark themes are not being measured`);
  const lin = (v: number) => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
  const lum = (c: readonly number[]) => 0.2126 * lin(c[0]!) + 0.7152 * lin(c[1]!) + 0.0722 * lin(c[2]!);
  const a = alphaPct / 100;
  let worst = Infinity;
  for (const [ink, page] of looks) {
    const mixed = ink.map((v, i) => v * a + page[i]! * (1 - a));
    const [hi, lo] = [lum(page), lum(mixed)].sort((x, y) => y - x) as [number, number];
    worst = Math.min(worst, (hi + 0.05) / (lo + 0.05));
  }
  return worst;
}

/** The classes of the element that holds `words` — the nearest `className="…"` before them. */
function classesAround(rel: string, words: string): string[] {
  const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
  const at = src.indexOf(words);
  assert.ok(at > 0, `${rel}: ${JSON.stringify(words)} is no longer on the page — this row is pointing at nothing`);
  const before = src.slice(Math.max(0, at - 700), at);
  const all = [...before.matchAll(/className="([^"]*)"/g)];
  assert.ok(all.length > 0, `${rel}: no element was found around ${JSON.stringify(words)}`);
  return all[all.length - 1]![1]!.split(/\s+/);
}

/** The classes of the LINK that holds `words` — not of an icon drawn inside it. */
function linkClassesAround(rel: string, words: string): string[] {
  const src = stripComments(readFileSync(join(ROOT, rel), 'utf8'));
  const at = src.indexOf(words);
  assert.ok(at > 0, `${rel}: ${JSON.stringify(words)} is no longer on the page — this row is pointing at nothing`);
  const before = src.slice(Math.max(0, at - 700), at);
  const all = [...before.matchAll(/<(?:Link|a|SeatBackLink|button)\b[^>]*?className="([^"]*)"/g)];
  assert.ok(all.length > 0, `${rel}: no link was found around ${JSON.stringify(words)}`);
  return all[all.length - 1]![1]!.split(/\s+/);
}

/** Colours that are solid on their ground (not a tint of ink). */
const SOLID = /^text-(?:ink|white|cream|terracotta-700|link)$/;

const READ: Array<[string, string]> = [
  ['everyone/page.tsx', 'The entourage hasn&rsquo;t been shared yet.'],
  ['everyone/page.tsx', 'No one else has said yes yet.'],
  ['everyone/page.tsx', 'The rest of the guest list is for invited guests.'],
  ['everyone/page.tsx', 'Back to the invitation'],
  ['seat/page.tsx', '{body}</p>'],
  ['find-my-table/page.tsx', '{body}</p>'],
  ['hub/page.tsx', "withDayNote('Your table shows here on the day.'"],
  // 2026-10-12 · the rest of N22 as the live re-walk of d2e38b7 listed it (and what the 375×812 sweep found beside it).
  ['_components/save-the-date.tsx', 'Full invitation to follow.'],
  ['_components/save-the-date.tsx', 'Save the date\n          </p>\n          <h1'],
  ['_components/guest-ticket.tsx', "{pending ? REQUEST_WORDS.sentUnlocks : 'Show this at the door.'}"],
  ['_components/face-tagging-row.tsx', '>Face tagging</span>'],
  ['_components/selfie-capture.tsx', '>Face tagging</p>'],
  ['_components/not-you-switch.tsx', '{SIGN_OUT_ERASES_SELFIE}'],
  ['_components/rsvp-widget.tsx', 'Required\n        </span>'],
  ['pabuya/page.tsx', 'Pabuya\n          </span>'],
  ['seat/page.tsx', 'Setnayan\n            </span>'],
  ['seat/page.tsx', 'Scanning your'],
];

const PRESS: Array<[string, string]> = [
  ['everyone/page.tsx', 'Back to the invitation'],
  ['seat/page.tsx', 'Back to your invitation'],
  ['find-my-table/page.tsx', 'Back to your invitation'],
  ['find-seat/page.tsx', 'Back to the invitation\n      </SeatBackLink>'],
  ['venue/page.tsx', '← Back to the invitation'],
  // 2026-10-12 · the rest of N23 as the live re-walk of d2e38b7 listed it.
  ['_components/not-you-switch.tsx', 'Switch\n      </button>'],
  ['_components/rsvp-widget.tsx', 'Terms\n        </Link>'],
  ['_components/rsvp-widget.tsx', 'Privacy Notice\n        </Link>'],
  ['find-seat/_components/seat-frame.tsx', '<path d="m15 6-6 6 6 6" />'],
  ['pabuya/page.tsx', '<Logo height={26} />'],
  ['seat/page.tsx', '<Logo height={28} />'],
  ['avatar/page.tsx', '← Back\n          </Link>'],
  ['avatar/_components/avatar-maker.tsx', 'style={{ backgroundColor: hex }}'],
  ['recap/page.tsx', 'Open their page'],
];

/** Presses a thumb finds by WIDTH too — a word or an icon narrower than 44px on its own. */
const WIDE: Array<[string, string]> = [
  ['_components/not-you-switch.tsx', 'Switch\n      </button>'],
  ['_components/rsvp-widget.tsx', 'Terms\n        </Link>'],
  ['find-seat/_components/seat-frame.tsx', '<path d="m15 6-6 6 6 6" />'],
  ['pabuya/page.tsx', '<Logo height={26} />'],
  ['avatar/_components/avatar-maker.tsx', 'style={{ backgroundColor: hex }}'],
];

test('READ — each sentence on the walked pages is at least 4.5:1 on the page', () => {
  assert.ok(inkContrast(60) < 4.5 && inkContrast(65) >= 4.5, `the measure moved: ink/60 ${inkContrast(60).toFixed(2)}, ink/65 ${inkContrast(65).toFixed(2)}`);
  const faint: string[] = [];
  for (const [rel, words] of READ) {
    const cls = classesAround(rel, words);
    if (cls.some((c) => SOLID.test(c))) continue;
    const tint = cls.map((c) => c.match(/^text-ink\/(\d+)$/)).find(Boolean);
    assert.ok(tint, `${rel}: the element around ${JSON.stringify(words)} sets no ink of its own (${cls.join(' ')}) — re-aim this row at the element that does`);
    const ratio = inkContrast(Number(tint![1]));
    if (ratio < 4.5) faint.push(`app/[slug]/${rel}: ${JSON.stringify(words.slice(0, 50))} is ${ratio.toFixed(2)}:1 (text-ink/${tint![1]})`);
  }
  assert.deepEqual(faint, []);
});

test('PRESS — each way back on the walked pages is at least 44px tall', () => {
  const small: string[] = [];
  for (const [rel, words] of PRESS) {
    const cls = linkClassesAround(rel, words);
    const tall = cls.some((c) => /^min-h-\[(\d+)px\]$/.test(c) && Number(c.match(/\d+/)![0]) >= 44) || cls.some((c) => /^(?:h|min-h)-(?:11|12|14|16)$/.test(c));
    if (!tall) small.push(`app/[slug]/${rel}: the link ${JSON.stringify(words.slice(0, 40))} is under 44px (${cls.join(' ')})`);
  }
  assert.deepEqual(small, []);
});

test('WIDE — each narrow press on the walked pages is at least 44px wide as well', () => {
  const narrow: string[] = [];
  for (const [rel, words] of WIDE) {
    const cls = linkClassesAround(rel, words);
    const wide = cls.some((c) => /^min-w-\[(\d+)px\]$/.test(c) && Number(c.match(/\d+/)![0]) >= 44) || cls.some((c) => /^(?:w|min-w)-(?:11|12|14|16)$/.test(c));
    if (!wide) narrow.push(`app/[slug]/${rel}: the press around ${JSON.stringify(words.slice(0, 40))} is under 44px wide (${cls.join(' ')})`);
  }
  assert.deepEqual(narrow, []);
});

test('a ROUND press stays round — its height and width are the same floor', () => {
  // globals.css gives every <button> a 44px min-height: a circle sized only by h-7 w-7 became a 28×44 oval.
  for (const [rel, words] of [['find-seat/_components/seat-frame.tsx', '<path d="m15 6-6 6 6 6" />'], ['avatar/_components/avatar-maker.tsx', 'style={{ backgroundColor: hex }}']] as const) {
    const cls = linkClassesAround(rel, words);
    assert.ok(cls.includes('rounded-full'), `${rel}: no longer round (${cls.join(' ')})`);
    const h = cls.find((c) => /^h-\d+$/.test(c));
    const w = cls.find((c) => /^w-\d+$/.test(c));
    assert.ok(h && w && h.slice(2) === w.slice(2), `${rel}: a round press must be square — ${h} × ${w}`);
  }
});
