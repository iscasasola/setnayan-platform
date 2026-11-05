/**
 * reply-send.test.ts — sending a reply never loses what was typed, never hangs,
 * and never lands a guest on the site's home. (lib/reply-send.ts has the story.)
 *
 * ── What is proven, and how ────────────────────────────────────────────────
 * BEHAVIOUR (the sender, driven with real promises and an injected clock):
 *   1 · a send that REJECTS (offline, 5xx, the action threw) → 'not_sent',
 *       and nothing is thrown at the caller — so no error boundary, so the form
 *       is never unmounted;
 *   2 · a send that never answers → 'not_sent' when the limit passes, and not
 *       before; a late answer after that is swallowed, not an unhandled error;
 *   3 · a second press while the first is out → 'ignored', the action is called
 *       ONCE; after it settles the next press sends again;
 *   4 · Next's own signal (the redirect that IS a landed reply) passes through
 *       untouched, and the sender is free again afterwards;
 *   5 · a send that resolves → 'sent'.
 * SOURCE (the wiring those outcomes depend on — each checked by sabotage):
 *   6 · every form of the reply card is `ReplyForm` and every button of it is
 *       `ReplySubmit`; the card draws no bare `<form>` and no bare button;
 *   7 · `ReplyForm` keeps the server action ON the element (the no-script
 *       post), prevents React's own run, refuses a second press synchronously,
 *       holds its OWN pending state (no transition, the send started a task
 *       after the submit event), hands it to the button, does not throw a
 *       landed reply's redirect back into React, draws its children
 *       unconditionally, and its one line is the page's own sentence;
 *   8 · no redirect in the reply's save falls back to `'/'`, the event is read
 *       WITH its error before the write, and nothing after the write throws.
 *
 * ── SEEN IN A REAL BROWSER (2026-10-11, 375×812, a dev server with no database) ──
 * The Event Hub's reply sheet in the dev lab (`/dev/maker-lab/guest?rsvp=form&sheet=1`,
 * the real `RsvpWidget` and the real `submitRsvp`) and a throwaway page holding
 * `ReplyForm` against a real redirecting action:
 *   · the served HTML still carries `method="POST"` and the `$ACTION_…` fields
 *     (the no-script post survives the client form);
 *   · request refused (offline): one call; the sheet, the typed note, the
 *     mobile and the answer all still there; the line under the button; no
 *     error screen; pressing again sends again;
 *   · request never answers: "Saving RSVP…" + the veil; two more submits while
 *     out → still ONE call; at 20.06 s the veil is gone, the button is back,
 *     the line is on screen 24 px clear of the edge, everything typed is kept;
 *   · the real save, which cannot read the event there (it used to be
 *     `redirect('/')`): the line — and the guest is NOT on the site's home;
 *   · a real action that redirects: the page lands on the target, no line, no
 *     error; a second press on the same page works; Back works.
 * 🪤 TWO THINGS ONLY THE BROWSER SHOWED, both now pinned in § 7:
 *   · built on `useTransition` + `useFormStatus`, the line appeared at 20 s
 *     UNDER a veil that never lifted (React ties the form's status to the
 *     whole async action, Next's request included);
 *   · throwing the landed reply's redirect back into React left a BLANK PAGE
 *     ("Cannot read properties of null (reading 'removeChild')") while the
 *     plain form beside it landed fine.
 *
 * ── Caveats — read before trusting a green run ─────────────────────────────
 *   · That run was a desktop browser at a phone's size, against a dev build.
 *     Not seen: a real phone, a real network drop mid-request, a chat app's
 *     in-app browser, the production build, and a real published event (the
 *     lab has no database — a reply that truly SAVES and lands on the
 *     thank-you was only seen through the throwaway redirecting action).
 *   · Not seen at all: the Reply door's own page (`/invite/reply`, the Terms
 *     tick, one question at a time) — the lab draws it under the Maker's
 *     canvas bridge, which stops every send. It is the same `ReplyForm`.
 *   · A redirect that lands on the SAME page (`?rsvp=mobile`, `?rsvp=choose`,
 *     `?rsvp=terms`, `?rsvp=error`) now keeps what was typed (the form is not
 *     remounted), and its sentence is drawn at the TOP of the form, as before.
 *     Whether a guest at the bottom of a long form sees it was not walked.
 *   · A not-found answered by the save is thrown in render for Next's
 *     boundary; that path was not exercised.
 *   · The limit ends the WAIT, not the request. Next sends one server action
 *     at a time, so a retry pressed while the first is still out waits behind
 *     it and can time out again. Needs a real network drop to measure.
 *   · § 8 reads `submitRsvp` and `submitInviteReply` only. Other actions in the
 *     same file still fall back to `'/'` (`withdrawFaceConsent`) — out of scope.
 *
 * Sabotage (2026-10-11, each on the real file, restored by hash):
 *   the sender rethrows every error ............ § 1 · 2 red
 *   the sender has no time limit ............... § 2 red
 *   the sender drops its "already out" check ... § 3 red
 *   the sender swallows Next's signal .......... § 4 red
 *   one widget form back to `<form` ............ § 6 red
 *   one widget button back to `SubmitButton` ... § 6 red
 *   ReplyForm without `e.preventDefault()` ..... § 7 red
 *   ReplyForm sends inside the submit event .... § 7 red
 *   ReplyForm throws the redirect into React ... § 7 red
 *   ReplyForm draws children only when sent .... § 7 red
 *   SubmitButton ignores the handed state ...... § 7 red
 *   submitRsvp's final redirect back to `'/'` .. § 8 red
 *   the event read loses its error ............. § 8 red
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { REPLY_NOT_SENT, REPLY_SEND_LIMIT_MS, makeReplySender } from '@/lib/reply-send';
import { stripComments } from '@/lib/strip-comments';

const WEB = join(__dirname, '..');
const raw = (rel: string) => readFileSync(join(WEB, rel), 'utf8');
const read = (rel: string) => stripComments(raw(rel));

/** Next's redirect signal, as the browser receives it from a server action. */
const REDIRECT = Object.assign(new Error('NEXT_REDIRECT'), { digest: 'NEXT_REDIRECT;push;/maria-and-jose/invite/enter?rsvp=ok;307;' });
/** `unstable_rethrow`, reduced to its decision: Next's signals are thrown on, anything else returns. */
const rethrow = (err: unknown) => {
  const digest = (err as { digest?: unknown } | null)?.digest;
  if (typeof digest === 'string' && digest.startsWith('NEXT_')) throw err;
};

/** A clock the test moves by hand. */
function clock() {
  const timers: Array<{ fn: () => void; ms: number; cleared: boolean }> = [];
  return {
    setTimer: (fn: () => void, ms: number) => {
      const t = { fn, ms, cleared: false };
      timers.push(t);
      return t;
    },
    clearTimer: (id: unknown) => {
      if (id) (id as { cleared: boolean }).cleared = true;
    },
    /** Fire every live timer due at `ms`. */
    pass: (ms: number) => {
      for (const t of timers) if (!t.cleared && t.ms <= ms) (t.cleared = true), t.fn();
    },
    live: () => timers.filter((t) => !t.cleared).length,
    limits: () => timers.map((t) => t.ms),
  };
}
const tick = () => new Promise<void>((r) => setImmediate(r));

// ── 1–5 · the sender ───────────────────────────────────────────────────────

test('1 · a send that FAILS is reported, never thrown — so nothing unmounts the form', async () => {
  for (const failure of [
    new TypeError('Failed to fetch'), // offline
    new Error('An unexpected response was received from the server.'), // a 5xx Next could not read
    Object.assign(new Error('boom'), { digest: '1234567890' }), // the action threw on the server
  ]) {
    const c = clock();
    const sender = makeReplySender({ rethrow, ...c });
    const outcome = await sender.press(() => Promise.reject(failure));
    assert.equal(outcome, 'not_sent', `${failure.message}: the failure was not reported as "not sent"`);
    assert.equal(sender.busy(), false, 'the sender stayed busy after a failure — the next press would be ignored');
    assert.equal(c.live(), 0, 'the time limit kept running after the send settled');
  }
  // A send that throws before its first await is a failure too, not a crash.
  const sender = makeReplySender({ rethrow, ...clock() });
  assert.equal(
    await sender.press(() => {
      throw new Error('threw synchronously');
    }),
    'not_sent',
  );
});

test('2 · a send that never answers gives the screen back at the limit — not before, and a late answer is harmless', async () => {
  const c = clock();
  const sender = makeReplySender({ rethrow, ...c });
  let settle: (v: unknown) => void = () => {};
  let fail: (e: unknown) => void = () => {};
  let outcome: string | null = null;
  void sender
    .press(
      () =>
        new Promise((resolve, reject) => {
          settle = resolve;
          fail = reject;
        }),
    )
    .then((o) => (outcome = o));
  await tick();
  assert.deepEqual(c.limits(), [REPLY_SEND_LIMIT_MS], 'the wait has no limit, or not the declared one');
  assert.ok(REPLY_SEND_LIMIT_MS >= 10_000 && REPLY_SEND_LIMIT_MS <= 30_000, 'a limit a slow-but-working save would trip, or one nobody would wait out');
  c.pass(REPLY_SEND_LIMIT_MS - 1);
  await tick();
  assert.equal(outcome, null, 'the wait ended before its limit');
  assert.equal(sender.busy(), true);
  c.pass(REPLY_SEND_LIMIT_MS);
  await tick();
  assert.equal(outcome, 'not_sent', 'the veil would never lift: a send that does not answer is not ended');
  assert.equal(sender.busy(), false, 'the guest cannot press again after the limit');

  // The request is still out. Its late failure must not surface anywhere.
  const unhandled: unknown[] = [];
  const onUnhandled = (e: unknown) => unhandled.push(e);
  process.on('unhandledRejection', onUnhandled);
  fail(new TypeError('Failed to fetch'));
  await tick();
  await tick();
  process.off('unhandledRejection', onUnhandled);
  assert.deepEqual(unhandled, [], 'a send that failed after its limit became an unhandled rejection');
  void settle;
});

test('3 · a double press cannot send twice', async () => {
  const c = clock();
  const sender = makeReplySender({ rethrow, ...c });
  let calls = 0;
  let settle: (v: unknown) => void = () => {};
  const send = () => {
    calls += 1;
    return new Promise((resolve) => {
      settle = resolve;
    });
  };
  const first = sender.press(send);
  const second = await sender.press(send);
  assert.equal(second, 'ignored', 'a second press while the first is out was sent');
  assert.equal(calls, 1, `the action ran ${calls} times for one reply`);
  settle(undefined);
  assert.equal(await first, 'sent');
  // …and the form is not left dead: the next press sends.
  const third = sender.press(send);
  settle(undefined);
  assert.equal(await third, 'sent');
  assert.equal(calls, 2);
});

test('4 · the redirect that IS a landed reply passes through untouched', async () => {
  const sender = makeReplySender({ rethrow, ...clock() });
  await assert.rejects(
    () => sender.press(() => Promise.reject(REDIRECT)),
    (err) => err === REDIRECT,
    'a landed reply was reported as "not sent" (its redirect was swallowed)',
  );
  assert.equal(sender.busy(), false);
});

test('5 · a send that answers is sent', async () => {
  const c = clock();
  const sender = makeReplySender({ rethrow, ...c });
  assert.equal(await sender.press(async () => undefined), 'sent');
  assert.equal(c.live(), 0);
});

// ── 6–8 · the wiring ───────────────────────────────────────────────────────

test('6 · every form of the reply card is the caught one, and every button of it is the form\'s own', () => {
  const widget = read('app/[slug]/_components/rsvp-widget.tsx');
  const caught = widget.match(/<ReplyForm action=\{action\}/g) ?? [];
  assert.ok(caught.length >= 3, `anti-vacuity: the card's forms moved (found ${caught.length} — the page form, the missing-details form, "Not coming after all?")`);
  assert.equal((widget.match(/<form[\s>]/g) ?? []).length, 0, 'the reply card draws a bare <form> again — its press is not caught');
  assert.equal((widget.match(/<\/ReplyForm>/g) ?? []).length, caught.length);
  // The button reads the FORM's pending state. The app's bare SubmitButton reads React's form status, which a
  // caught press never enters — it would show no "Sending…" at all, and could be pressed twice.
  assert.ok((widget.match(/<ReplySubmit[\s>]/g) ?? []).length >= 4, 'anti-vacuity: the card\'s buttons moved');
  assert.equal((widget.match(/<SubmitButton[\s>]/g) ?? []).length, 0, 'a button on the reply card no longer follows the form\'s own sending state');
});

test('7 · ReplyForm is the same form with the press caught — and its line is the page\'s own sentence', () => {
  const form = read('app/[slug]/_components/reply-form.tsx');
  assert.match(raw('app/[slug]/_components/reply-form.tsx'), /^'use client';/, 'ReplyForm is not a client component — onSubmit would never run');
  // The server action stays ON the element: the plain post with script off.
  assert.match(form, /<form action=\{action\} onSubmit=\{onSubmit\} \{\.\.\.rest\}>/, 'the form lost its own action (no-script post) or its caught press');
  // React's own run of the action is prevented, before anything else.
  const submit = form.slice(form.indexOf('function onSubmit('), form.indexOf('return (', form.indexOf('function onSubmit(')));
  assert.match(submit, /^function onSubmit\([^)]*\) \{\s*e\.preventDefault\(\);/, 'the press is not caught: React runs the action and a failure reaches the error boundary');
  // A second press while one is out: refused synchronously, before any state has re-rendered.
  assert.match(submit, /if \(pressed\.current \|\| send\.busy\(\)\) return;\s*pressed\.current = true;/, 'two presses in one frame can both be sent');
  // ⏳ The pending state is the form's own, so it can END on the limit: no transition, and the send starts a task
  // after the submit event (see the component's note — the veil stayed up past the limit when it was a transition).
  assert.doesNotMatch(form, /useTransition|startTransition|useFormStatus/, 'the send is tied to React\'s form status again — the veil cannot end before the request does');
  assert.match(submit, /setSending\(true\);\s*window\.setTimeout\(\(\) => \{\s*void send\s*\.press\(async \(\) => action\(data\)\)/, 'the send is started inside the submit event — React marks the form pending until the request ends');
  assert.match(submit, /\}, 0\);\s*\}\s*$/, 'the send is not deferred by a task');
  assert.match(submit, /pressed\.current = false;\s*if \(!mounted\.current\) return;\s*if \(outcome === 'not_sent'\) setNotSent\(true\);\s*setSending\(false\);/, 'a settled send does not end "Sending…", or a failed one is not said');
  assert.match(form, /makeReplySender\(\{ rethrow: unstable_rethrow \}\)/, 'the sender no longer tells Next\'s own signals from a failure');
  // A landed reply's redirect is NOT thrown back into React (that left a blank page); it only ends "Sending…".
  assert.match(submit, /if \(isRedirectSignal\(thrown\)\) setSending\(false\);\s*else setSignal\(\{ thrown \}\);/, 'a landed reply\'s redirect is thrown into the tree again, or its "Sending…" never ends');
  assert.match(form, /typeof digest === 'string' && digest\.startsWith\('NEXT_REDIRECT'\)/);
  // The button is handed the form's state…
  assert.match(form, /<ReplySending\.Provider value=\{sending\}>/);
  assert.match(form, /const sending = useContext\(ReplySending\);\s*return <SubmitButton \{\.\.\.props\} pending=\{sending \?\? undefined\} \/>;/, 'the card\'s button no longer follows the form\'s sending state');
  // …and the app's button obeys it (and reads React's form status only when not handed one).
  const button = read('app/_components/submit-button.tsx');
  assert.match(button, /const \{ pending: formPending \} = useFormStatus\(\);\s*const pending = ownedPending \?\? formPending;/, 'SubmitButton ignores a pending state handed to it');
  // Everything typed stays: the children are drawn whatever the outcome.
  const jsx = form.slice(form.indexOf('<form action={action}'));
  assert.match(jsx, /^<form[^>]*>\s*\{children\}/, 'the form does not always draw its children — a failed send would drop what was typed');
  assert.match(jsx, /\{notSent \? \(\s*<p [^>]*role="alert"[^>]*>\s*\{REPLY_NOT_SENT\}\s*<\/p>\s*\) : null\}/, 'a failed send is not said');
  // One sentence for one fact: the words the page already uses for ?rsvp=error.
  for (const page of ['app/[slug]/page.tsx', 'app/[slug]/invite/reply/page.tsx']) {
    assert.ok(raw(page).includes(`text: '${REPLY_NOT_SENT}'`), `${page} no longer says the same sentence as the card`);
  }
});

/** One exported action's body. */
function actionBody(src: string, name: string): string {
  const start = src.indexOf(`export async function ${name}(`);
  assert.notEqual(start, -1, `${name} is gone or renamed — update this test`);
  const next = src.indexOf('\nexport async function ', start + 10);
  return src.slice(start, next === -1 ? undefined : next);
}

test('8 · the reply\'s save never lands on the site\'s home, and never calls a saved reply unsent', () => {
  const submit = actionBody(read('app/[slug]/actions.ts'), 'submitRsvp');
  const door = actionBody(read('app/[slug]/invite/actions.ts'), 'submitInviteReply');
  for (const [name, body] of [['submitRsvp', submit], ['submitInviteReply', door]] as const) {
    const redirects = body.match(/redirect\(/g) ?? [];
    assert.ok(redirects.length >= 2, `anti-vacuity: ${name} has ${redirects.length} redirects`);
    assert.doesNotMatch(body, /redirect\([^;]*: '\/'\s*\)/, `${name} sends a guest to the site's home again`);
    assert.doesNotMatch(body, /redirect\(\s*'\/'\s*\)/, `${name} sends a guest to the site's home again`);
  }
  // The read the save stands on consults its error, before the write.
  const eventRead = submit.indexOf('const { data: evRsvp, error: evRsvpError } = await withSchemaRetry(');
  const write = submit.indexOf('.update({');
  assert.ok(eventRead > -1, 'the event read before the write throws its error away again');
  assert.ok(write > eventRead, 'anti-vacuity: the reply\'s write was not found after the event read');
  assert.match(
    submit.slice(eventRead, write),
    /const replySlug: string = evRsvpError \|\| !evRsvp\?\.slug \? eventAddressUnread\('submitRsvp · event'\) : evRsvp\.slug;/,
    'a failed event read no longer stops the save before the write',
  );
  // After the reply LANDED nothing may throw: the last redirects use the address read before the write.
  // (to the action's own closing brace — `actionBody` runs on into the file's unexported helpers)
  const from = submit.indexOf("const outcome = answerRefused ? 'refused'");
  const landed = submit.slice(from, submit.indexOf('\n}\n', from));
  assert.ok(from > write && landed.length > 50 && landed.length < 1200, 'anti-vacuity: the landed-reply tail moved');
  assert.doesNotMatch(landed, /eventAddressUnread\(|throw /, 'a reply that was saved can be reported as not sent');
  assert.match(landed, /redirect\(ev\?\.slug \? `\/\$\{ev\.slug\}\?rsvp=\$\{outcome\}` : `\/\$\{replySlug\}\?rsvp=\$\{outcome\}`\);/);
  assert.match(landed, /if \(toInvite && !ev\?\.slug\) redirect\(`\$\{inviteEnterPath\(replySlug\)\}\?rsvp=\$\{outcome\}`\);/);
});
