'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { claimCommandKey } from '@/lib/command-key-claim';
import { rankBySentence } from '@/lib/admin-map/rank-by-sentence';
import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';
import type { AdminJob } from '@/lib/admin-map/scan-admin-jobs';
import { matchJobs, jobDisplayLabel } from '@/lib/admin-map/match-job';
import {
  humanizeFieldLabel,
  fieldKind,
  askParamKey,
  ADMIN_ASK_PARAM,
  jobNameFromAskHref,
} from '@/lib/admin-map/humanize-field';
import { jobPrefillIsRead } from '@/lib/admin-map/prefill-consumers';
import { buildNavRows, hitOffsetOf, shouldOfferAssistant } from '@/lib/admin-map/palette-nav';
import {
  toAdminRecordRows,
  MIN_RECORD_QUERY_LENGTH,
  RECORD_SEARCH_DEBOUNCE_MS,
  type AdminRecordRow,
} from '@/lib/admin-map/admin-record-rows';
import { fetchUgatSearch } from '../ugat/actions';

import { askTheAdmin, type AskAnswer } from './ask-actions';
import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';

import { buildDestinations, type Dest, type RowDest } from './admin-destinations';

/**
 * A job hiding inside an href, the way a page-destination hides in one, is read
 * by the SHARED `jobNameFromAskHref` — imported above, not re-declared here.
 *
 * The AI is handed FORM-DRIVEN JOBS as extra choices (see `ask()` below), each
 * offered as `${resolvedPath}?admin_ask=<jobName>` — a real, known admin route,
 * so `isKnownAdminHref` on the server accepts it exactly like any other page.
 * Reading the marker back out is what lets a resolved answer that names a job
 * open the ask-form instead of just navigating.
 *
 * 🔑 IT USED TO BE PRIVATE TO THIS FILE, and this file is `'use client'` — so
 * the ranker, which now has to know whether a candidate can fill a form, could
 * not import it and would have needed its own copy of the same rule.
 */

/**
 * Cap the ask-form at a sane number of questions. Measured, not guessed: only
 * two jobs exceed this (`saveUnclaimedVendorProfile`, `upsertEventTypeProfile`,
 * both 9 fields) — they still open, just with their last field or two filled
 * on the page itself, same as any field this box never asked about.
 */
const MAX_ASK_FIELDS = 8;

/**
 * AdminCommandPalette — ⌘K / Ctrl-K, type three letters, go.
 *
 * WHY: the admin is a large tree behind a sidebar the owner locked to six flat
 * doorways (2026-07-15, "solid menu with no submenus"). A short menu is only
 * safe if the long tail is reachable by NAME — otherwise finding a page depends
 * on remembering which drawer it lives in. This is that.
 *
 * 🔑 A SHORTCUT, NEVER THE ONLY DOOR. Everything here is also browsable at
 * /admin/more ("All surfaces"), which is why this may be keyboard-only and
 * unlabelled without stranding anything. If a destination is EVER reachable
 * only by typing, that is a bug in the menu, not a feature of this.
 *
 * 🪤 THIS DOCBLOCK USED TO SAY IT "indexes all 108 admin surfaces". It indexed
 * the MENU — 78 items — and the menu is smaller than the tree, so seven real
 * pages were reachable only by knowing their URL and ~40 moved pages could not
 * be found under the address people still type. The destination list now comes
 * from admin-destinations.ts, which joins the menu with a SCANNED map of the
 * route tree. Corrected here rather than deleted, because the claim was the
 * reason nobody looked.
 */

/**
 * The NAME always wins, then the meaning.
 *   100 name starts with · 60− name contains · 15 description/alias hit
 *   · 8 letters of the name in order · 0 no match
 * Ordering matters as much as matching: typing "pay" must land on Payments
 * before every page whose description happens to mention paying.
 */
function score(d: Dest, needle: string): number {
  if (!needle) return 1;
  const l = d.label.toLowerCase();
  let raw = 0;
  const i = l.indexOf(needle);
  if (i === 0) raw = 100;
  else if (i > 0) raw = Math.max(20, 60 - i);
  else if (d.hay.includes(needle)) raw = 15;
  else {
    let p = 0;
    for (let c = 0; c < l.length && p < needle.length; c++) if (l[c] === needle[p]) p++;
    raw = p === needle.length ? 8 : 0;
  }
  // A page the map found is worth offering and is never worth REORDERING the
  // curated menu for. Halving keeps the bands apart in both directions: an exact
  // name match on an unlisted page (50) still beats a vague description hit on a
  // menu page (15), and never beats the menu page with the same name (100).
  // Bands: the curated menu at full strength, a scanned page at half, a row
  // inside a page at a third. A row must never outrank the page that holds it
  // for a vague query — it wins only when its own words are what you typed.
  if (d.source === 'map') return raw / 2;
  if (d.source === 'row') return raw / 3;
  return raw;
}

export function AdminCommandPalette({ rows = [] }: { rows?: readonly RowDest[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  const all = useMemo(() => buildDestinations(rows), [rows]);
  /**
   * A SENTENCE, not just a word. The old line here scored the whole typed string
   * as one needle, so "papic prices" — two words — returned nothing at all, and
   * so did every sentence the owner tried. rankBySentence keeps today's
   * whole-string score as the FIRST sort key, so nothing that already answers
   * changes; the per-word evidence only breaks ties and rescues zeroes. `score`
   * below is passed in untouched, which is what makes that guarantee checkable.
   */
  const { hits, unknown } = useMemo(
    () => rankBySentence(all, q, score, 30),
    [all, q],
  );

  /**
   * A JOB the sentence names, offered next to the pages it names. See
   * `match-job.ts` — coverage-gated, so "papic" alone never suggests a form.
   */
  const jobHits = useMemo(() => matchJobs(ADMIN_JOBS, q, 3), [q]);

  /**
   * THE RECORDS THEMSELVES — a guest, a shop, a celebration, an account.
   *
   * 🔴 WHAT THIS CLOSES. The owner ruled that an admin must be able to find any
   * guest by name across every celebration. That search was built and works —
   * and it lives inside the Entity map console at `/admin/ugat/map`, a page you
   * have to already know about. THIS box, the one he asked for by name after
   * saying *"i do not see the AI searchbar"*, searched no record at all:
   * measured, its only reads are the retail catalog and the learned-phrase
   * memory, so its corpus is the menu, the scanned routes, the job vocabulary
   * and the SKU list. Typing a guest's name here returned nothing, and the
   * assistant could not rescue it — every href it answers with is re-validated
   * against the route map, so it can only ever return a PAGE.
   *
   * 🔑 IT CALLS THE SHIPPED SEARCH, AND WRITES NO SECOND ONE. `fetchUgatSearch`
   * opens with `requireAdminAction()` and carries the reviewed ILIKE sanitiser,
   * the `deleted_at is null` filter and the guest privacy fence. A search
   * written here would be a second copy of all four, free to drift from the
   * one that was actually reviewed — and this reads with the SERVICE ROLE, so
   * that app-side gate is the entire fence.
   *
   * ⚖ DESKTOP ONLY, by the owner's ruling — mobile is for answering requests
   * and confirming decisions. That is already structural rather than asserted
   * here: the visible box is `hidden … lg:flex` and the only other way in is
   * ⌘K, which needs a keyboard.
   */
  const [records, setRecords] = useState<AdminRecordRow[]>([]);

  useEffect(() => {
    const term = q.trim();
    if (term.length < MIN_RECORD_QUERY_LENGTH) {
      setRecords([]);
      return;
    }
    /*
      One in-flight answer per keystroke. `cancelled` is what makes a slow
      response for "mar" unable to overwrite a fast one for "maria" — the
      effect re-runs on every change of `q`, so the previous request is
      disowned before the next is sent. Without it the box can settle on the
      results of a query nobody is looking at any more.
    */
    let cancelled = false;
    const timer = setTimeout(() => {
      void fetchUgatSearch(term).then(
        (groups) => {
          if (!cancelled) setRecords(toAdminRecordRows(groups));
        },
        // A refused or failed read shows no records rather than stale ones.
        // The page and job hits above are unaffected: the box keeps working as
        // a navigator even when the database cannot be reached.
        () => {
          if (!cancelled) setRecords([]);
        },
      );
    }, RECORD_SEARCH_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [q]);

  /**
   * THE BUG THIS CLOSES: the owner typed the spec's own flagship example —
   * "add a new category on the taxonomy service" — and the box just opened
   * Taxonomy. `hits` is never empty for that query (the literal word
   * "taxonomy" is a page name), so the old `hits.length === 0` gate could
   * never reach step 3 (`ask-the-admin.ts`) for the exact case it exists to
   * bridge — a page's OWN vocabulary was shadowing the assistant. This is
   * offered only when (a) no deterministic job already answered it — a real
   * job match is strictly better and needs no AI — and (b) the sentence has
   * enough words to be describing a task rather than naming a page. It is
   * additive: the top page hit and Enter-to-navigate are both unchanged.
   */
  const showAskEscapeHatch = shouldOfferAssistant({
    hitCount: hits.length,
    jobHitCount: jobHits.length,
    query: q,
  });

  /**
   * The ask-form — gathering answers, never pressing the button.
   *
   * 🔒 THIS IS THE WHOLE SAFETY CLAIM: everything below writes into LOCAL
   * STATE and, once "Prepare form" is pressed, into a URL query string. No
   * server action is ever called from here — the real `createCanonicalLeaf`
   * (or whichever action the job names) fires only when the admin presses the
   * REAL button on the REAL page, exactly as the one-person admin plan
   * requires (2026-07-11): the machine prepares and holds back.
   */
  const [askJob, setAskJob] = useState<AdminJob | null>(null);
  const [askValues, setAskValues] = useState<Record<string, string>>({});

  const openJobAsk = useCallback((job: AdminJob) => {
    setAskJob(job);
    setAskValues({});
    setAsked(null);
  }, []);

  const askJobFields = useMemo(
    () => (askJob ? askJob.fields.slice(0, MAX_ASK_FIELDS) : []),
    [askJob],
  );

  /** Whether this job's destination actually READS the answers back. See
   *  prefill-consumers.ts — the panel must not promise a fill that never
   *  happens. */
  const askJobPrefills = askJob ? jobPrefillIsRead(askJob.name) : false;

  /**
   * Whether the door out of this panel is held shut by a missing answer.
   *
   * Measured: no job today lists a boolean field as required
   * (`refusedWhenEmpty`). Booleans are excluded anyway, on purpose — an
   * unchecked box IS a legitimate "false", not an empty answer, so a required
   * boolean must never be able to block the button.
   *
   * ⚠ AND ONLY WHEN THERE IS SOMETHING TO ANSWER. A job whose page does not
   * read the answers shows no inputs at all, so every required field is empty
   * by construction — applying this check to it would disable its own door
   * permanently.
   *
   * Hoisted out of the JSX deliberately: `admin-job-ask-form.test.ts` pins that
   * the prepare button's onClick only ever builds a href and pushes it, and it
   * reads a window of source before the label to do so. Growing the button's
   * attributes starves that window and turns a real safety guard red.
   */
  const prepareBlocked =
    askJob != null &&
    askJobPrefills &&
    askJob.refusedWhenEmpty.some((f) => fieldKind(f) !== 'boolean' && !askValues[f]);

  /** `resolvedPath` + a marker + one `aa_<field>` per non-empty answer. Empty
   *  fields are simply omitted — the target form's own default stands, same
   *  as if the admin had never touched that input. */
  const buildJobHref = useCallback((job: AdminJob, values: Record<string, string>): string => {
    const [path, existingQs] = job.resolvedPath.split('?');
    const params = new URLSearchParams(existingQs ?? '');
    params.set(ADMIN_ASK_PARAM, job.name);
    for (const field of job.fields) {
      const v = values[field];
      if (v !== undefined && v !== '') params.set(askParamKey(field), v);
    }
    return `${path}?${params.toString()}`;
  }, []);

  /**
   * The escape hatch, and the only place a model is ever reached.
   *
   * 🔑 IT IS OFFERED, NEVER AUTOMATIC. Nothing here fires while the free word
   * matching has an answer — which is nearly always — so the ordinary day costs
   * ₱0. A phrase it has been taught before never reaches a model either: the
   * action looks that up first. The button appears when the box would
   * otherwise say "nothing" — and, secondary and below the top hit, when the
   * box found a page only by an accident of vocabulary while the sentence
   * still reads as a task (`showAskEscapeHatch` above).
   */
  const [asking, setAsking] = useState(false);
  const [asked, setAsked] = useState<AskAnswer | null>(null);

  const ask = useCallback(async () => {
    setAsking(true);
    setAsked(null);
    try {
      const choices = all
        .filter((d) => d.source !== 'row')
        .map((d) => ({ label: d.label, href: d.href }));
      // Form-driven jobs are offered too, under the SAME shape (label + a real
      // admin href) — the model can choose a job exactly like a page, and
      // `isKnownAdminHref` accepts it because `resolvedPath` is a real route.
      const jobChoices = ADMIN_JOBS.filter((j) => j.fields.length > 0).map((j) => ({
        label: jobDisplayLabel(j),
        href: buildJobHref(j, {}),
      }));
      setAsked(await askTheAdmin(q, [...choices, ...jobChoices]));
    } catch {
      setAsked({ ok: false, reason: 'unavailable' });
    } finally {
      setAsking(false);
    }
  }, [all, q, buildJobHref]);

  const close = useCallback(() => {
    setOpen(false);
    setQ('');
    setSel(0);
    setAsked(null);
    setAsking(false);
    setAskJob(null);
    setAskValues({});
  }, []);

  /**
   * Shared by both places an assistant answer can be clicked — the primary
   * "nothing matched" panel and the secondary offer beside a real page hit.
   * An answer naming a job opens the ask-form (still the person who presses
   * the real button); anything else is an ordinary page navigation.
   */
  const openAnswer = useCallback(
    (answer: { href: string }) => {
      const jobName = jobNameFromAskHref(answer.href);
      const job = jobName ? ADMIN_JOBS.find((j) => j.name === jobName) : null;
      if (job) {
        openJobAsk(job);
        return;
      }
      close();
      router.push(answer.href);
    },
    [openJobAsk, close, router],
  );

  /**
   * THE ASK OFFER IS A ROW, NOT A FOOTNOTE — and this is the fix.
   *
   * 🔴 WHAT WENT WRONG. The offer was rendered AFTER every page hit, inside a
   * 430px scroller. Measured for the owner's own sentence — "add a new category
   * on the taxonomy service" — the box returns 16 hits under 15 group headers,
   * putting the offer roughly two and a half screens down. It was in neither the
   * arrow-key ring nor the Enter path, both of which indexed `hits` alone. So
   * the owner repeated his gesture, pressed Enter, and got the same navigation
   * to Taxonomy that he was complaining about. **A fix nobody can reach is no
   * fix** — the fourth time this project has written that sentence down.
   *
   * The rows below are the ONE list both the keyboard and the renderer walk, in
   * the order they appear on screen. Keeping them in one array is the point: two
   * lists is how a visible row ends up unreachable in the first place.
   *
   * ⚖ THE OFFER IS FIRST, AND THEREFORE DEFAULT-SELECTED (`sel` resets to 0 on
   * every keystroke). A person who typed a SENTENCE described a task, not a
   * page; nothing matched deterministically, so confidence in the top page is
   * low; and reaching the page is one arrow press. **This is a product call and
   * it is reversible in one line** — drop the ask row from this array and it
   * goes back to being an extra row nobody has to use.
   *
   * 🔒 UNCHANGED FOR EVERY ORDINARY LOOKUP. `showAskEscapeHatch` is false for
   * short, noun-shaped queries ("papic pricing", "taxonomy", "pending"), so this
   * array IS `hits` and every index, key and Enter target is what it was.
   */
  const askRowSelectable = showAskEscapeHatch && !(asked !== null && !asked.ok);

  const navRows = useMemo(
    () => buildNavRows(askRowSelectable, hits, records),
    [askRowSelectable, hits, records],
  );

  /**
   * How far the page hits are pushed down by the ask row, so the highlight and
   * the thing Enter opens can never drift apart.
   *
   * 🔑 COUNTED OFF `navRows`, NEVER RE-DERIVED FROM `askRowSelectable`. Written
   * as its own `askRowSelectable ? 1 : 0` it was a SECOND opinion about the
   * same fact, and a measured mutation to a bare `0` left all 156 admin tests
   * green while every page row highlighted one place away from the row Enter
   * opened. Reading it back off the list makes that disagreement unwritable.
   */
  const hitOffset = hitOffsetOf(navRows);

  /** What pressing Enter on the ask row does, which depends on how far the
   *  assistant has got: ask it, or open what it already answered. */
  const activateAskRow = useCallback(() => {
    if (asked?.ok) {
      openAnswer(asked.answer);
      return;
    }
    if (!asking) void ask();
  }, [asked, asking, ask, openAnswer]);

  // The SHARED focus contract, not a hand-rolled one: trap Tab inside the
  // dialog while open, close on Escape, and restore focus to whatever opened it.
  // modal-a11y-adoption.test.ts refuses any element claiming `aria-modal`
  // without routing through here — my first draft only RESTORED focus and was
  // correctly rejected. Restoring is not trapping.
  useModalA11y({ open, onClose: close, containerRef: dialogRef });

  /*
    ⌘K IS OURS ON THIS DOORWAY (One top bar, 2026-08-14). The shared top bar
    now mounts a palette over the person's own events on every signed-in
    surface, this one included — and two ⌘K listeners open two stacked dialogs
    with nothing thrown. This palette indexes every admin destination — the
    menu plus the scanned route map — which the shared one cannot see, so it
    keeps the shortcut here and the shared one
    stands down. Pressing the bar's search box still opens the shared palette,
    so neither control is ever dead.
  */
  useEffect(() => claimCommandKey(), []);

  /**
   * The visible box opens this same panel.
   *
   * 🔴 Until 2026-08-26 there was no way in but ⌘K, and the owner — the only
   * person who uses this console — said plainly: *"i do not see the AI
   * searchbar."* A shortcut nobody was told about is not a door.
   */
  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpen);
    return () => window.removeEventListener(ADMIN_SEARCH_OPEN_EVENT, onOpen);
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) {
        e.preventDefault();
        if (open) close();
        else setOpen(true);
        return;
      }
      if (!open) return;
      // The ask-form has its own text inputs and its own Prepare/Cancel
      // buttons — the results-navigation keys must not fight typing in them.
      if (askJob) return;
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSel((s) => (navRows.length ? (s + 1) % navRows.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (navRows.length ? (s - 1 + navRows.length) % navRows.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        // ONE list for the ring and for Enter. Reading `hits[sel]` here — which
        // is what shipped — made the ask row unreachable by the only gesture
        // the owner actually uses.
        const target = navRows[sel];
        if (!target) return;
        if (target.kind === 'ask') {
          activateAskRow();
          return;
        }
        close();
        // ONE list, so a found RECORD opens on Enter exactly like a page does.
        // Records that render but cannot be reached by the keyboard would be
        // the same defect the ask row already had here.
        router.push(target.kind === 'record' ? target.record.href : target.dest.href);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, navRows, sel, close, router, askJob, activateAskRow]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);
  useEffect(() => {
    setSel(0);
    // A new question is not the old question's answer, and typing a new
    // query means the admin left whatever job they were being asked about.
    setAsked(null);
    setAskJob(null);
    setAskValues({});
  }, [q]);

  if (!open) return null;

  /**
   * The words nothing knows, said out loud.
   *
   * 🔑 WITHOUT THIS THE BOX LIES BY OMISSION. "papic prices" resolves on "papic"
   * alone and opens *Papic storage* — a real page, and not the prices. The Papic
   * PRICES are rows inside a page and this map indexes pages, so the truthful
   * answer is "no page has the word prices", not a confident near-miss.
   */
  const unknownNote =
    unknown.length > 0 && hits.length > 0
      ? `No page has ${unknown.length === 1 ? 'the word' : 'the words'} ${unknown
          .map((w) => `“${w}”`)
          .join(', ')}.`
      : null;

  let lastGroup = '';
  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-ink/30"
        onClick={close}
        aria-hidden
      />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search every admin page"
        className="fixed left-1/2 top-[11vh] z-[61] w-[min(620px,calc(100vw-2rem))] -translate-x-1/2 overflow-hidden rounded-xl border shadow-2xl"
        style={{ borderColor: 'var(--sn-line)', background: 'var(--sn-paper, #FFFFFF)' }}
      >
        <div
          className="flex items-center gap-3 border-b px-4 py-3.5"
          style={{ borderColor: 'var(--sn-line-soft, #F1ECE3)' }}
        >
          <Search aria-hidden className="h-4 w-4 shrink-0" style={{ color: 'var(--sn-ink-500)' }} />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Go to… payouts, taxonomy, secrets, venues"
            className="flex-1 bg-transparent text-base outline-none"
            autoComplete="off"
            spellCheck={false}
          />
          <kbd className="rounded border px-1.5 py-0.5 font-mono text-[10px] font-bold"
            style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink-500)' }}>esc</kbd>
        </div>

        <div className="max-h-[min(58vh,430px)] overflow-auto p-1.5">
          {askJob ? (
            <div className="p-2">
              <p className="px-1 pb-1 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]"
                style={{ color: 'var(--sn-ink-500)' }}>
                {jobDisplayLabel(askJob)}
              </p>
              {/*
                🔑 ONLY PROMISE WHAT THE DESTINATION ACTUALLY DOES. Measured over
                the shipped tree: exactly ONE page reads these answers back, for
                exactly ONE job. For the other 184 this panel gathered up to
                eight answers, said "the page opens with this filled in", and
                opened a page that never looked — the admin retyped everything,
                with no error to blame. So a job whose answers nothing reads is
                not asked questions at all; it is shown what its form will want
                and a door to the page. Registry + its derived guard:
                lib/admin-map/prefill-consumers.ts.
              */}
              <p className="px-1 pb-3 text-[12px]" style={{ color: 'var(--sn-ink-500)' }}>
                {askJobPrefills
                  ? 'Answer what you know — the rest stays blank on the form. Nothing is submitted here; the page opens with this filled in and you press the real button.'
                  : 'This page does not fill itself in yet, so there is nothing to answer here. Here is what its form will ask you for — open it and fill it in there. Nothing is submitted either way.'}
              </p>
              {!askJobPrefills ? (
                <ul className="space-y-1 px-1">
                  {askJobFields.map((field) => (
                    <li key={field} className="text-[12.5px]" style={{ color: 'var(--sn-ink)' }}>
                      · {humanizeFieldLabel(field)}
                      {askJob.refusedWhenEmpty.includes(field) ? (
                        <span className="ml-1 font-mono text-[10px]" style={{ color: 'var(--sn-ink-500)' }}>required</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              ) : null}
              {askJobPrefills ? (
              <div className="space-y-2.5 px-1">
                {askJobFields.map((field) => {
                  const required = askJob.refusedWhenEmpty.includes(field);
                  const label = humanizeFieldLabel(field);
                  if (fieldKind(field) === 'boolean') {
                    return (
                      <label key={field} className="flex items-center gap-2 text-[13px]" style={{ color: 'var(--sn-ink)' }}>
                        <input
                          type="checkbox"
                          checked={askValues[field] === '1'}
                          onChange={(e) =>
                            setAskValues((v) => ({ ...v, [field]: e.target.checked ? '1' : '' }))
                          }
                          className="h-3.5 w-3.5"
                        />
                        {label}
                      </label>
                    );
                  }
                  return (
                    <label key={field} className="block text-[12px]" style={{ color: 'var(--sn-ink-500)' }}>
                      {label}
                      {required ? <span aria-hidden> *</span> : null}
                      <input
                        value={askValues[field] ?? ''}
                        onChange={(e) => setAskValues((v) => ({ ...v, [field]: e.target.value }))}
                        className="mt-0.5 w-full rounded-md border px-2 py-1.5 text-[13px]"
                        style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink)' }}
                        aria-required={required}
                      />
                    </label>
                  );
                })}
              </div>
              ) : null}
              <div className="mt-4 flex items-center gap-2 px-1">
                <button
                  type="button"
                  onClick={() => setAskJob(null)}
                  className="rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold"
                  style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink-500)' }}
                >
                  Back
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const href = buildJobHref(askJob, askValues);
                    close();
                    router.push(href);
                  }}
                  disabled={prepareBlocked}
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--sn-mulberry-600, #C24E25)' }}
                >
                  <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                  {askJobPrefills ? 'Prepare the form' : 'Open the page'}
                </button>
              </div>
            </div>
          ) : (
            <>
          {jobHits.length > 0 ? (
            <div className="mx-1.5 mb-1 mt-1 space-y-1">
              {jobHits.map((j) => (
                <button
                  key={j.job.name}
                  type="button"
                  onClick={() => openJobAsk(j.job)}
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] font-semibold"
                  style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink)' }}
                >
                  <Sparkles aria-hidden className="h-3 w-3 shrink-0" style={{ color: 'var(--sn-gold, #A9834B)' }} strokeWidth={2} />
                  <span>{j.label}</span>
                  <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--sn-ink-500)' }}>
                    {jobPrefillIsRead(j.job.name) ? 'fill in a form' : 'open the page'}
                  </span>
                </button>
              ))}
            </div>
          ) : null}
          {/*
            THE FLAGSHIP EXAMPLE, IN THE SLOT IT HAS TO BE IN. "add a new
            category on the taxonomy service" always finds the Taxonomy PAGE —
            its own name is a literal word in the query — so this can never be
            reached by waiting for a "nothing matched" state. It renders HERE,
            first and above the page hits, in the same shape as a matched job
            row, and it is `navRows[0]`, so ↑↓ reach it and ↵ activates it.
            Rendering it below the hits (which is what shipped) put it ~966px
            down a 430px scroller and outside both key paths.
          */}
          {showAskEscapeHatch ? (
            <div className="mx-1.5 mb-1 mt-1">
              {asked?.ok ? (
                <button
                  type="button"
                  onMouseMove={() => setSel(0)}
                  onClick={() => openAnswer(asked.answer)}
                  className="flex w-full items-start gap-2 rounded-md border px-2.5 py-1.5 text-left"
                  style={{
                    borderColor: 'var(--sn-line)',
                    ...(sel === 0 ? { background: 'var(--sn-paper-2, #F5EEE1)' } : {}),
                  }}
                >
                  <Sparkles aria-hidden className="mt-0.5 h-3 w-3 shrink-0" style={{ color: 'var(--sn-gold, #A9834B)' }} strokeWidth={2} />
                  <span>
                    <span className="block text-[12.5px] font-semibold" style={{ color: 'var(--sn-ink)' }}>
                      {asked.answer.label}
                    </span>
                    <span className="block text-[11px]" style={{ color: 'var(--sn-ink-500)' }}>
                      {asked.answer.because}
                    </span>
                  </span>
                </button>
              ) : asked && !asked.ok ? (
                <p className="px-2.5 py-1.5 text-[11.5px]" style={{ color: 'var(--sn-ink-500)' }}>
                  {asked.reason === 'unavailable'
                    ? 'The assistant is not switched on here.'
                    : 'It could not place that one either.'}
                </p>
              ) : (
                <button
                  type="button"
                  onMouseMove={() => setSel(0)}
                  onClick={activateAskRow}
                  disabled={asking}
                  className="flex w-full items-center gap-2 rounded-md border px-2.5 py-1.5 text-left text-[12.5px] font-semibold disabled:opacity-50"
                  style={{
                    borderColor: 'var(--sn-line)',
                    color: 'var(--sn-ink)',
                    ...(sel === 0 ? { background: 'var(--sn-paper-2, #F5EEE1)' } : {}),
                  }}
                >
                  <Sparkles aria-hidden className="h-3 w-3 shrink-0" style={{ color: 'var(--sn-gold, #A9834B)' }} strokeWidth={2} />
                  <span>{asking ? 'Thinking…' : `Walk me through “${q.trim()}”`}</span>
                  <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--sn-ink-500)' }}>ask Setnayan</span>
                </button>
              )}
            </div>
          ) : null}
          {unknownNote ? (
            <p
              className="mx-1.5 mb-1 mt-1 rounded-md px-2.5 py-1.5 text-[11.5px]"
              style={{ background: 'var(--sn-sunk, #F4F2EC)', color: 'var(--sn-ink-500)' }}
            >
              {unknownNote}
            </p>
          ) : null}
          {hits.length === 0 ? (
            <div className="px-3 py-6 text-center text-sm" style={{ color: 'var(--sn-ink-500)' }}>
              <p>
                Nothing matches “{q}”. Everything is also browsable under{' '}
                <span className="whitespace-nowrap">All surfaces</span>.
              </p>
              {asked?.ok ? (
                <button
                  type="button"
                  onClick={() => openAnswer(asked.answer)}
                  className="mt-3 w-full rounded-lg border px-3 py-2.5 text-left"
                  style={{ borderColor: 'var(--sn-line)' }}
                >
                  <span className="block text-[13px] font-semibold" style={{ color: 'var(--sn-ink)' }}>
                    {asked.answer.label}
                  </span>
                  <span className="block text-[11.5px]">{asked.answer.because}</span>
                  {asked.answer.from === 'remembered' ? (
                    <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em]">
                      remembered · free
                    </span>
                  ) : (
                    <span className="mt-1 block font-mono text-[9.5px] uppercase tracking-[0.14em]">
                      learned just now · free from here on
                    </span>
                  )}
                </button>
              ) : asked && !asked.ok ? (
                <p className="mt-3 text-[12px]">
                  {asked.reason === 'unavailable'
                    ? 'The assistant is not switched on here.'
                    : 'It could not place that one either.'}
                </p>
              ) : (
                <button
                  type="button"
                  onClick={ask}
                  disabled={asking || q.trim().length < 3}
                  className="mt-3 rounded-lg border px-3 py-1.5 text-[12.5px] font-semibold disabled:opacity-50"
                  style={{ borderColor: 'var(--sn-line)', color: 'var(--sn-ink)' }}
                >
                  {asking ? 'Thinking…' : 'Ask Setnayan where this lives'}
                </button>
              )}
            </div>
          ) : (
            <>
              {hits.map((d, i) => {
                const header = d.group !== lastGroup ? ((lastGroup = d.group), d.group) : null;
                // The ask row, when shown, is navRows[0] — so page hit `i` is
                // navRows[i + 1]. Without this offset the highlight and the row
                // Enter opens would be one apart, which is its own live bug.
                const navIndex = i + hitOffset;
                return (
                  <div key={d.href + d.label}>
                    {header ? (
                      <p className="px-3 pb-1 pt-2.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: 'var(--sn-ink-500)' }}>{header}</p>
                    ) : null}
                    <button
                      type="button"
                      onMouseMove={() => setSel(navIndex)}
                      onClick={() => {
                        close();
                        router.push(d.href);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold"
                      style={navIndex === sel ? { background: 'var(--sn-paper-2, #F5EEE1)' } : undefined}
                    >
                      <span>{d.label}</span>
                      <span className="ml-auto truncate font-mono text-[10.5px]"
                        style={{ color: 'var(--sn-ink-500)' }}>{d.group}</span>
                    </button>
                  </div>
                );
              })}

              {/*
                THE RECORDS THEMSELVES — the guest, the shop, the celebration.
                Rendered AFTER the pages and in the same list the keyboard
                walks, so `navIndex` below is the real index in `navRows`
                rather than a second opinion about it.

                🔒 A ROW SHOWS WHAT IDENTIFIES THE RECORD AND NOTHING MORE —
                a name, a status, and which celebration it belongs to. No
                email, no phone, no address; those live on the record's own
                page. `toAdminRecordRows` is what enforces that, so it holds
                for every category at once instead of the one that needed it.
              */}
              {records.length ? (
                <>
                  <p
                    className="px-3 pb-1 pt-2.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]"
                    style={{ color: 'var(--sn-ink-500)' }}
                  >
                    Records
                  </p>
                  {records.map((r, i) => {
                    const navIndex = hits.length + i + hitOffset;
                    return (
                      <button
                        key={`${r.kind}:${r.id}`}
                        type="button"
                        onMouseMove={() => setSel(navIndex)}
                        onClick={() => {
                          close();
                          router.push(r.href);
                        }}
                        className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm"
                        style={navIndex === sel ? { background: 'var(--sn-paper-2, #F5EEE1)' } : undefined}
                      >
                        <span className="min-w-0">
                          <span className="block truncate font-semibold" style={{ color: 'var(--sn-ink)' }}>
                            {r.title}
                          </span>
                          {r.detail ? (
                            <span className="block truncate text-[11.5px]" style={{ color: 'var(--sn-ink-500)' }}>
                              {r.detail}
                            </span>
                          ) : null}
                        </span>
                        <span
                          className="ml-auto shrink-0 font-mono text-[10.5px]"
                          style={{ color: 'var(--sn-ink-500)' }}
                        >
                          {r.category}
                        </span>
                      </button>
                    );
                  })}
                </>
              ) : null}
            </>
          )}
            </>
          )}
        </div>

        <div
          className="flex gap-4 border-t px-4 py-2 text-[11px]"
          style={{ borderColor: 'var(--sn-line-soft, #F1ECE3)', color: 'var(--sn-ink-500)' }}
        >
          <span>↑↓ move</span><span>↵ open</span><span>esc close</span>
          <span className="ml-auto font-mono">{hits.length} of {all.length}</span>
        </div>
      </div>
    </>
  );
}
