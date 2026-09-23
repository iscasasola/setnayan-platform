import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { stripComments } from './strip-comments';
import {
  resolveCelebrationIdentity,
  type CelebrationIdentityInput,
} from './celebration-card-identity';

/*
  A CELEBRATION CARD WEARS THE CELEBRATION.

  Owner, on his own public profile: "the event cards look non events". The cause
  was measured, not guessed — his three events carry no hero image, so every card
  fell to the monogram, and every `monogram_color` is the same default. Three
  celebrations, three identical discs, while two of them had a real accent and a
  named theme the page never read.

  The cases below are HIS THREE EVENTS, with the values read out of production,
  because a fixture invented to suit the code proves only that the code suits
  itself.
*/

const INDALECIO: CelebrationIdentityInput = {
  landing_page_hero_image_url: null,
  std_theme: 'botanical',
};
const MARIA: CelebrationIdentityInput = {
  landing_page_hero_image_url: null,
  std_theme: 'default',
};
const MOVIE_NIGHT: CelebrationIdentityInput = {
  landing_page_hero_image_url: null,
  std_theme: null,
};

test('his three celebrations stop looking alike', () => {
  const a = resolveCelebrationIdentity(INDALECIO);
  const b = resolveCelebrationIdentity(MARIA);
  const c = resolveCelebrationIdentity(MOVIE_NIGHT);
  console.log(`  Indalecio ${a.fontCls} · Maria ${b.fontCls} · Movie Night ${c.fontCls}`);

  /*
    🔑 THE ASSERTION THAT EARNS THE COLUMN. `eventCardTreatment()` gives these
    two weddings hues 204 and 214 — ten degrees apart, both reading blue side by
    side — and they are the two that must be told apart. The typeface is what
    distinguishes them, so it must genuinely differ.
  */
  assert.notEqual(a.fontCls, b.fontCls, 'two different weddings, one typeface');
  assert.equal(a.themeId, 'botanical');
  assert.equal(b.themeId, 'default');
  // Movie Night has no theme: it falls to the default and says so.
  assert.equal(c.themeId, 'default');
  assert.equal(c.hasOwnIdentity, false, 'a default is not a choice');
  for (const e of [INDALECIO, MARIA]) {
    assert.equal(resolveCelebrationIdentity(e).hasOwnIdentity, true);
  }
});

test('a hero image outranks everything and marks the event as having identity', () => {
  const withHero = resolveCelebrationIdentity({
    landing_page_hero_image_url: '  https://cdn.example/x.jpg  ',
    std_theme: null,
  });
  assert.equal(withHero.heroUrl, 'https://cdn.example/x.jpg', 'trimmed');
  assert.equal(withHero.hasOwnIdentity, true);
  // …and whitespace-only is not a hero.
  assert.equal(resolveCelebrationIdentity({ landing_page_hero_image_url: '   ' }).heroUrl, null);
});

test('an unknown theme falls back to a real typeface, never to nothing', () => {
  for (const t of ['nonsense', '', null, undefined, '  ']) {
    const r = resolveCelebrationIdentity({ std_theme: t as string | null });
    assert.ok(r.fontCls.startsWith('font-'), `no font class for ${JSON.stringify(t)}`);
    assert.equal(r.themeId, 'default');
  }
  // blank-ish strings are not a choice
  assert.equal(resolveCelebrationIdentity({ std_theme: '  ' }).hasOwnIdentity, false);
});

/* ─────────── the boundary that matters: a PUBLIC page ─────────── */

test('🔒 NO PRIVATE COLUMN reaches the public profile select', () => {
  /*
    ⛔ `EVENT_FIELDS` feeds a PUBLIC page through an admin client. Each of these
    is `anon=-` in supabase/security/exposure-surface.baseline.txt — not
    publicly readable — and two of them (`invite_theme` = 'capiz',
    `moodboard_theme_name` = 'Cale-Ice') would have looked good on the card.
    "It renders nicely" is not a reason to publish a private field.
  */
  const src = stripComments(
    readFileSync(path.join(process.cwd(), 'lib/public-profile.ts'), 'utf8'),
  );
  const start = src.indexOf('const EVENT_FIELDS');
  assert.ok(start >= 0, 'EVENT_FIELDS moved — re-point this guard');
  const fields = src.slice(start, src.indexOf(';', start));

  /*
    ⚠ `invite_theme` LEFT THIS LIST ON 2026-09-23, AND THE REASON IS THE RULE.
    It is `anon=-`, exactly like `moodboard_theme_name` — the marker that got
    that one refused. But `invite_theme` is ALREADY rendered on the couple's own
    public site (`app/[slug]/_lib/hub-look.ts`, plus the public recap and pabuya
    pages), so a visitor can already see it by opening the celebration. The
    grant governs direct PostgREST reads, not secrecy.

    🔑 SAME MARKER, OPPOSITE ANSWERS. `moodboard_theme_name` is `anon=-` AND
    rendered nowhere public — it stays banned. The test below is what decides:
    not "is it granted", but "can a visitor already see it".
  */
  const privateCols = ['moodboard_theme_name', 'story_cover_kind', 'story_cover_ref', 'role_palette'];
  /*
    ⚠ `std_film_accent_hex` CAME BACK ON 2026-09-23 AND THAT IS NOT A DRIFT.
    It was dropped when the cover art carried the colour — an accent edge was a
    second answer to a settled question. Then the owner approved the poster
    design, where the accent IS the sheet: wine #9a244f and gold #9b7e00 are the
    posters. A column that stopped paying for itself started again when the
    design changed, and the guard caught the reversal, which is the point.

    `site_bg_color` and `site_button_color` never came back — still unused.
  */
  const droppedCols = ['site_bg_color', 'site_button_color'];
  const leaked = privateCols.filter((c) => fields.includes(c));
  console.log(`  private columns in the public select: ${leaked.length} — ${JSON.stringify(leaked)}`);
  assert.deepEqual(leaked, [], 'a non-anon-readable column is on a public read');

  assert.ok(fields.includes('std_theme'), "the card's typeface column is missing");

  /*
    And the allowed-because-already-public one must STAY justified: if
    `invite_theme` ever stops being read by a public surface, it stops being
    public information and this select is no longer entitled to it.
  */
  if (fields.includes('invite_theme')) {
    const hubLook = readFileSync(path.join(process.cwd(), 'app/[slug]/_lib/hub-look.ts'), 'utf8');
    assert.ok(
      hubLook.includes('invite_theme'),
      'invite_theme is on a public read here but no longer rendered on the public event site — ' +
        'the justification for exposing it has gone',
    );
  }
  const stillThere = droppedCols.filter((c) => fields.includes(c));
  console.log(`  columns dropped as not paying: ${droppedCols.length - stillThere.length}/${droppedCols.length}`);
  assert.deepEqual(stillThere, [], 'a column the cover made redundant is back on a public read');
  // the detector can fail
  assert.ok(['a', 'invite_theme'].filter((c) => 'x invite_theme y'.includes(c)).length > 0);
});

test('the card calls the resolver and no longer draws a chevron', () => {
  const page = stripComments(
    readFileSync(path.join(process.cwd(), 'app/u/[userSlug]/page.tsx'), 'utf8'),
  );
  assert.ok(page.includes('resolveCelebrationIdentity(event)'), 'the card must ask for the identity');
  const chev = (page.match(/uprof-chev/g) ?? []).length;
  console.log(`  uprof-chev occurrences left in the page: ${chev}`);
  assert.equal(chev, 0, 'the list-row chevron is back');
  assert.ok(!page.includes('rsaquo'), 'a raw › is still being drawn');
});

test('🪤 the inlined CSS carries no backtick — it is a template literal', () => {
  /*
    THE TEST RUNNER STRUCTURALLY CANNOT SEE THIS. `UPROF_CSS` is a template
    literal holding ~430 lines of CSS; a single backtick in a comment inside it
    ENDS THE STRING and the file stops parsing. `tsx --test` strips types and
    never compiles the page, and the guard above reads it as TEXT — so every
    assertion stayed green while the page was un-compilable. Only `tsc` caught
    it, and I then broke it a SECOND time writing the warning about it.

    Cheap to check, invisible to everything else, so it lives here.
  */
  const src = readFileSync(path.join(process.cwd(), 'app/u/[userSlug]/page.tsx'), 'utf8');
  const open = src.indexOf('const UPROF_CSS');
  assert.ok(open >= 0, 'UPROF_CSS moved — re-point this guard');
  const bodyStart = src.indexOf('`', open) + 1;
  const bodyEnd = src.indexOf('\n`;', bodyStart);
  assert.ok(bodyEnd > bodyStart, 'could not find the end of the template literal');
  const css = src.slice(bodyStart, bodyEnd);
  const ticks = (css.match(/`/g) ?? []).length;
  const interps = (css.match(/\$\{/g) ?? []).length;
  console.log(`  UPROF_CSS: ${css.length} chars · backticks ${ticks} · \${} ${interps}`);
  assert.equal(ticks, 0, 'a backtick inside the CSS template ends the string');
  assert.equal(interps, 0, 'an interpolation in the CSS template is almost certainly a typo');
  // the detector can fail
  assert.equal(('a `b` c'.match(/`/g) ?? []).length, 2);
});

test('⚖ two consents about one photo stay two', () => {
  /*
    The public page shows the photo because the owner ruled that turning the
    public profile ON *is* the consent (2026-09-23). `share_profile_photo_with_hosts`
    is a DIFFERENT consent with a NARROWER audience — "the couple running an
    event you have joined" — which is opt-in and defaults to OFF (2026-09-20).

    🔑 The failure this prevents is one column doing two jobs: if the public
    path ever reads or writes the hosts flag, the narrower consent silently
    starts meaning something wider than the person agreed to.
  */
  const pub = stripComments(
    readFileSync(path.join(process.cwd(), 'lib/public-profile.ts'), 'utf8'),
  );
  const hostsFlag = (pub.match(/share_profile_photo_with_hosts/g) ?? []).length;
  console.log(`  hosts-consent references in the public path (code, comments stripped): ${hostsFlag}`);
  assert.equal(hostsFlag, 0, 'the public profile path must not touch the hosts consent');
  assert.ok(pub.includes('profile_photo_url'), 'the photo column must be selected');

  /*
    And the switch has to SAY what it publishes, because it is now the consent
    itself rather than a setting that happens to be public.
  */
  const toggle = stripComments(
    readFileSync(path.join(process.cwd(), 'app/dashboard/(account)/profile/page.tsx'), 'utf8'),
  );
  /*
    🪤 ANCHORED ON `help={`, NOT ON THE FIRST `/u/${currentSlug`. The first
    match in that file is `publicProfileUrl` on an unrelated line, so slicing
    from it measured the wrong string and this assertion failed against correct
    code. A guard anchored on the first match faces the wrong cell.
  */
  const at = toggle.indexOf('help={`${publicHost}/u/');
  assert.ok(at >= 0, 'the public-profile toggle help text moved — re-point this guard');
  const line = toggle.slice(at, toggle.indexOf('`}', at));
  console.log(`  toggle help: ${line.slice(line.indexOf('·')).slice(0, 72)}…`);
  assert.match(line, /profile photo/i, 'the public-profile toggle does not mention the photo');
  assert.match(line, /celebrations/i, 'it must still say what it always said');
});
