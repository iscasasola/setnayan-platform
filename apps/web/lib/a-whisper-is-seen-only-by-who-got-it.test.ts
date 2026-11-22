/**
 * 👀 A WHISPER IS "SEEN" ONLY BY WHO GOT IT (the #8047 review, 20 Nov 2026; controller order 2). Before this, the line
 * under your own whisper read "Seen · <the supplier's person>" — someone the whisper never reached, because a reader's
 * broadcast says only "I read this chat up to here". Held here:
 *   1 · under the HOSTS' whisper the supplier's people are never named — only the co-hosts / coordinator it reached;
 *   2 · under a TEAM whisper the hosts are never named — only the shop's own people it reached;
 *   3 · the list is the one the server wrote at Send with the one side rule (`recipient_user_ids`, chosen by
 *       `whisperRecipients` / `teamWhisperRecipients`) — the same list the whisper itself went to;
 *   4 · a whisper with no list on the row names nobody; a shared line names every reader, as before;
 *   5 · the stream asks this rule for its names.
 * Fails before the fix: `seenByWhoGotIt` did not exist and the stream named every reader past the line.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { seenByWhoGotIt, teamWhisperRecipients, whisperRecipients } from './chat-whisper';
import { stripComments } from './strip-comments';

const ANA = 'ana-host';
const JOSE = 'jose-cohost';
const LIZA = 'liza-coordinator';
const BEN = 'ben-supplier-owner';
const MARA = 'mara-supplier-staff';

test('1 · the hosts’ whisper: the supplier who read the chat is never named', () => {
  const line = { sender_user_id: ANA, recipient_user_ids: [JOSE, LIZA], whisper_side: 'hosts' };
  assert.deepEqual(seenByWhoGotIt(line, [BEN, JOSE, MARA, LIZA]), [JOSE, LIZA]);
  assert.deepEqual(seenByWhoGotIt(line, [BEN, MARA]), [], 'only the supplier read past it — so nobody who got it saw it');
});

test('2 · a team whisper: the hosts who read the chat are never named', () => {
  const line = { sender_user_id: BEN, recipient_user_ids: [MARA], whisper_side: 'team' };
  assert.deepEqual(seenByWhoGotIt(line, [ANA, MARA, JOSE, LIZA]), [MARA]);
});

test('3 · the names come from the list the server chose with the one side rule', () => {
  const team = teamWhisperRecipients({ teamUserIds: [BEN, MARA], senderUserId: BEN });
  assert.deepEqual(seenByWhoGotIt({ sender_user_id: BEN, recipient_user_ids: team, whisper_side: 'team' }, [ANA, MARA]), [MARA]);
  const hosts = whisperRecipients({ hostMemberIds: [ANA, JOSE], coordinatorIds: [LIZA], shopUserIds: [BEN, MARA], senderUserId: ANA });
  assert.deepEqual(seenByWhoGotIt({ sender_user_id: ANA, recipient_user_ids: hosts, whisper_side: 'hosts' }, [BEN, MARA, JOSE, LIZA]), [JOSE, LIZA]);
});

test('4 · no list on a whisper names nobody; a shared line names every reader', () => {
  assert.deepEqual(seenByWhoGotIt({ sender_user_id: ANA, recipient_user_ids: [], whisper_side: 'hosts' }, [BEN, JOSE]), []);
  assert.deepEqual(seenByWhoGotIt({ sender_user_id: ANA, recipient_user_ids: null, whisper_side: null }, [BEN, JOSE]), [BEN, JOSE]);
  // A one-person private line (a face in the strip) is the same rule: only its person.
  assert.deepEqual(seenByWhoGotIt({ sender_user_id: ANA, recipient_user_id: JOSE }, [BEN, JOSE]), [JOSE]);
});

test('5 · the stream asks this rule for the names under your own line', () => {
  const stream = stripComments(readFileSync(join(process.cwd(), 'app/_components/chat-message-stream.tsx'), 'utf8'));
  assert.match(stream, /seenLine\(LAST_LINE_WORDS\.seen, seenByWhoGotIt\(ownLast, /, 'the Seen line names readers the line never reached');
  assert.doesNotMatch(stream, /seenLine\(LAST_LINE_WORDS\.seen, \[\.\.\.seenBy\]/, 'the Seen line reads every reader again');
});
