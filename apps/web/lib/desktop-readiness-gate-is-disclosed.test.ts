/**
 * desktop-readiness-gate-is-disclosed.test.ts
 *
 * S10's readiness gate — "Works on an Apple-silicon Mac on macOS 14 or later
 * with the Safari 26 update, or Windows 10/11 with hardware video encoding.
 * Older machines: use OBS instead." — has to say the same thing everywhere it
 * appears, and it has to actually APPEAR everywhere someone deciding whether to
 * download or wire up the encoder would look: `/download` (before the click)
 * and the `encoderNotice`/readiness surface (`BroadcastReadiness`, after
 * purchase — see its docblock and `live-studio-readiness.ts` for why this is a
 * SEPARATE fact from `ENCODER_NOTICE`/`ENCODER_BUY_NOTICE`, which the sibling
 * `the-laptop-requirement-is-disclosed.test.ts` already pins).
 *
 * A constant nobody renders is not a disclosure, so — same pattern as that
 * sibling test — this reads the SOURCE of both consumer files rather than
 * trusting the import list.
 *
 * Run from apps/web:
 *   npx tsx --test lib/desktop-readiness-gate-is-disclosed.test.ts
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { stripComments } from './strip-comments';
import { DESKTOP_ENCODER_READINESS_NOTICE } from './live-studio-readiness';

const HERE = dirname(fileURLToPath(import.meta.url));
const src = (p: string) => stripComments(readFileSync(resolve(HERE, '..', p), 'utf8'));

const DOWNLOAD_PAGE = 'app/download/page.tsx';
const READINESS_SURFACE = 'app/_components/live-studio/broadcast-readiness.tsx';

test('⭐ the sentence itself names both floors and the fallback', () => {
  assert.match(DESKTOP_ENCODER_READINESS_NOTICE, /macOS 14/, 'must name the macOS floor');
  assert.match(DESKTOP_ENCODER_READINESS_NOTICE, /Safari 26/, 'must name the WebKit floor S0 measured');
  assert.match(DESKTOP_ENCODER_READINESS_NOTICE, /Windows 10\/11/, 'must name the Windows floor');
  assert.match(DESKTOP_ENCODER_READINESS_NOTICE, /OBS/, 'must name the fallback for machines below the floor');
});

test('⭐ /download renders the readiness gate, verbatim, before the download buttons', () => {
  const page = src(DOWNLOAD_PAGE);
  assert.match(
    page,
    /\{DESKTOP_ENCODER_READINESS_NOTICE\}/,
    '/download no longer renders the readiness gate constant',
  );
  const noticeIdx = page.indexOf('{DESKTOP_ENCODER_READINESS_NOTICE}');
  const macButtonIdx = page.indexOf('/api/download/mac');
  assert.ok(noticeIdx > -1 && macButtonIdx > -1);
  assert.ok(noticeIdx < macButtonIdx, 'the readiness gate must lead the download buttons, not trail them');
});

test('⭐ /download also links both platforms — the download page this replaces had no Windows link', () => {
  const page = src(DOWNLOAD_PAGE);
  assert.match(page, /\/api\/download\/mac/, 'macOS download link missing');
  assert.match(page, /\/api\/download\/windows/, 'Windows download link missing — this is the S10 defect');
});

test('🔒 the readiness surface (BroadcastReadiness) mirrors the same sentence', () => {
  const surface = src(READINESS_SURFACE);
  assert.match(
    surface,
    /\{DESKTOP_ENCODER_READINESS_NOTICE\}/,
    'BroadcastReadiness no longer renders the desktop readiness gate — the mirror broke',
  );
});
