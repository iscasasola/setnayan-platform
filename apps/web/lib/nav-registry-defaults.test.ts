import { test } from 'node:test';
import assert from 'node:assert/strict';

import { NAV_SLOT_DEFAULTS } from './nav-registry-defaults';
import { NAV_ICON_NAMES } from './nav-icons';
import type { NavAccountScope, NavIconKind, NavLabelKind } from './nav-registry-types';

/**
 * Phase-9 drift / integrity guard for the nav/icon/menu registry's in-code
 * defaults (project_setnayan_nav_icon_menu_registry).
 *
 * The original design doc imagined a "seed-vs-DB drift test" against a fully
 * DB-seeded nav_slot table. The AS-BUILT architecture instead keeps the
 * canonical slot list in CODE (NAV_SLOT_DEFAULTS) and only stores the slots an
 * admin CHANGED in a sparse DB table (nav_slot_override). So the meaningful
 * drift surface is no longer "code seed vs DB seed" — it's:
 *   1. the in-code defaults staying internally consistent (this file), and
 *   2. no admin override referencing a slot_key that no longer exists in the
 *      defaults (a DB check — see the note at the bottom; not run in CI because
 *      it needs a live connection, but documented + scripted there).
 *
 * This static test runs under the already-required `pnpm test:unit` step
 * (tsx node:test over the lib test files), so it blocks a merge that corrupts
 * the defaults WITHOUT a flaky DB-connected CI job. It would have caught a
 * mistyped icon, a duplicate key, a lucide name missing from the curated
 * allowlist, or an iconKind/lucideName mismatch.
 */

const SCOPES = new Set<NavAccountScope>(['customer', 'vendor', 'admin', 'public', 'shared']);
const ICON_KINDS = new Set<NavIconKind>(['lucide', 'custom', 'none']);
const LABEL_KINDS = new Set<NavLabelKind>(['literal', 'i18nKey']);

// Inline custom marks the icon resolver actually knows (CUSTOM_INLINE in
// app/_components/nav/nav-icon-component.tsx). A custom slot whose customRef is
// not here (and has no admin-uploaded customUrl) renders nothing — keep in sync
// if a new inline mark is added.
const KNOWN_CUSTOM_REFS = new Set<string>(['SetnayanMark']);

const ALLOWED_ICON_NAMES = new Set<string>(NAV_ICON_NAMES);

test('NAV_SLOT_DEFAULTS is non-empty', () => {
  assert.ok(NAV_SLOT_DEFAULTS.length > 0, 'expected at least one default slot');
});

test('every slot key is unique', () => {
  const seen = new Map<string, number>();
  for (const s of NAV_SLOT_DEFAULTS) seen.set(s.key, (seen.get(s.key) ?? 0) + 1);
  const dups = [...seen.entries()].filter(([, n]) => n > 1).map(([k]) => k);
  assert.deepEqual(dups, [], `duplicate slot keys: ${dups.join(', ')}`);
});

test('every slot has a valid scope / iconKind / labelKind enum', () => {
  for (const s of NAV_SLOT_DEFAULTS) {
    assert.ok(SCOPES.has(s.scope), `${s.key}: invalid scope "${s.scope}"`);
    assert.ok(ICON_KINDS.has(s.iconKind), `${s.key}: invalid iconKind "${s.iconKind}"`);
    assert.ok(LABEL_KINDS.has(s.labelKind), `${s.key}: invalid labelKind "${s.labelKind}"`);
  }
});

test('every slot key is dot-namespaced and its prefix matches the scope field', () => {
  for (const s of NAV_SLOT_DEFAULTS) {
    assert.match(
      s.key,
      /^(customer|vendor|admin|public|shared)\.[a-z0-9-]+\.[a-z0-9-]+$/,
      `${s.key}: key must be <scope>.<area>.<kebab-name>`,
    );
    assert.equal(
      s.key.split('.')[0],
      s.scope,
      `${s.key}: key prefix does not match scope "${s.scope}"`,
    );
    assert.ok(s.area.length > 0, `${s.key}: empty area`);
  }
});

test('every slot has a non-empty label and numeric sortOrder', () => {
  for (const s of NAV_SLOT_DEFAULTS) {
    assert.equal(typeof s.label, 'string');
    assert.ok(s.label.trim().length > 0, `${s.key}: empty label`);
    assert.equal(typeof s.sortOrder, 'number', `${s.key}: sortOrder not a number`);
    assert.ok(Number.isFinite(s.sortOrder) && s.sortOrder >= 0, `${s.key}: bad sortOrder ${s.sortOrder}`);
  }
});

test('iconKind and the icon fields are mutually consistent', () => {
  for (const s of NAV_SLOT_DEFAULTS) {
    if (s.iconKind === 'lucide') {
      assert.ok(s.lucideName, `${s.key}: iconKind=lucide but lucideName is null`);
      assert.equal(s.customRef, null, `${s.key}: iconKind=lucide but customRef is set`);
    } else if (s.iconKind === 'custom') {
      assert.ok(s.customRef, `${s.key}: iconKind=custom but customRef is null`);
      assert.equal(s.lucideName, null, `${s.key}: iconKind=custom but lucideName is set`);
    } else {
      // 'none'
      assert.equal(s.lucideName, null, `${s.key}: iconKind=none but lucideName is set`);
      assert.equal(s.customRef, null, `${s.key}: iconKind=none but customRef is set`);
    }
  }
});

test('every lucide icon name resolves against the curated allowlist', () => {
  const missing = NAV_SLOT_DEFAULTS.filter(
    (s) => s.iconKind === 'lucide' && s.lucideName && !ALLOWED_ICON_NAMES.has(s.lucideName),
  ).map((s) => `${s.key} → ${s.lucideName}`);
  assert.deepEqual(
    missing,
    [],
    `lucide names not in nav-icons.ts allowlist (DynamicIcon would fall back to Circle): ${missing.join(', ')}`,
  );
});

test('every custom icon ref is one the resolver knows', () => {
  const unknown = NAV_SLOT_DEFAULTS.filter(
    (s) => s.iconKind === 'custom' && s.customRef && !KNOWN_CUSTOM_REFS.has(s.customRef),
  ).map((s) => `${s.key} → ${s.customRef}`);
  assert.deepEqual(
    unknown,
    [],
    `custom refs not in nav-icon-component.tsx CUSTOM_INLINE (would render nothing): ${unknown.join(', ')}`,
  );
});

// ───────────────────────────────────────────────────────────────────────────
// DB-side consistency (NOT a CI test — needs a live connection; documented here
// so the resolver-vs-overrides invariant isn't forgotten):
//
//   An admin override (nav_slot_override row) must reference a slot_key that
//   still exists in NAV_SLOT_DEFAULTS. The resolver maps over the defaults, so
//   an override for a deleted key is silently IGNORED — not a runtime bug, but
//   the admin's saved rename/hide quietly does nothing. Before deleting any
//   default row, check for dependent overrides (as done for #1581's
//   public.vendor-nav.* removal, which found 0):
//
//     supabase db query \
//       "SELECT slot_key FROM nav_slot_override" --db-url "$SUPABASE_DB_URL"
//
//   then confirm every returned slot_key is present in NAV_SLOT_DEFAULTS.
