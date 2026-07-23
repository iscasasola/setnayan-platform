/**
 * Unit suite for the analytics URL sanitizer. The invariant: a guest bearer
 * token in a query string (invite/t/g/token) never survives into a PostHog
 * URL property, while every other part of the URL is preserved and the
 * function never throws (it runs on every captured event).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  SENSITIVE_QUERY_KEYS,
  stripSensitiveParams,
  sanitizeAnalyticsProperties,
} from './analytics-sanitize';

test('strips each sensitive key from an absolute URL, preserving origin + path', () => {
  assert.equal(
    stripSensitiveParams('https://www.setnayan.com/maria-and-jose?invite=SECRET123'),
    'https://www.setnayan.com/maria-and-jose',
  );
  assert.equal(
    stripSensitiveParams('https://www.setnayan.com/find-seat?t=TABLETOKEN'),
    'https://www.setnayan.com/find-seat',
  );
  assert.equal(
    stripSensitiveParams('https://www.setnayan.com/x?g=GUESTTOK'),
    'https://www.setnayan.com/x',
  );
  assert.equal(
    stripSensitiveParams('https://www.setnayan.com/papic/me?token=BEARER'),
    'https://www.setnayan.com/papic/me',
  );
});

test('preserves non-sensitive params and only removes the sensitive ones', () => {
  assert.equal(
    stripSensitiveParams('https://www.setnayan.com/p?phase=rsvp&invite=SECRET&utm_source=fb'),
    'https://www.setnayan.com/p?phase=rsvp&utm_source=fb',
  );
});

test('handles relative URLs without inventing an origin', () => {
  assert.equal(stripSensitiveParams('/maria-and-jose?invite=SECRET'), '/maria-and-jose');
  assert.equal(
    stripSensitiveParams('/find-seat?t=TOK&phase=live'),
    '/find-seat?phase=live',
  );
});

test('preserves the hash fragment', () => {
  assert.equal(
    stripSensitiveParams('https://www.setnayan.com/p?invite=SECRET#story'),
    'https://www.setnayan.com/p#story',
  );
});

test('is a no-op (returns the same string) when there is nothing sensitive', () => {
  const clean = 'https://www.setnayan.com/explore?category=photo';
  assert.equal(stripSensitiveParams(clean), clean);
  assert.equal(stripSensitiveParams('/dashboard'), '/dashboard');
});

test('never throws on a malformed URL — returns the input unchanged', () => {
  assert.equal(stripSensitiveParams('::::not a url::::'), '::::not a url::::');
  assert.equal(stripSensitiveParams(''), '');
});

test('every declared sensitive key is actually stripped', () => {
  for (const key of SENSITIVE_QUERY_KEYS) {
    const url = `https://www.setnayan.com/x?${key}=SECRET&keep=1`;
    assert.equal(stripSensitiveParams(url), 'https://www.setnayan.com/x?keep=1', `key ${key} not stripped`);
  }
});

test('sanitizeAnalyticsProperties scrubs every URL-bearing property key', () => {
  const props = {
    $current_url: 'https://www.setnayan.com/p?invite=SECRET',
    $referrer: 'https://www.setnayan.com/find-seat?t=TAB',
    $initial_current_url: 'https://www.setnayan.com/a?g=G',
    $initial_referrer: 'https://www.setnayan.com/b?token=T',
    $pathname: '/p', // not a URL key — must be left untouched
    distinct_id: 'abc',
  };
  const out = sanitizeAnalyticsProperties(props);
  assert.equal(out.$current_url, 'https://www.setnayan.com/p');
  assert.equal(out.$referrer, 'https://www.setnayan.com/find-seat');
  assert.equal(out.$initial_current_url, 'https://www.setnayan.com/a');
  assert.equal(out.$initial_referrer, 'https://www.setnayan.com/b');
  assert.equal(out.$pathname, '/p');
  assert.equal(out.distinct_id, 'abc');
});

test('sanitizeAnalyticsProperties ignores non-string / missing values without throwing', () => {
  const props = { $current_url: 123, $referrer: null, other: undefined } as unknown as Record<
    string,
    unknown
  >;
  const out = sanitizeAnalyticsProperties(props);
  assert.equal(out.$current_url, 123);
  assert.equal(out.$referrer, null);
});
