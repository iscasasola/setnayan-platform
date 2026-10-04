/**
 * theme-faces-are-real.test.ts — EVERY THEME WEARS ITS OWN FACES, NOT A LOOK-ALIKE.
 *
 * Until 2026-10-04 ten of the spec's families (Lora, Libre Baskerville, Crimson
 * Pro, Josefin Sans, Kaushan Script, Alex Brush, Parisienne, Cookie, Mrs Saint
 * Delafield, Monoton) were not in the repo, and each theme wore the closest face
 * we shipped. The owner asked for the real ones; they are now committed from
 * google/fonts (`scripts/build-theme-faces.py`).
 *
 * 🔑 A STAND-IN IS INVISIBLE TO EVERY OTHER CHECK. `var(--font-hub-cardo)` on
 * Rustic's body resolves, loads and renders — it is simply not Lora. So this
 * file does not trust a variable's NAME: it follows each theme's CSS block to the
 * `localFont()` that defines the variable, opens the font file it loads, and
 * reads the family from the font's own `name` table. A look-alike carries its
 * own name, and fails.
 *
 * Also held: each of the ten files exists and IS a WOFF2; its family's licence
 * sits beside it; none of them is preloaded (a guest downloads a face only on a
 * page whose theme sets text in it).
 *
 * 2026-10-04 (owner "Yes to both"): the ten are no longer theme-only — each is
 * a Look › Font choice too, and the last test holds that the dropdown's entry
 * loads the SAME variable the theme wears, so "Lora" picked is the Lora a
 * Rustic page already sets.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { brotliDecompressSync } from 'node:zlib';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { HUB_THEMES } from '@/lib/invite-themes';
import * as faces from '@/lib/hub-theme-faces';
import { HUB_FONTS, sanitizeHubFontKey } from '@/lib/hub-fonts';
import { hubFontShelves } from '@/lib/hub-font-shelves';

const WEB = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEN = [
  'Lora',
  'Libre Baskerville',
  'Crimson Pro',
  'Josefin Sans',
  'Kaushan Script',
  'Alex Brush',
  'Parisienne',
  'Cookie',
  'Mrs Saint Delafield',
  'Monoton',
] as const;

/** The three files that declare a face `<html>` or a skin wears. */
const LOADERS = ['app/layout.tsx', 'app/_fonts/choice-faces.ts', 'app/[slug]/_components/skins/site-skin.tsx'];

/** `--font-x` → the font files its `localFont({…})` loads (absolute) and the call's body. */
function declarations(): Map<string, { files: string[]; body: string; at: string }> {
  const out = new Map<string, { files: string[]; body: string; at: string }>();
  for (const rel of LOADERS) {
    const src = readFileSync(join(WEB, rel), 'utf8');
    for (const m of src.matchAll(/localFont\(\{([\s\S]*?)\n\}\);/g)) {
      const body = m[1] ?? '';
      const v = /variable:\s*'(--font-[a-z-]+)'/.exec(body)?.[1];
      if (!v) continue;
      const files = [...body.matchAll(/path:\s*'([^']+)'/g)].map((p) => join(WEB, dirname(rel), p[1] as string));
      out.set(v, { files, body, at: rel });
    }
  }
  return out;
}

const WOFF2_KNOWN_TAGS = ['cmap', 'head', 'hhea', 'hmtx', 'maxp', 'name', 'OS/2', 'post', 'cvt ', 'fpgm', 'glyf', 'loca', 'prep', 'CFF ', 'VORG', 'EBDT', 'EBLC', 'gasp', 'hdmx', 'kern', 'LTSH', 'PCLT', 'VDMX', 'vhea', 'vmtx', 'BASE', 'GDEF', 'GPOS', 'GSUB', 'EBSC', 'JSTF', 'MATH', 'CBDT', 'CBLC', 'COLR', 'CPAL', 'SVG ', 'sbix', 'acnt', 'avar', 'bdat', 'bloc', 'bsln', 'cvar', 'fdsc', 'feat', 'fmtx', 'fvar', 'gvar', 'hsty', 'just', 'lcar', 'mort', 'morx', 'opbd', 'prop', 'trak', 'Zapf', 'Silf', 'Glat', 'Gloc', 'Feat', 'Sill'];

/** The raw `name` table of a .woff2 (W3C WOFF2 §5–6) or a plain .ttf/.otf. */
function nameTable(file: string): Buffer {
  const b = readFileSync(file);
  if (b.toString('latin1', 0, 4) === 'wOF2') {
    const numTables = b.readUInt16BE(12);
    const compressed = b.readUInt32BE(20);
    let p = 48;
    const base128 = () => {
      let v = 0;
      for (let i = 0; i < 5; i++) {
        const byte = b[p++] as number;
        v = v * 128 + (byte & 0x7f);
        if (!(byte & 0x80)) return v;
      }
      throw new Error(`${file}: bad UIntBase128`);
    };
    let offset = 0;
    let found: { offset: number; length: number } | null = null;
    for (let i = 0; i < numTables; i++) {
      const flags = b[p++] as number;
      let tag = WOFF2_KNOWN_TAGS[flags & 0x3f];
      if ((flags & 0x3f) === 63) {
        tag = b.toString('latin1', p, p + 4);
        p += 4;
      }
      const version = flags >> 6;
      const orig = base128();
      const transformed = tag === 'glyf' || tag === 'loca' ? version === 0 : version !== 0;
      const length = transformed ? base128() : orig;
      if (tag === 'name') found = { offset, length };
      offset += length;
    }
    assert.ok(found, `${file} has a name table`);
    const data = brotliDecompressSync(b.subarray(p, p + compressed));
    return data.subarray(found.offset, found.offset + found.length);
  }
  const n = b.readUInt16BE(4);
  for (let i = 0; i < n; i++) {
    const rec = 12 + i * 16;
    if (b.toString('latin1', rec, rec + 4) === 'name') {
      const off = b.readUInt32BE(rec + 8);
      return b.subarray(off, off + b.readUInt32BE(rec + 12));
    }
  }
  throw new Error(`${file} has no name table`);
}

/** The font's own family: typographic family (ID 16), else family (ID 1), Windows Unicode. */
function familyOf(file: string): string {
  const t = nameTable(file);
  const count = t.readUInt16BE(2);
  const strings = t.readUInt16BE(4);
  const ids = new Map<number, string>();
  for (let i = 0; i < count; i++) {
    const r = 6 + i * 12;
    if (t.readUInt16BE(r) !== 3) continue;
    const id = t.readUInt16BE(r + 6);
    const len = t.readUInt16BE(r + 8);
    const off = strings + t.readUInt16BE(r + 10);
    if (ids.has(id)) continue;
    const s = t.subarray(off, off + len);
    ids.set(id, Buffer.from(s).swap16().toString('utf16le'));
  }
  const family = ids.get(16) ?? ids.get(1);
  assert.ok(family, `${file}: no family name`);
  return family;
}

const squash = (s: string) => s.toLowerCase().replace(/[^a-z]/g, '');

function themeBlock(id: string): string {
  const css = readFileSync(join(WEB, 'app', 'globals.css'), 'utf8');
  const blocks = [...css.matchAll(new RegExp(`\\[data-hub-theme='${id}'\\] \\{([^}]*)\\}`, 'g'))].map((m) => m[1] ?? '');
  return stripComments(blocks.find((b) => /--hub-canvas/.test(b)) ?? '');
}

test('⭐ every theme role resolves to its REAL family — read from the font file it loads, not the variable name', () => {
  const decls = declarations();
  const seen = new Set<string>();
  let roles = 0;
  for (const t of HUB_THEMES) {
    if (t.id === 'house') continue; // Classic has no block: it is the page as it renders today.
    const body = themeBlock(t.id);
    assert.ok(body, `${t.id} has a page block`);
    const decl = (name: string) => new RegExp(`(?:^|[\\s;])${name}:\\s*var\\((--[a-z0-9-]+)\\);`).exec(body)?.[1];
    const wanted: Array<[string, string | null]> = [
      ['--font-body', t.fonts.body],
      ['--font-mono', t.fonts.labels],
      ['--font-theme-script', t.fonts.script],
    ];
    for (const [role, family] of wanted) {
      if (!family) continue; // no script: the heading stands in, by design (invite-themes.test.ts)
      const v = decl(role);
      assert.ok(v, `${t.id} ${role} is not wired`);
      const d = decls.get(v);
      assert.ok(d, `${t.id} ${role} → ${v}, which no localFont() declares`);
      assert.ok(d.files.length > 0, `${v} loads no file`);
      for (const f of d.files) {
        assert.equal(squash(familyOf(f)).startsWith(squash(family)), true, `${t.id} ${role} wants ${family} but wears "${familyOf(f)}" (${f.slice(WEB.length + 1)}) — a stand-in`);
      }
      seen.add(family);
      roles += 1;
    }
  }
  // Non-vacuity: the nine blocks were read, and every one of the ten was reached by a theme.
  assert.ok(roles >= 25, `checked ${roles} roles`);
  for (const f of TEN) assert.ok(seen.has(f), `${f} is named by no theme role — nothing proved it is worn`);
});

test('🚫 no stand-in path is left: each of the ten has its own variable, and an unknown family throws', () => {
  assert.equal('THEME_FACE_STAND_INS' in faces, false, 'the stand-in table is back');
  const vars = TEN.map((f) => faces.themeFaceVar(f));
  assert.equal(new Set(vars).size, TEN.length, `two families share one face: ${vars.join(', ')}`);
  for (const v of vars) assert.equal(Object.values(faces.THEME_FACE_VAR).filter((x) => x === v).length, 1, `${v} is worn for two families`);
  assert.throws(() => faces.themeFaceVar('Comic Neue'), /No loaded face/);
});

test('📦 each of the ten loads WOFF2 files that exist, with its OFL licence beside them', () => {
  const decls = declarations();
  for (const family of TEN) {
    const d = decls.get(faces.themeFaceVar(family));
    assert.ok(d, `${family} is not declared`);
    assert.equal(d.at, 'app/_fonts/choice-faces.ts', `${family} must be declared in choice-faces.ts`);
    for (const f of d.files) {
      assert.ok(existsSync(f), `${f} is missing`);
      assert.match(f, /\.woff2$/, `${f} is not a .woff2`);
      assert.equal(readFileSync(f).toString('latin1', 0, 4), 'wOF2', `${f} is not WOFF2 inside`);
      const ofl = join(dirname(f), 'OFL.txt');
      assert.ok(existsSync(ofl), `${family}: no OFL.txt beside ${f}`);
      const text = readFileSync(ofl, 'utf8');
      assert.match(text, /^Copyright/, `${ofl} does not open with its copyright line`);
      assert.match(text, /SIL Open Font License, Version 1\.1/, `${ofl} is not the OFL`);
    }
  }
});

test('📱 none of the ten is preloaded, and none rides layout.tsx', () => {
  const decls = declarations();
  const layout = readFileSync(join(WEB, 'app', 'layout.tsx'), 'utf8');
  for (const family of TEN) {
    const v = faces.themeFaceVar(family);
    const d = decls.get(v);
    assert.ok(d, `${family} is not declared`);
    assert.match(d.body, /\bpreload:\s*false\b/, `${family} (${v}) would download on every page`);
    assert.match(d.body, /display:\s*'swap'/, `${family} (${v}) would block text`);
    assert.ok(!layout.includes(`'${v}'`), `${v} is declared in layout.tsx`);
  }
});

test('🔤 each of the ten is a Font ▾ choice that loads the very face the theme wears', () => {
  for (const family of TEN) {
    const offered = HUB_FONTS.filter((f) => f.family === family);
    assert.equal(offered.length, 1, `${family} is offered exactly once in Look › Font`);
    assert.equal(offered[0]!.cssVar, faces.themeFaceVar(family), `${family}: the dropdown and the theme load different faces`);
    // …it is on the one font dropdown's list (`FontPick` draws `hubFontShelves`),
    // and a saved key survives the sanitizer every reader runs.
    const key = offered[0]!.key;
    assert.equal(hubFontShelves().filter((r) => r.key === key).length, 1, `${family} is on the Font ▾ list once`);
    assert.equal(sanitizeHubFontKey(key), key, `${key} survives sanitizeHubFontKey`);
  }
});
