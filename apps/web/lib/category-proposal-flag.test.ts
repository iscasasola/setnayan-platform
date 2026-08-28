/**
 * isCategoryProposalDraftEnabled() — C4 ships DARK.
 *
 * Production has held ZERO category requests, ever, so there is nothing to
 * draft and nothing real to judge a draft against. The owner switches this on
 * the day a supplier first types a trade we have no word for. It must default
 * OFF and require the exact opt-in string — never the `!== 'false'` shape used
 * by safe, already-proven cleanup jobs.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isCategoryProposalDraftEnabled } from './category-proposal-flag';

const KEY = 'CATEGORY_PROPOSAL_DRAFT_ENABLED';

function withEnv(value: string | undefined, fn: () => void) {
  const prev = process.env[KEY];
  try {
    if (value === undefined) delete process.env[KEY];
    else process.env[KEY] = value;
    fn();
  } finally {
    if (prev === undefined) delete process.env[KEY];
    else process.env[KEY] = prev;
  }
}

test('OFF when unset — ships dark', () => {
  withEnv(undefined, () => assert.equal(isCategoryProposalDraftEnabled(), false));
});

test('OFF for near-miss truthy values — only the exact string arms it', () => {
  withEnv('1', () => assert.equal(isCategoryProposalDraftEnabled(), false));
  withEnv('TRUE', () => assert.equal(isCategoryProposalDraftEnabled(), false));
  withEnv('yes', () => assert.equal(isCategoryProposalDraftEnabled(), false));
  withEnv('', () => assert.equal(isCategoryProposalDraftEnabled(), false));
});

test('ON only for the literal string "true"', () => {
  withEnv('true', () => assert.equal(isCategoryProposalDraftEnabled(), true));
});
