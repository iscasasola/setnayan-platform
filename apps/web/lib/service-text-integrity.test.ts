/**
 * findVendorTextViolation() / autoName() - the flag-gated wrapper that puts the
 * SHIPPED contact filter, in its CARD profile, on the vendor card/package save
 * paths. Locks three contracts:
 *   1. with the flag OFF the save path is byte-identical to before this module
 *      existed;
 *   2. with it ON, off-platform contact info is refused, naming the field;
 *   3. a BLANK IS NEVER A VIOLATION (owner 2026-07-27 - "saving builds blank
 *      will make us autocreate a name for the build"). Blanks are skipped here
 *      and named by `autoName` at the save path.
 *
 * The detector's own rule matrix (every phone disguise, every blocklist entry)
 * is covered by chat-contact-filter.test.ts, and the card profile's four
 * relaxations by chat-contact-filter.profiles.test.ts - deliberately NOT
 * re-tested here. The fixtures borrowed from those suites exist only to prove
 * this module really delegates, and really asks for the 'card' profile.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  autoName,
  findVendorTextViolation,
  serviceTextIntegrityEnabled,
  SERVICE_TEXT_BLOCK_MESSAGE,
} from './service-text-integrity';

const FLAG = 'NEXT_PUBLIC_SERVICE_TEXT_INTEGRITY_ENABLED';

/** Run `fn` with the flag forced on, restoring the ambient value afterwards. */
function withFlagOn<T>(fn: () => T): T {
  const prev = process.env[FLAG];
  process.env[FLAG] = 'true';
  try {
    return fn();
  } finally {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  }
}

/** Run `fn` with the flag unset - the shipped default. */
function withFlagOff<T>(fn: () => T): T {
  const prev = process.env[FLAG];
  delete process.env[FLAG];
  try {
    return fn();
  } finally {
    if (prev !== undefined) process.env[FLAG] = prev;
  }
}

// -- The flag gate: OFF is the default and changes nothing --------------------

test('the flag is OFF unless the value is exactly true / 1 / TRUE', () => {
  const prev = process.env[FLAG];
  try {
    for (const on of ['true', '1', 'TRUE']) {
      process.env[FLAG] = on;
      assert.equal(serviceTextIntegrityEnabled(), true);
    }
    for (const off of ['false', 'True', 'yes', '0', '']) {
      process.env[FLAG] = off;
      assert.equal(serviceTextIntegrityEnabled(), false);
    }
    delete process.env[FLAG];
    assert.equal(serviceTextIntegrityEnabled(), false);
  } finally {
    if (prev === undefined) delete process.env[FLAG];
    else process.env[FLAG] = prev;
  }
});

test('flag OFF: dirty text passes through untouched', () => {
  withFlagOff(() => {
    assert.equal(
      findVendorTextViolation([
        { field: 'Title', value: 'Call me 09178807163' },
        { field: 'Inclusion 1', value: '   ' },
        { field: 'Inclusion 2', value: 'add me on viber' },
      ]),
      null,
    );
  });
});

// -- Flag ON ------------------------------------------------------------------

test('flag ON: a blank field is NOT a violation - it is auto-named at the save path', () => {
  withFlagOn(() => {
    // Owner 2026-07-27: a blank must never refuse a save.
    assert.equal(findVendorTextViolation([{ field: 'Inclusion 2', value: '  ' }]), null);
    // null / undefined count as blank too - the form may not submit the key.
    assert.equal(findVendorTextViolation([{ field: 'Package name', value: null }]), null);
    assert.equal(findVendorTextViolation([{ field: 'Item 1', value: undefined }]), null);
    assert.equal(findVendorTextViolation([{ field: 'Option 1', value: '' }]), null);
  });
});

test('flag ON: a PH phone number in a value is refused', () => {
  withFlagOn(() => {
    assert.equal(
      findVendorTextViolation([
        { field: 'Setnayan Exclusive', value: 'Free album - text 0917 880 7163' },
      ]),
      `Setnayan Exclusive: ${SERVICE_TEXT_BLOCK_MESSAGE}`,
    );
  });
});

test('flag ON: delegates to the shipped detector (obfuscated email fixture)', () => {
  withFlagOn(() => {
    // Fixture copied verbatim from chat-contact-filter.test.ts ("email is
    // blocked"). It only trips if this module really calls evaluateMessage -
    // nothing here knows what "(at)" means.
    assert.equal(
      findVendorTextViolation([{ field: 'Item 1', value: 'juan (at) gmail (dot) com' }]),
      `Item 1: ${SERVICE_TEXT_BLOCK_MESSAGE}`,
    );
  });
});

test("flag ON: asks for the 'card' profile, not the chat rules", () => {
  withFlagOn(() => {
    // Each fixture is blocked under the chat profile (proved in
    // chat-contact-filter.profiles.test.ts) and is honest card copy. If this
    // module ever drops the 'card' argument, every one of these starts
    // refusing a save the owner wants to succeed.
    for (const value of [
      'Instagram teaser reel',
      'TikTok highlights package',
      'FB live streaming add-on',
      'Insta-ready photo booth',
      'Patiktok — 250 TikTok recordings',
      'Php 9,000 per hour, minimum 4 hours, 150 pax, 20 staff',
      'Valid 2026-09-17 - 2026-12-31',
      'Message me on Setnayan for the full menu',
    ]) {
      assert.equal(
        findVendorTextViolation([{ field: 'Inclusion 1', value }]),
        null,
        `card text was refused: ${JSON.stringify(value)}`,
      );
    }
  });
});

test('flag ON: real contact info is still refused on a card', () => {
  withFlagOn(() => {
    for (const value of [
      '0917 880 7163',
      '(0917) 880 7163',
      '+63 917 880 7163',
      'hi@studio.com',
      'facebook.com/ourstudio',
      'message me on viber',
    ]) {
      assert.equal(
        findVendorTextViolation([{ field: 'Inclusion 1', value }]),
        `Inclusion 1: ${SERVICE_TEXT_BLOCK_MESSAGE}`,
        `card text slipped through: ${JSON.stringify(value)}`,
      );
    }
  });
});

test('flag ON: clean fields pass', () => {
  withFlagOn(() => {
    assert.equal(
      findVendorTextViolation([
        { field: 'Title', value: 'Full-day wedding coverage' },
        { field: 'Inclusion 1', value: '2 photographers for 8 hours' },
        { field: 'Inclusion 2', value: '150 edited photos' },
        { field: 'Discount 1 conditions', value: 'Book 6 months ahead' },
      ]),
      null,
    );
  });
});

test('flag ON: first violation wins, in the order given', () => {
  withFlagOn(() => {
    assert.equal(
      findVendorTextViolation([
        { field: 'Inclusion 1', value: 'text 0917 880 7163' },
        { field: 'Inclusion 2', value: 'add me on viber' },
      ]),
      `Inclusion 1: ${SERVICE_TEXT_BLOCK_MESSAGE}`,
    );
    // A blank ahead of a dirty field is skipped, not returned.
    assert.equal(
      findVendorTextViolation([
        { field: 'Inclusion 1', value: '' },
        { field: 'Inclusion 2', value: 'add me on viber' },
      ]),
      `Inclusion 2: ${SERVICE_TEXT_BLOCK_MESSAGE}`,
    );
  });
});

// -- autoName -----------------------------------------------------------------

test('autoName is 1-based and reads like the noun the vendor sees', () => {
  assert.equal(autoName('item', 0), 'Item 1');
  assert.equal(autoName('option', 1), 'Option 2');
  assert.equal(autoName('inclusion', 4), 'Inclusion 5');
  assert.equal(autoName('package', 0), 'Package 1');
});

test('autoName is not flag-gated - a blank name is a defect either way', () => {
  withFlagOff(() => {
    assert.equal(autoName('option', 0), 'Option 1');
  });
});

test('an empty field list is clean', () => {
  withFlagOn(() => {
    assert.equal(findVendorTextViolation([]), null);
  });
});
