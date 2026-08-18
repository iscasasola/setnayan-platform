/**
 * gate-writers.ts — "does ANYTHING write this column?", answered honestly.
 *
 * Extracted from `gates-have-handles.test.ts` on 2026-08-17 so that the unit
 * guard and the schema-enumerating db guard share ONE implementation. Two
 * copies of a detector drift, and the half that drifts is the half nobody runs.
 *
 * ── WHY THE DETECTOR IS THE HARD PART ───────────────────────────────────────
 * The question this answers — "is this switch reachable?" — is only as good as
 * its ability to recognise a write. A detector that MISSES writes does not fail
 * safe: it reports working screens as broken, and a guard that cries wolf
 * teaches you to skim past the one time it is right.
 *
 * The first version looked for exactly one spelling:
 *
 *     .update({ ...  some_column: value  ... })      // literal, within 600 chars
 *
 * Measured against the real schema on 2026-08-17 (265 boolean/enum columns
 * carrying a default), that spelling missed FOUR separate ways this codebase
 * actually writes a column, and reported 64 columns as unreachable when the
 * true number was far lower:
 *
 *   1. ES6 SHORTHAND. `guests.faceblock_enabled` is written as
 *      `.update({ ..., faceblock_enabled, ... })` — no colon anywhere. The
 *      pattern required `column:` and so concluded the guest privacy opt-out
 *      had no control, while a rendered checkbox sat on the guest page.
 *   2. A HELPER WRAPPER. `panood_control_state.director_mode` is written by
 *      `writeControlStateAdmin(admin, eventId, { director_mode: ... })`. The
 *      `.update(` and the column name are in the same module but not in the
 *      same call expression.
 *   3. THE 600-CHARACTER WINDOW. `users.marketing_opt_in` sits inside a large
 *      profile update object; the column name is further from `.update(` than
 *      the pattern would look. A big write object made the write invisible.
 *   4. ASSEMBLED INTO A VARIABLE FIRST. `const payload = {...}; …update(payload)`
 *      — the documented blind spot, and the most common shape in the admin
 *      tree, where over twenty call sites write through a built-up object.
 *
 * 🔑 THE RULE THAT REPLACED THEM. Do not try to match one call expression.
 * Ask the two questions separately and require BOTH:
 *
 *     (a) does this file write THIS TABLE at all?     from('<table>') + a verb
 *     (b) does this file name THIS COLUMN as a field? key / shorthand / assign
 *
 * Neither half alone is a write — (a) alone is any other column's update, and
 * (b) alone is a `.select()` shape or a form's field list. Together they are
 * the honest answer to "could this file be what flips it?".
 *
 * ⚠ COMMENTS ARE STRIPPED FIRST. Four guards in this repo have been satisfied
 * by a docblock ABOUT the thing instead of the thing. `papic_photos` carries
 * long prose naming `consent_to_public` in files that never write it.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export type Source = { path: string; code: string };

/** Line comments stripped: prose about a column must never count as a write. */
function stripComments(src: string): string {
  return src
    .split('\n')
    .filter((l) => !/^\s*(\/\/|\*|\/\*)/.test(l))
    .join('\n');
}

/** Every .ts/.tsx under `webRoot` that is not a test file. */
export function loadSources(webRoot: string): Source[] {
  const out: Source[] = [];
  const walk = (dir: string) => {
    for (const entry of readdirSync(dir)) {
      if (entry === 'node_modules' || entry === '.next' || entry.startsWith('.')) continue;
      const full = join(dir, entry);
      if (statSync(full).isDirectory()) walk(full);
      else if (/\.(ts|tsx)$/.test(entry) && !/\.test\.tsx?$/.test(entry)) {
        out.push({
          path: full.slice(webRoot.length + 1),
          code: stripComments(readFileSync(full, 'utf8')),
        });
      }
    }
  };
  walk(webRoot);
  return out;
}

/**
 * (a) Does this file issue a write against `table`?
 *
 * ⚠ BLIND SPOT #5, found 2026-08-17 — the day after the other four. This asked
 * only for a STRING LITERAL, `from('event_vendor_preferences')`. But
 * `lib/event-preferences.ts` writes that table as:
 *
 *     const TABLE = 'event_vendor_preferences';
 *     …
 *     await client.from(TABLE).upsert({ …, auto_send: autoSend, … })
 *
 * so `auto_send` was reported as having no control — while a real checkbox,
 * "Auto-send to my next inquiries", writes it from the inquiry form. The column
 * comment said "Written by …" and the measurement said nothing did; the comment
 * was right and the detector was wrong.
 *
 * 🔑 The false alarm is the expensive direction. A missed WRITE puts a working
 * screen on a list of broken ones, and a list with wrong entries on it stops
 * being read. So the constant is resolved: any `const NAME = '<table>'` in the
 * same module makes `from(NAME)` count. 18 call sites in this repo use it.
 */
function writesTable(code: string, table: string): boolean {
  if (!/\.(update|insert|upsert)\(/.test(code)) return false;
  if (new RegExp(`from\\(\\s*['"\`]${table}['"\`]`).test(code)) return true;

  const declarations = code.matchAll(
    new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*['"\`]${table}['"\`]`, 'g'),
  );
  for (const declaration of declarations) {
    const name = declaration[1]!;
    if (new RegExp(`from\\(\\s*${name}\\s*[,)]`).test(code)) return true;
  }
  return false;
}

/**
 * (b) Does this file name `column` in a position that SETS it?
 *
 * Four spellings, all present in this codebase:
 *   `column: value`        object-literal key
 *   `{ column }`           ES6 shorthand (no colon — blind spot #1)
 *   `obj.column = value`   property assignment on a built-up payload
 *   `obj['column'] = v`    the same, indexed
 *
 * `=[^=]` so `===` in a comparison is never read as an assignment.
 */
/**
 * String LITERAL CONTENTS blanked, quotes kept so the shape of the code survives.
 *
 * 🚨 WITHOUT THIS THE SHORTHAND BRANCH BELOW COUNTS A `.select()` AS A WRITE, and
 * that is the dangerous direction: a column that only ever appears in a select
 * list reads as WRITTEN, so `gates-have-handles` passes it and goes blind to a
 * genuine gate with no handle.
 *
 * Found 2026-08-17 by building the mirror guard, which flagged
 * `events.geolocation_enabled` as "written by app/api/v1/events/[eventId]/route.ts".
 * Its ONLY reference in the entire repo is inside a multi-line select string:
 *
 *     .select(`
 *        …
 *        geolocation_enabled,
 *        …`)
 *
 * A select-list entry and an ES6 shorthand property are the same characters —
 * `, column,` — so the pattern could not tell them apart. Every genuine write in
 * this codebase is spelled in CODE (`{ col: v }`, `{ col }`, `obj.col = v`), never
 * inside a string, so blanking literal contents removes the whole false-positive
 * class without touching a real write.
 */
function blankStringContents(code: string): string {
  return code
    .replace(/'(?:[^'\\\n]|\\.)*'/g, "''")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""')
    .replace(/`(?:[^`\\]|\\.)*`/g, '``');
}

/**
 * ⚠ KNOWN LIMITATION — A SPREAD WRITE IS INVISIBLE, AND MUST STAY THAT WAY.
 *
 * `vendor_bot_config.auto_accept_enabled` is written by a real, rendered control
 * (the vendor's auto-reply settings form) as:
 *
 *     .upsert({ vendor_profile_id, ...parsed.patch, updated_at })
 *
 * The column name never appears as a literal key, so no key-matching detector
 * can see it, and the guard reports the control as missing. That is crying wolf.
 *
 * 🔑 THE OBVIOUS FIX IS WORSE THAN THE BUG. Treating `...someVar` as "writes
 * every column of this table" would mark the whole of `vendor_bot_config` as
 * written and blind the guard to every genuine finding on it. A per-column
 * baseline line, with the spread named, is the honest cost — cheaper than a
 * detector that silently excuses a table.
 */
function namesColumnAsField(code: string, column: string): boolean {
  const codeOnly = blankStringContents(code);
  return (
    new RegExp(`\\b${column}\\b\\s*:`).test(codeOnly) ||
    new RegExp(`[{,]\\s*${column}\\s*[,}]`).test(codeOnly) ||
    new RegExp(`\\.${column}\\s*=[^=]`).test(codeOnly) ||
    new RegExp(`\\[['"\`]${column}['"\`]\\]\\s*=[^=]`).test(code)
  );
}

/** Exported function names declared in `code`. */
function exportedFunctions(code: string): string[] {
  const names: string[] = [];
  const re = /export\s+(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/g;
  const reConst = /export\s+const\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?\(/g;
  for (const m of code.matchAll(re)) names.push(m[1]!);
  for (const m of code.matchAll(reConst)) names.push(m[1]!);
  return names;
}

/**
 * The span of the first bracketed literal at/after `from`, brace-matched.
 * Returns '' when there is none within `lookahead` characters.
 *
 * 🔑 BRACE-MATCHED, NEVER BUDGETED. `[\s\S]{0,600}` reads past the payload's
 * closing brace into whatever follows — the `.select(...)` on the next line, the
 * next statement — so a file that writes the table and merely SELECTS the column
 * satisfies it. And a budget shrinks silently the moment somebody writes a long
 * comment inside the payload, which is how two guards in this repo passed while
 * the thing they guard was gone.
 */
function bracketedSpan(code: string, from: number, lookahead = 40): string {
  const after = code.slice(from);
  const open = after.search(/[[{(]/);
  if (open === -1 || open > lookahead) return '';
  const pairs: Record<string, string> = { '{': '}', '[': ']', '(': ')' };
  const openers = new Set(Object.keys(pairs));
  const closers = new Set(Object.values(pairs));
  let depth = 0;
  for (let i = open; i < after.length; i += 1) {
    const ch = after[i]!;
    if (openers.has(ch)) depth += 1;
    else if (closers.has(ch)) {
      depth -= 1;
      if (depth === 0) return after.slice(open, i + 1);
    }
  }
  return '';
}

/**
 * (c) Does this file write `column` ON `table` **IN THE SAME STATEMENT**?
 *
 * 🚨 THIS EXISTS BECAUSE (a) AND (b) JOINED BY `&&` WERE DECORATIVE, and the
 * guard they power is the one that catches a switch nobody can press — a
 * failure this codebase has now shipped SIX times.
 *
 * The old `direct` branch asked two INDEPENDENT file-level questions: does this
 * file write that table anywhere, and does it name that column as a field
 * anywhere. Never the same statement. Measured on `events.archived`: the
 * detector reported THREE writers where exactly one exists — `chat-actions.ts`
 * has a local variable of that name writing a DIFFERENT table, and `events.ts`
 * has it as a type field and in a select list. **Deleting the one real write
 * left the suite 10/10 GREEN.**
 *
 * 🔑 TWO CORRECT PREDICATES ANDED AT THE WRONG SCOPE ARE NOT A CORRECT
 * PREDICATE. Each half was carefully written and separately right; the join is
 * what made them blind.
 *
 * ⚠ BOUNDED BY BRACE-MATCHING THE PAYLOAD, NOT BY A CHARACTER BUDGET. A span
 * like `[\s\S]{0,600}` reads straight past the update object's closing brace
 * into the `.select(...)` on the next line — so a file that updates the table
 * and merely SELECTS the column still satisfies it, which is the same hole one
 * level down. A budget also silently shrinks the moment somebody writes a long
 * comment inside the payload.
 */
function writesColumnOnTable(code: string, table: string, column: string): boolean {
  // Every name this file uses to mean `table`: the literal, plus any
  // `const T = 'table'` alias — mirroring writesTable's own alias handling.
  const names = [`['"\`]${table}['"\`]`];
  for (const d of code.matchAll(
    new RegExp(`\\b(?:const|let|var)\\s+([A-Za-z_$][\\w$]*)\\s*=\\s*['"\`]${table}['"\`]`, 'g'),
  )) {
    names.push(`\\s*${d[1]!}\\s*`);
  }

  for (const alt of names) {
    const from = new RegExp(`\\.from\\(\\s*${alt}\\s*[,)]`, 'g');
    for (const m of code.matchAll(from)) {
      // The write verb must follow this `.from(...)`, with only chain calls
      // between — supabase-js requires `.from(t).update(...)` in that order.
      const rest = code.slice(m.index! + m[0].length);
      const verb = /^[\s\S]{0,200}?\.(?:update|insert|upsert)\(/.exec(rest);
      if (!verb) continue;

      /*
        The argument list, paren-matched so the span ENDS where the call ends.

        ⚠ TWO SHAPES, and missing the second is a FALSE "no writer" — which is
        the worse direction here. A guard that cries wolf about real code teaches
        the next person to baseline it, and a baseline is a bill. Measured: with
        only the literal shape, 26 columns newly reported no writer, and the ones
        spot-checked (`platform_settings.gcash_enabled`,
        `panood_control_state.is_live`) all had perfectly good writers that build
        the payload first.
      */
      const args = bracketedSpan(rest, verb[0].length - 1);
      if (!args) continue;

      // (i) inline object / array literal — `.update({ column: v })`
      if (args.includes('{') && namesColumnAsField(args, column)) return true;

      // (ii) a payload VARIABLE — `.update(payload)` — resolved to where it is
      // built: a literal assigned to it, or a later property assignment.
      for (const id of args.matchAll(/\b([A-Za-z_$][\w$]*)\b/g)) {
        const name = id[1]!;
        if (name === 'onConflict' || name === 'ignoreDuplicates') continue;
        /*
          EVERY declaration of that name, not the first. `matchAll`, because a
          single file routinely declares `const payload = { … }` in two separate
          actions — `admin/settings/actions.ts` has one at line 104 and another
          at 223, and only the SECOND carries `gcash_enabled`. An `.exec` here
          found the first, saw no column, and reported a live admin toggle as
          having no writer at all.
        */
        for (const decl of code.matchAll(
          new RegExp(`\\b(?:const|let|var)\\s+${name}\\b[^=]{0,120}=\\s*`, 'g'),
        )) {
          const built = bracketedSpan(code, decl.index! + decl[0].length, 4);
          if (built && namesColumnAsField(built, column)) return true;
        }
        // `Object.assign(payload, { … })` — a payload extended after it is built.
        for (const asg of code.matchAll(
          new RegExp(`Object\\.assign\\(\\s*${name}\\s*,`, 'g'),
        )) {
          const built = bracketedSpan(code, asg.index! + asg[0].length, 4);
          if (built && namesColumnAsField(built, column)) return true;
        }
        if (namesColumnAsField(`{${name}.${column} = 1}`, column) &&
            new RegExp(`\\b${name}\\.${column}\\s*=[^=]`).test(code)) return true;
        if (new RegExp(`\\b${name}\\[['\"\`]${column}['\"\`]\\]\\s*=[^=]`).test(code)) return true;
      }
    }
  }
  return false;
}

/**
 * Files that could be what flips `table.column`.
 *
 * Two paths, both required to pair a table-write with a field-name:
 *
 *  DIRECT — one file both writes the table and names the column.
 *
 *  VIA A HELPER — the write lives in a small module (`writeControlStateAdmin`)
 *    and the caller supplies the field. Matched on the helper's EXPORTED
 *    FUNCTION NAME, never on its filename: an early cut keyed on the file's
 *    basename, and since dozens of writers are called `actions.ts`, the
 *    substring "actions" matched nearly every file in the repo and would have
 *    silently excused every real finding. A loose writer-detector does not cry
 *    wolf — it goes quiet, which is worse.
 */
export function gateWritersOf(sources: Source[], table: string, column: string): string[] {
  const direct = sources
    .filter((s) => s.code.includes(column))
    // SAME STATEMENT, not "somewhere in this file and somewhere else in this
    // file" — see writesColumnOnTable for what the `&&` at file scope cost.
    .filter((s) => writesColumnOnTable(s.code, table, column))
    .map((s) => s.path);
  if (direct.length > 0) return direct;

  const helpers = new Set<string>();
  for (const s of sources) {
    if (!writesTable(s.code, table)) continue;
    for (const fn of exportedFunctions(s.code)) helpers.add(fn);
  }
  if (helpers.size === 0) return [];

  /*
    🚨 THE COLUMN MUST BE IN THE HELPER CALL'S ARGUMENTS, not merely somewhere in
    the same file. The old form asked two file-level questions again — "does this
    file name the column anywhere" and "does it call any exported function from
    any file that writes this table anywhere" — and dozens of files write
    `events`, so it degenerated into "mentions the column and calls something".
    Measured: with the one real writer of `events.archived` sabotaged, it
    returned SIX files, none of which write that column, and the suite stayed
    green. Same fault as the direct branch, one level of indirection along.
  */
  return sources
    .filter((s) => s.code.includes(column) && namesColumnAsField(s.code, column))
    .filter((s) =>
      [...helpers].some((fn) => {
        for (const m of s.code.matchAll(new RegExp(`\\b${fn}\\s*\\(`, 'g'))) {
          const args = bracketedSpan(s.code, m.index! + m[0].length - 1);
          if (args && namesColumnAsField(args, column)) return true;
        }
        return false;
      }),
    )
    .map((s) => s.path);
}

/** Is the column referred to anywhere at all? Distinguishes a live gate from dead schema. */
export function isMentioned(sources: Source[], column: string): boolean {
  const re = new RegExp(`\\b${column}\\b`);
  return sources.some((s) => re.test(s.code));
}

/**
 * THE MIRROR CLASS: a HANDLE WITH NO GATE.
 *
 * `gateWritersOf` answers "can anything switch this on?". That is the right
 * question for a switch and it is only half the shape. The other half shipped
 * live and was found on 2026-08-17, by accident, while chasing something else:
 *
 *   `users.planner_mode` is written by a real, rendered control — the profile
 *   page's Guided / DIY choice — and the copy beside it promises "Guided shows
 *   the 9-step checklist on your Overview tab. DIY hides it". The column has
 *   FIVE references in the whole repo and all five are that page and its own
 *   action. Nothing on the Overview reads it. So a couple who picks DIY to hide
 *   the checklist still sees it, and Guided grants nothing.
 *
 * 🔑 TO A PERSON, BOTH SHAPES ARE THE SAME BUG: the setting does nothing. A
 * writer-less column can't be turned on; a reader-less one turns on nothing.
 * The existing guard is structurally blind to the second — `planner_mode` IS
 * written, so it passes.
 *
 * ── WHY "OUTSIDE THE WRITER'S OWN DIRECTORY" IS THE TEST ────────────────────
 * Not "is it selected anywhere" — `planner_mode` IS selected, by the very page
 * that writes it, to render which option is currently ticked. That read is real
 * and proves nothing about whether the setting DOES anything.
 *
 * A switch that genuinely works has a consumer somewhere else: the couple's
 * Papic card writes the photo-wall choice and the GUEST surfaces read it; an
 * admin writes the founder flag and the BENEFIT logic reads it. So the question
 * is whether any file outside the writing surface names the column at all —
 * deliberately generous, because a read may be a `.select()` in a loader and the
 * consumption a property access in a component three files away, and a detector
 * that demanded both in one file would cry wolf constantly.
 *
 * ⚠ A HIT IS A CANDIDATE, NOT A VERDICT. "Read only by its own surface" is
 * perfectly legitimate when the effect IS on that surface. It is a defect only
 * when the control PROMISES an effect somewhere else — which is a copy question
 * a human has to answer. That is exactly why this returns the candidates and a
 * baseline records the judgement, rather than failing on the shape alone.
 */
export function switchReadersOutsideWriter(
  sources: Source[],
  table: string,
  column: string,
): { writers: string[]; readersElsewhere: string[] } {
  const writers = gateWritersOf(sources, table, column);
  if (writers.length === 0) return { writers, readersElsewhere: [] };

  const writerDirs = [...new Set(writers.map((w) => w.replace(/\/[^/]+$/, '')))];
  const mentions = new RegExp(`\\b${column}\\b`);
  const readersElsewhere = sources
    .filter((s) => mentions.test(s.code))
    .map((s) => s.path)
    .filter((p) => {
      const dir = p.replace(/\/[^/]+$/, '');
      // Outside every writing directory, and not inside a subtree of one.
      return !writerDirs.some((d) => dir === d || dir.startsWith(`${d}/`));
    });
  return { writers, readersElsewhere };
}
