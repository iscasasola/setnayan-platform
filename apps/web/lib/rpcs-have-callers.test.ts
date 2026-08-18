/**
 * rpcs-have-callers.test.ts — a granted RPC that nothing calls is a gate with no
 * handle, wearing a different costume.
 *
 * 🔴 THE PATTERN, AGAIN. `gates-have-handles.test.ts` exists because a COLUMN
 * whose whole job is to be turned on had zero writers — twice. This is the same
 * failure one level up: `cancel_vendor_lock_request` shipped in migration
 * 20271107090000, was re-emitted by 20271143289546, holds an EXECUTE grant to
 * `authenticated`, has a docblock describing exactly which product promise it
 * keeps ("a pending lock is non-binding, the customer can withdraw anytime") —
 * and had ZERO CALLERS ANYWHERE for the entire time it existed.
 *
 * The consequence was not theoretical. A couple who asked the wrong supplier had
 * no way to un-ask: the request held that supplier's hard-single slot and both
 * pending indexes until either the supplier answered a question the couple no
 * longer wanted answered, or the 7-day fuse blew. A FORWARD PRIMITIVE WITH NO
 * INVERSE — the same shape that once left a vendor reading BUSY to everyone
 * forever.
 *
 * 🔑 WHY NOTHING ELSE CATCHES IT. The function typechecks (it is SQL). Its
 * migration has RLS, a grant and a thoughtful comment. Its db tests pass,
 * because a db test calls it directly. The app compiles, the feature "works" —
 * there is simply no button. Nothing errors, nothing logs, production looks
 * calm. The ONLY question that finds it is "does any application code call
 * this?", and that is the question this file asks.
 *
 * SCOPE, deliberately narrow: this is a REGISTRY, not a sweep over every RPC in
 * the schema. Plenty of functions are legitimately called only by other SQL, by
 * a trigger, or by the service role from a job. Add a row here when the function
 * exists to be reached BY A PERSON THROUGH THE APP, and its absence is silent.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const WEB = join(HERE, '..');

const MUST_BE_REACHABLE: {
  rpc: string;
  whoCallsIt: string;
  whatBreaksWithoutIt: string;
}[] = [
  {
    rpc: 'cancel_vendor_lock_request',
    whoCallsIt: "the couple, from the bench card's Take it back",
    whatBreaksWithoutIt:
      'a couple who asked the wrong supplier cannot un-ask; the request holds ' +
      "that supplier's slot for seven days and the only way out is the fuse",
  },
  {
    rpc: 'vendor_agree_to_lock',
    whoCallsIt: 'the supplier, from their Overview card or the client card',
    whatBreaksWithoutIt: 'no booking can ever be made — this RPC is what makes one',
  },
  {
    rpc: 'record_csp_violation',
    whoCallsIt: 'app/api/csp-report/route.ts, with the service role, on every browser report',
    whatBreaksWithoutIt:
      'the browser-protection reports go back to being counted nowhere, so the ' +
      'evidence needed to switch real protection on is never gathered and the ' +
      'moment to enforce never arrives — the exact state this replaced',
  },
  {
    rpc: 'vendor_decline_lock',
    whoCallsIt: 'the supplier, from the same two places',
    whatBreaksWithoutIt:
      'a supplier cannot say no, and cannot clear the resolve-others-first ' +
      'refusal that blocks them from accepting anybody else on that date',
  },
];

/** Strip comments — a docblock naming an RPC must not read as a call site. */
function code(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    if (name === 'node_modules' || name === '.next') continue;
    const p = join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.tsx?$/.test(name)) out.push(p);
  }
  return out;
}

const ALL = ['app', 'lib'].flatMap((r) => walk(join(WEB, r)));

for (const entry of MUST_BE_REACHABLE) {
  test(`${entry.rpc} — something in the app actually calls it`, () => {
    // A REAL call site, not a mention: `.rpc('name'` with the quote. A bare
    // occurrence of the name would match the migration path in a comment, a
    // type alias, or this very registry — which is how a guard comes to pass
    // while the thing it guards is gone.
    const callers = ALL.filter((f) => {
      const rel = relative(WEB, f);
      // Tests call these directly by design; a test is not a handle a person
      // can reach. Excluding them is what keeps this from passing on the
      // strength of its own coverage.
      if (/\.test\.tsx?$/.test(rel)) return false;
      return new RegExp(`\\.rpc\\(\\s*['"\`]${entry.rpc}['"\`]`).test(code(readFileSync(f, 'utf8')));
    }).map((f) => relative(WEB, f));

    assert.ok(
      callers.length > 0,
      `${entry.rpc} has an EXECUTE grant and NO application caller.\n` +
        `  Who should reach it: ${entry.whoCallsIt}\n` +
        `  What breaks meanwhile: ${entry.whatBreaksWithoutIt}\n` +
        `  This is a gate with no handle. Either wire the caller, or — if the ` +
        `RPC is genuinely retired — drop it from this registry AND revoke its ` +
        `grant, so the schema stops advertising a door that opens onto nothing.`,
    );
  });
}

test('the scan actually scanned something', () => {
  // A path change that silently empties ALL would make every assertion above
  // pass vacuously — and this file exists precisely because a silent nothing
  // looks exactly like a clean result.
  assert.ok(ALL.length > 500, `only ${ALL.length} files walked — the roots are wrong`);
  assert.ok(MUST_BE_REACHABLE.length > 0);
});
