/**
 * 🪪 CHAT-22 (walk 16 Nov 2026): the 🔒 private picker and the members strip named the couple "Someone" / "S—" — the
 * account's `display_name` was the stand-in "Someone —". `chatHostsFrom` is the one parser every chat face reads.
 */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { chatHostsFrom, hostFirstName, hostInitials } from './chat-hosts';

describe('chat hosts never wear a stand-in name (CHAT-22)', () => {
  it('a stand-in display name falls back to the real first name', () => {
    const [h] = chatHostsFrom([{ user_id: 'u1', first_name: 'Ana', name: 'Someone —', role: null, label: null }])!;
    assert.equal(hostFirstName(h!), 'Ana');
    assert.equal(hostInitials(h!), 'A');
  });

  it('a first name derived from the stand-in is no name either — the neutral word, never "Someone" or "S—"', () => {
    const [h] = chatHostsFrom([{ user_id: 'u1', first_name: 'Someone', name: 'Someone —', role: null, label: null }])!;
    assert.equal(hostFirstName(h!), 'Host');
    assert.doesNotMatch(hostInitials(h!), /^S/);
  });

  it('a real name is kept as it is', () => {
    const [h] = chatHostsFrom([{ user_id: 'u1', first_name: 'Ana', name: 'Ana Reyes', role: null, label: null }])!;
    assert.equal(hostFirstName(h!), 'Ana');
    assert.equal(hostInitials(h!), 'AR');
  });

  it('only a first name still draws a face', () => {
    const [h] = chatHostsFrom([{ user_id: 'u1', first_name: null, name: 'Marco Cruz', role: null, label: null }])!;
    assert.equal(hostFirstName(h!), 'Marco');
  });
});
