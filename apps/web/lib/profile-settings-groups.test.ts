/**
 * The grouped "Profile & settings" page shows one group at a time. Links that
 * already point at it — `?slug_saved=1#url-slug`, `#settings`, `#privacy` —
 * must still open the group holding what they point at, or they land on a
 * page where the thing they promised is hidden.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FLASH_PARAM_GROUP,
  groupFromSearchParams,
  isSettingsGroup,
  SETTINGS_GROUPS,
} from './profile-settings-groups';

const WEB = join(import.meta.dirname, '..');

test('?tab= wins over a flash param', () => {
  assert.deepEqual(groupFromSearchParams({ tab: 'preferences', saved: '1' }), {
    group: 'preferences',
    fromTab: true,
  });
});

test('an unknown ?tab= is ignored, never trusted', () => {
  assert.deepEqual(groupFromSearchParams({ tab: 'javascript:alert(1)' }), {
    group: null,
    fromTab: false,
  });
});

test('each flash param opens the group its message is about', () => {
  const expect: Record<string, string> = {
    slug_saved: 'privacy',
    slug_error: 'privacy',
    public_profile_saved: 'privacy',
    discoverable_saved: 'privacy',
    photo_sharing_saved: 'privacy',
    deletion_requested: 'account',
    deletion_cancelled: 'account',
    tour_restarted: 'account',
    password_changed: 'security',
    signed_out_others: 'security',
    saved: 'profile',
  };
  for (const [param, group] of Object.entries(expect)) {
    assert.equal(groupFromSearchParams({ [param]: '1' }).group, group, param);
  }
  // A specific param beats the generic `saved` on the same URL.
  assert.equal(groupFromSearchParams({ saved: '1', slug_saved: '1' }).group, 'privacy');
  for (const g of Object.values(FLASH_PARAM_GROUP)) assert.ok(isSettingsGroup(g));
});

test('no params → the default (null: Profile on desktop, the list on a phone)', () => {
  assert.equal(groupFromSearchParams({}).group, null);
});

/**
 * The hash half runs in the browser (it finds the element and asks which pane
 * holds it), so it can only be as right as the page's ids. Pin each old anchor
 * to the pane that now holds its content.
 */
test('every old anchor id sits inside the pane that holds its content', () => {
  const src = readFileSync(join(WEB, 'app/dashboard/(account)/profile/page.tsx'), 'utf8');
  const pane = (name: string) => {
    const start = src.indexOf(`const ${name} = (`);
    assert.ok(start >= 0, `${name} is gone from the page`);
    const end = src.indexOf('\n  );\n', start);
    return src.slice(start, end);
  };
  const privacy = pane('privacyPane');
  for (const id of ['url-slug', 'slug', 'privacy']) {
    assert.match(privacy, new RegExp(`id="${id}"`), `#${id} must live in the Privacy pane`);
  }
  const account = pane('accountPane');
  assert.match(account, /id="settings"/, '#settings must live where deletion lives');
  assert.match(account, /requestAccountDeletion/);
  // And every group is handed to the shell.
  for (const g of SETTINGS_GROUPS) {
    assert.match(src, new RegExp(`['"]?${g}['"]?: \\w+Pane`), `group ${g} is not rendered`);
  }
});
