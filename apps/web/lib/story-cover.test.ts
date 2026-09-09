/**
 * THE COVER — the pairing rule, and the four ways a chosen cover stops being one.
 *
 * `02` §6 · 08 step 1.5. The resolver's job is to hand three public surfaces a
 * picture the host chose — or to step out of the way. **Every way it can be
 * wrong shows a photograph to strangers**, so the refusals get more attention
 * here than the happy path.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import type { SupabaseClient } from '@supabase/supabase-js';

import {
  COVER_KINDS_NEEDING_REF,
  STORY_COVER_KINDS,
  resolveStoryCover,
  sanitizeStoryCover,
} from './story-cover';

/**
 * A stand-in for the admin client. `rows` answers `.maybeSingle()` per table,
 * and `error` is a REFUSAL — which is what a missing grant, an RLS refusal or a
 * phantom column look like from here: no throw, just an absence.
 *
 * ⚠ THE CAST IS THE POINT, NOT A SHORTCUT — the house pattern from
 * `story-edition.test.ts`. Widening the production signature to fit a
 * hand-rolled structural type is what made tsc give up with TS2589.
 */
type Answer = {
  /** What `.maybeSingle()` resolves to. */
  row?: Record<string, unknown> | null;
  /** What awaiting the builder itself resolves to (the list reads). */
  list?: Array<Record<string, unknown>>;
  /** A REFUSAL: `{ data: null, error }`, which never throws. */
  error?: unknown;
};

function client(answers: Record<string, Answer>) {
  const asked: string[] = [];
  const api = {
    from(table: string) {
      asked.push(table);
      const answer = answers[table] ?? {};
      const chain: Record<string, unknown> = {};
      for (const method of ['select', 'eq', 'is', 'in', 'order', 'limit', 'not', 'or']) {
        chain[method] = () => chain;
      }
      chain.maybeSingle = async () => ({
        data: answer.row ?? null,
        error: answer.error ?? null,
      });
      // The builder is itself awaitable for the list reads (`await
      // admin.from(x).select(y).eq(...)`), which is how the consent veto reads.
      chain.then = (resolve: (v: unknown) => unknown) =>
        resolve({ data: answer.list ?? [], error: answer.error ?? null });
      return chain;
    },
  };
  return { client: api as unknown as SupabaseClient, asked };
}

// ── the pairing rule ────────────────────────────────────────────────────────

test('1 · every kind in the closed vocabulary is either pointer-taking or not', () => {
  // DERIVED, not a second list: the rule is stated once, and this asserts the
  // partition is total — a sixth kind added to the vocabulary without a
  // decision about its pointer fails here rather than at a render.
  for (const kind of STORY_COVER_KINDS) {
    const needsRef = COVER_KINDS_NEEDING_REF.has(kind);
    const withRef = sanitizeStoryCover(kind, 'r2://k.jpg');
    const without = sanitizeStoryCover(kind, null);
    if (needsRef) {
      assert.deepEqual(withRef, { kind, ref: 'r2://k.jpg' }, `${kind} rejected a valid pointer`);
      assert.equal(without, null, `${kind} was accepted with no pointer — it cannot be drawn`);
    } else {
      assert.deepEqual(without, { kind, ref: null }, `${kind} needs no pointer but was refused`);
      assert.deepEqual(withRef, { kind, ref: null }, `${kind} kept an orphan pointer`);
    }
  }
});

test('2 · an unknown kind, a blank pointer and a non-string are all "never chosen"', () => {
  assert.equal(sanitizeStoryCover('hero_video', null), null);
  assert.equal(sanitizeStoryCover(null, null), null);
  assert.equal(sanitizeStoryCover(undefined, 'r2://k.jpg'), null);
  assert.equal(sanitizeStoryCover('capture', '   '), null, 'whitespace is not a pointer');
  assert.equal(sanitizeStoryCover('capture', 42), null);
  assert.equal(sanitizeStoryCover(7, 'r2://k.jpg'), null);
});

// ── what the surfaces are handed ────────────────────────────────────────────

test('3 · no cover chosen resolves to null — the surfaces render as they do today', async () => {
  const { client: db, asked } = client({});
  const resolved = await resolveStoryCover(db, 'e1', {
    story_cover_kind: null,
    story_cover_ref: null,
    landing_page_hero_image_url: 'r2://living.jpg',
  });
  assert.equal(resolved, null);
  assert.deepEqual(asked, [], 'a null cover still went to the database');
});

test('4 · the monogram resolves to a null key — it is drawn, not fetched', async () => {
  const { client: db } = client({});
  const resolved = await resolveStoryCover(db, 'e1', {
    story_cover_kind: 'monogram',
    story_cover_ref: null,
  });
  assert.deepEqual(resolved, { kind: 'monogram', key: null });
});

test('5 · the living hero resolves to its column — and to nothing when empty', async () => {
  const { client: db } = client({});
  assert.deepEqual(
    await resolveStoryCover(db, 'e1', {
      story_cover_kind: 'hero',
      story_cover_ref: null,
      landing_page_hero_image_url: 'r2://living.jpg',
    }),
    { kind: 'hero', key: 'r2://living.jpg' },
  );
  assert.equal(
    await resolveStoryCover(db, 'e1', {
      story_cover_kind: 'hero',
      story_cover_ref: null,
      landing_page_hero_image_url: null,
    }),
    null,
    'the host asked for a living hero the event does not have',
  );
});

/**
 * ⚠ THE CAPTURE ARMS ARE THE ONES THAT MATTER. A capture reaches this function
 * only because the host chose it, possibly months ago; everything that could
 * have changed since is one of these arms, and each is checked separately
 * rather than counted against a floor.
 */
test('6 · a capture that no longer qualifies resolves to nothing', async () => {
  // (a) the row is gone, unscreened, or hidden — the query returns no row.
  {
    const { client: db } = client({ papic_photos: { row: null } });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
    );
  }
  // (b) THE READ WAS REFUSED. A rejected query is an ABSENCE, not a throw — a
  //     missing grant resolves as { data: null, error } and never enters a catch.
  {
    const { client: db } = client({
      papic_photos: { row: { photo_id: 'p1', r2_object_key: 'r2://p1.jpg' }, error: { message: 'permission denied' } },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
      'a refused read was treated as a qualifying capture',
    );
  }
  // (c) the row exists but carries no object key at all.
  {
    const { client: db } = client({
      papic_photos: { row: { photo_id: 'p1', r2_object_key: null, photo_type: 'photo' } },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
    );
  }
  // (d) a CLIP with no poster frame. A cover is a still on all three surfaces —
  //     the share card cannot render video at all.
  {
    const { client: db } = client({
      papic_photos: {
        row: { photo_id: 'p1', r2_object_key: 'r2://clip.mp4', poster_r2_key: null, photo_type: 'clip' },
      },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
      'a clip was offered as a cover with no poster frame',
    );
  }
});

/**
 * ⚖ THE CONSENT VETO IS NOT RE-IMPLEMENTED IN THE COVER — it is delegated to
 * `publicKeyForCapture`, the one gate `04` rule 6 names. These two arms prove
 * the delegation is real: change the guests' answer and the cover changes with
 * it, without `story-cover.ts` knowing anything about photo tags.
 */
test('6b · a qualifying capture is the cover; a vetoed one is not', async () => {
  const photo = {
    photo_id: 'p1',
    r2_object_key: 'r2://p1.jpg',
    poster_r2_key: null,
    photo_type: 'photo',
  };

  // Nobody opted out → the capture is the cover.
  {
    const { client: db } = client({ papic_photos: { row: photo }, guests: { list: [] } });
    assert.deepEqual(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      { kind: 'capture', key: 'r2://p1.jpg' },
    );
  }

  // A tagged guest opted out and no blurred stand-in was baked → nothing.
  // Consent beats curation, on the most-shared surface the product has.
  {
    const { client: db } = client({
      papic_photos: { row: photo, list: [] },
      guests: { list: [{ guest_id: 'g1' }] },
      photo_tags: { list: [{ source_id: 'p1' }] },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
      'a capture whose guest opted out was still the cover',
    );
  }

  /*
    ⚖ VETOED **AND A BLURRED STAND-IN EXISTS** → STILL NOTHING. This is the arm
    that discriminates, and the one my first cut got wrong.

    `publicKeyForCapture` implements the 2026-08-17 blur ruling and would hand
    back the stand-in here. That ruling exempts the LEAD image — `data.ts`'s
    hero rung keeps the old drop because "an all-faces-blurred photograph is not
    a thing to open a wedding recap with" — and a cover is a lead image on three
    surfaces at once.

    🔴 WITHOUT THIS ARM THE GUARD WAS DECORATION FOR THE ONLY CASE THAT MATTERS:
    the existing vetoed test seeded NO bake, so it passed whether the code
    dropped or softened. A blurred face would have reached the shelf card and
    the share card while the story's own top refused it.
  */
  {
    const { client: db } = client({
      papic_photos: {
        row: photo,
        list: [{ photo_id: 'p1', safe_display_r2_key: 'r2://p1-blurred.jpg' }],
      },
      guests: { list: [{ guest_id: 'g1' }] },
      photo_tags: { list: [{ source_id: 'p1' }] },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
      'a vetoed capture was published as an all-faces-blurred COVER — the lead ' +
        'image is the one site the 2026-08-17 blur ruling exempts',
    );
  }

  // The veto itself could not be resolved → withhold. A refused veto is not an
  // empty veto.
  {
    const { client: db } = client({
      papic_photos: { row: photo },
      guests: { error: { message: 'permission denied' } },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', { story_cover_kind: 'capture', story_cover_ref: 'p1' }),
      null,
      'an unresolvable veto was treated as nobody objecting',
    );
  }
});

test('7 · a supplier frame stops being a cover when its supplier stops being the pick', async () => {
  const frame = { media_id: 'm1', event_vendor_id: 'v1', still_r2_key: 'r2://frame.jpg' };

  // Still the recommended pick → the frame is the cover.
  {
    const { client: db } = client({
      editorial_vendor_media: { row: frame },
      event_vendors: { row: { vendor_id: 'v1' } },
    });
    assert.deepEqual(
      await resolveStoryCover(db, 'e1', {
        story_cover_kind: 'vendor_frame',
        story_cover_ref: 'm1',
      }),
      { kind: 'vendor_frame', key: 'r2://frame.jpg' },
    );
  }

  // 🔑 SWAPPED OUT — the query filtered on selection_match_rank = 1 returns no
  // row. This is the arm that is easiest to forget and the one that matters
  // most: dropping a supplier drops their media everywhere else, and it has to
  // drop it here too.
  {
    const { client: db } = client({
      editorial_vendor_media: { row: frame },
      event_vendors: { row: null },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', {
        story_cover_kind: 'vendor_frame',
        story_cover_ref: 'm1',
      }),
      null,
      'a dropped supplier’s frame stayed on the share card',
    );
  }

  // A refused vendor read fails the same way, closed.
  {
    const { client: db } = client({
      editorial_vendor_media: { row: frame },
      event_vendors: { row: { vendor_id: 'v1' }, error: { message: 'permission denied' } },
    });
    assert.equal(
      await resolveStoryCover(db, 'e1', {
        story_cover_kind: 'vendor_frame',
        story_cover_ref: 'm1',
      }),
      null,
    );
  }

  // Withdrawn / unscreened / host-hidden → the filtered query returns no row.
  {
    const { client: db } = client({ editorial_vendor_media: { row: null } });
    assert.equal(
      await resolveStoryCover(db, 'e1', {
        story_cover_kind: 'vendor_frame',
        story_cover_ref: 'm1',
      }),
      null,
    );
  }
});

test('8 · an upload is the host’s own file and needs no third party', async () => {
  const { client: db, asked } = client({});
  assert.deepEqual(
    await resolveStoryCover(db, 'e1', {
      story_cover_kind: 'upload',
      story_cover_ref: 'r2://mine.jpg',
    }),
    { kind: 'upload', key: 'r2://mine.jpg' },
  );
  assert.deepEqual(asked, [], 'an upload consulted the database for a permission nobody holds');
});
