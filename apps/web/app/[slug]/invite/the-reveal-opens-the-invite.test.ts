/**
 * the-reveal-opens-the-invite.test.ts — one reveal, two doors.
 *
 * Owner, 2026-09-10: *"background will use the reveal background photo. So our
 * cinematic reveal is also integrated as one whole concept design."* A Pro
 * invite theme opens with the couple's cinematic reveal, on the invite link's
 * first door — the same reveal the Event Hub opens with.
 *
 * The claims, each one a guest would feel if it broke:
 *   · the reveal is COMPOSED ONCE — the site and the invite cannot open with a
 *     different seal, colour or template;
 *   · House, the free door, never opens with one ("nothing to edit");
 *   · the couple's own opening — "No Reveal" included — wins over the theme's
 *     default;
 *   · a theme's default is always one of the five SHIPPED mechanics;
 *   · it plays WHEN the Event Hub's reveal plays and never otherwise — the
 *     save-the-date and invitation stages only, never the day itself (a veil
 *     between a guest and their table is a toll gate) and never for a wake.
 *     Asked of real profiles at fixed moments, and compared against the Event
 *     Hub's own plan, so the two doors cannot disagree.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from '@/lib/strip-comments';
import { INVITE_THEME_IDS, INVITE_THEMES } from '@/lib/invite-themes';
import { REVEAL_ALIASES, NO_REVEAL } from '@/app/[slug]/_components/reveal/reveal-templates';
import { inviteRevealPlays } from '@/lib/invite-reveal';
import { resolveSiteBodyPlan } from '@/lib/site-body-plan';
import { getLifecyclePhase, type LifecyclePhase } from '@/lib/invitation-widgets';
import { resolveWeddingOnlyParts } from '@/lib/wedding-only-parts';
import { GENERIC_PROFILE, WAKE_PROFILE, WEDDING_PROFILE } from '@/lib/event-type-profile';
import { solemnAdjustedPhase } from '@/app/[slug]/_lib/event-words';

const HERE = dirname(fileURLToPath(import.meta.url));
const APP = join(HERE, '..', '..');
const read = (rel: string) => stripComments(readFileSync(join(APP, rel), 'utf8'));

const HELPERS = [
  'revealMonogram',
  'revealWaxColor',
  'revealVeilColor',
  'revealMarkSvg',
  'revealSealConfig',
  'coerceRevealTemplate',
] as const;

function tsx(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === '.next') continue;
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) tsx(full, out);
    else if (/\.tsx?$/.test(entry) && !entry.includes('.test.')) out.push(full);
  }
  return out;
}

test('the reveal’s props are composed in exactly one place', () => {
  const files = tsx(APP);
  for (const name of HELPERS) {
    const homes = files.filter((f) =>
      new RegExp(`function ${name}\\(`).test(stripComments(readFileSync(f, 'utf8'))),
    );
    assert.deepEqual(
      homes.map((f) => relative(APP, f)),
      ['[slug]/_lib/reveal-props.ts'],
      `${name} is defined somewhere other than _lib/reveal-props.ts — two copies of one rule drift apart`,
    );
  }
});

test('both doors take their reveal from that one place', () => {
  for (const rel of ['[slug]/_components/site-body.tsx', '[slug]/invite/page.tsx']) {
    const src = read(rel);
    assert.match(src, /from '\.\.\/_lib\/reveal-props'/, `${rel} no longer composes the reveal from _lib/reveal-props`);
    assert.match(src, /<RevealOverlayServer/, `${rel} no longer mounts the reveal`);
  }
});

test('House never opens with a reveal; a Pro theme does, and the couple’s own opening wins', () => {
  const src = read('[slug]/invite/page.tsx');
  assert.match(
    src,
    /look\.theme === 'house' \? null : \(\s*<RevealOverlayServer/,
    'the invite door mounts the reveal for House — the free door has no opening',
  );
  assert.match(
    src,
    /eventTemplate=\{coerceRevealTemplate\(event\.std_reveal_template\) \?\? INVITE_THEMES\[look\.theme\]\.opening\}/,
    'the theme’s default is overriding the opening the couple chose',
  );
});

test('every theme’s default opening is one of the five shipped mechanics — never a sixth', () => {
  const shipped = new Set<string>([...Object.values(REVEAL_ALIASES), NO_REVEAL]);
  assert.ok(shipped.size >= 5, 'the shipped reveal set scanned nearly empty — the check is blind');
  for (const id of INVITE_THEME_IDS) {
    assert.ok(
      shipped.has(INVITE_THEMES[id].opening),
      `${id} opens with "${INVITE_THEMES[id].opening}", which is not a shipped reveal`,
    );
  }
  assert.equal(INVITE_THEMES.house.opening, NO_REVEAL, 'House must open with nothing');
});

test('door 01 asks the Event Hub’s rule whether the reveal may play — never a bare `enabled`', () => {
  const src = read('[slug]/invite/page.tsx');
  assert.match(
    src,
    /const revealPlays =\s*look\.theme !== 'house' &&\s*inviteRevealPlays\(/,
    'door 01 no longer asks inviteRevealPlays — the day-of and wake exclusions are gone',
  );
  assert.match(
    src,
    /<RevealOverlayServer\s+enabled=\{revealPlays\}/,
    'door 01 mounts the reveal switched on unconditionally',
  );
});

// Fixed moments (Manila), each checked for the stage it lands in before use.
const MNL = 'Asia/Manila';
const at = (iso: string) => new Date(iso).getTime();
const MOMENTS: ReadonlyArray<{ stage: LifecyclePhase; eventDate: string; nowMs: number }> = [
  { stage: 'save_the_date', eventDate: '2026-12-18', nowMs: at('2026-06-01T12:00:00+08:00') },
  { stage: 'rsvp', eventDate: '2026-12-18', nowMs: at('2026-11-01T12:00:00+08:00') },
  { stage: 'event', eventDate: '2026-08-20', nowMs: at('2026-08-20T22:00:00+08:00') },
  { stage: 'editorial', eventDate: '2026-08-20', nowMs: at('2026-09-10T12:00:00+08:00') },
];
const REVEAL_STAGES: ReadonlySet<LifecyclePhase> = new Set(['save_the_date', 'rsvp']);

test('the fixtures land in the stage they claim — otherwise every assertion below is about nothing', () => {
  assert.equal(MOMENTS.length, 4);
  for (const m of MOMENTS) {
    assert.equal(getLifecyclePhase(m.eventDate, MNL, null, m.nowMs), m.stage, `fixture for ${m.stage}`);
  }
});

test('a wedding’s invite opens with the reveal on the save-the-date and the invitation — not the day, not the story', () => {
  for (const m of MOMENTS) {
    assert.equal(
      inviteRevealPlays({ profile: WEDDING_PROFILE, eventDate: m.eventDate, eventEndDate: null, venueTz: MNL, nowMs: m.nowMs }),
      REVEAL_STAGES.has(m.stage),
      `wedding invite in ${m.stage}`,
    );
  }
});

test('a wake — and any type without the Save-the-Date film — never gets a veil on its invite', () => {
  assert.equal(resolveWeddingOnlyParts(WAKE_PROFILE).save_the_date_film, false, 'the wake profile gained the film');
  assert.equal(resolveWeddingOnlyParts(GENERIC_PROFILE).save_the_date_film, false, 'the generic profile gained the film');
  for (const profile of [WAKE_PROFILE, GENERIC_PROFILE]) {
    for (const m of MOMENTS) {
      assert.equal(
        inviteRevealPlays({ profile, eventDate: m.eventDate, eventEndDate: null, venueTz: MNL, nowMs: m.nowMs }),
        false,
        `${profile.eventType} invite in ${m.stage}`,
      );
    }
  }
});

test('the invite door and the Event Hub agree, for every profile at every stage', () => {
  for (const profile of [WEDDING_PROFILE, WAKE_PROFILE, GENERIC_PROFILE]) {
    for (const m of MOMENTS) {
      const hub = resolveSiteBodyPlan({
        identity: 'anonymous',
        phasesEnabled: true,
        lifecyclePhase: solemnAdjustedPhase(
          getLifecyclePhase(m.eventDate, MNL, null, m.nowMs),
          profile.terminology.register === 'solemn',
        ),
        stdFilm: true,
        isSample: false,
        hasHeroMedia: false,
        hasBgMusic: false,
        liveMediaPublic: false,
        widgets: [],
        weddingOnlyParts: resolveWeddingOnlyParts(profile),
      }).revealEnabled;
      const invite = inviteRevealPlays({ profile, eventDate: m.eventDate, eventEndDate: null, venueTz: MNL, nowMs: m.nowMs });
      assert.equal(invite, hub, `${profile.eventType} in ${m.stage}: the invite says ${invite}, the Event Hub says ${hub}`);
    }
  }
});
