import { test } from 'node:test';
import assert from 'node:assert/strict';
import { classifyIntent } from './intents';

test('price intent — English + Taglish', () => {
  assert.equal(classifyIntent('How much is your wedding package?').intent, 'price');
  assert.equal(classifyIntent('magkano po ang package niyo?').intent, 'price');
  assert.equal(classifyIntent('can you share your rates?').intent, 'price');
});

test('availability intent', () => {
  assert.equal(classifyIntent('Are you free on June 14?').intent, 'availability');
  assert.equal(classifyIntent('may booking pa ba kayo sa Dec 12?').intent, 'availability');
});

test('inclusions intent', () => {
  assert.equal(classifyIntent("what's included in the package?").intent, 'inclusions');
  assert.equal(classifyIntent('ano po kasama sa package?').intent, 'inclusions');
});

test('coverage / capability / lead_time / discount / social_proof', () => {
  assert.equal(classifyIntent('do you cover Cebu?').intent, 'coverage');
  assert.equal(classifyIntent('do you offer same day edit?').intent, 'capability');
  assert.equal(classifyIntent('we need someone this weekend, rush').intent, 'lead_time');
  assert.equal(classifyIntent('do you have any promo?').intent, 'discount');
  assert.equal(classifyIntent('can we see your portfolio and reviews?').intent, 'social_proof');
});

test('handoff intents win over factual ones', () => {
  assert.equal(classifyIntent('how much for a customized package?').intent, 'customization');
  assert.equal(classifyIntent('we want to book — how much is the downpayment?').intent, 'booking');
  assert.equal(classifyIntent('can you lower the price a bit?').intent, 'customization');
});

test('empty / gibberish -> unknown, confidence 0', () => {
  assert.deepEqual(classifyIntent(''), { intent: 'unknown', confidence: 0 });
  assert.deepEqual(classifyIntent('   '), { intent: 'unknown', confidence: 0 });
  assert.equal(classifyIntent('hello there!').intent, 'unknown');
});

test('confidence: strong=0.9, handoff=0.95', () => {
  assert.equal(classifyIntent('magkano?').confidence, 0.9);
  assert.equal(classifyIntent('we want to book').confidence, 0.95);
});
