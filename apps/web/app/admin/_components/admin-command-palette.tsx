'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Search, Sparkles } from 'lucide-react';
import { useModalA11y } from '@/lib/use-modal-a11y';
import { claimCommandKey } from '@/lib/command-key-claim';
import { searchTokens } from '@/lib/search-stop-words';
import { rankBySentence } from '@/lib/admin-map/rank-by-sentence';
import { ADMIN_JOBS } from '@/lib/admin-map/admin-jobs.generated';
import type { AdminJob } from '@/lib/admin-map/scan-admin-jobs';
import { matchJobs, jobDisplayLabel } from '@/lib/admin-map/match-job';
import { humanizeFieldLabel, fieldKind, askParamKey, ADMIN_ASK_PARAM } from '@/lib/admin-map/humanize-field';

import { askTheAdmin, type AskAnswer } from './ask-actions';
import { ADMIN_SEARCH_OPEN_EVENT } from './admin-search-open-event';

import { buildDestinations, type Dest, type RowDest } from './admin-destinations';

/**
 * A job hiding inside an href, the way a page-destination hides in one.
 *
 * The AI is handed FORM-DRIVEN JOBS as extra choices (see `ask()` below), each
 * offered as `${resolvedPath}?admin_ask=<jobName>` — a real, known admin
 * route, so `isKnownAdminHref` on the server accepts it exactly like any other
 * page. This is the one place that marker is read back OUT, so a resolved
 * answer that names a job opens the ask-form instead of just navigating.
 */
function jobNameFromHref(href: string): string | null {
  try {
    return new URL(href, 'https://admin.invalid').searchParams.get(ADMIN_ASK_PARAM);
  } catch {
    return null;
  }
}

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
   * A word must clear this to make the query "a sentence describing a task",
   * not "a couple of words naming a thing". Two content words is exactly what
   * "papic pricing" and "vendor payouts" are — ordinary lookups that must NOT
   * grow an AI nag beside their answer. `MIN_SHARED_WORDS` in match-job.ts
   * already draws that same 2-vs-more line for the deterministic job matcher;
   * this is the identical shape one layer up, for whether to even OFFER the
   * escape hatch once a job match has already come back empty.
   */
  const MIN_SENTENCE_TOKENS = 3;

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
  const showAskEscapeHatch = hits.length > 0 && jobHits.length === 0 && searchTokens(q).length >= MIN_SENTENCE_TOKENS;

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
      const jobName = jobNameFromHref(answer.href);
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
        setSel((s) => (hits.length ? (s + 1) % hits.length : 0));
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSel((s) => (hits.length ? (s - 1 + hits.length) % hits.length : 0));
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const target = hits[sel];
        if (target) {
          close();
          router.push(target.href);
        }
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, hits, sel, close, router, askJob]);

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
              <p className="px-1 pb-3 text-[12px]" style={{ color: 'var(--sn-ink-500)' }}>
                Answer what you know — the rest stays blank on the form. Nothing is
                submitted here; the page opens with this filled in and you press the
                real button.
              </p>
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
                  // Measured: no job today lists a boolean field as required
                  // (`refusedWhenEmpty`). Excluded anyway, on purpose — an
                  // unchecked box IS a legitimate "false", not an empty answer,
                  // so a required boolean must never be able to block Prepare.
                  disabled={askJob.refusedWhenEmpty.some(
                    (f) => fieldKind(f) !== 'boolean' && !askValues[f],
                  )}
                  className="ml-auto flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-white disabled:opacity-40"
                  style={{ background: 'var(--sn-mulberry-600, #C24E25)' }}
                >
                  <Sparkles aria-hidden className="h-3 w-3" strokeWidth={2} />
                  Prepare the form
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
                  <span className="ml-auto font-mono text-[10px]" style={{ color: 'var(--sn-ink-500)' }}>fill in a form</span>
                </button>
              ))}
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
                return (
                  <div key={d.href + d.label}>
                    {header ? (
                      <p className="px-3 pb-1 pt-2.5 font-mono text-[9.5px] font-bold uppercase tracking-[0.16em]"
                        style={{ color: 'var(--sn-ink-500)' }}>{header}</p>
                    ) : null}
                    <button
                      type="button"
                      onMouseMove={() => setSel(i)}
                      onClick={() => {
                        close();
                        router.push(d.href);
                      }}
                      className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-sm font-semibold"
                      style={i === sel ? { background: 'var(--sn-paper-2, #F5EEE1)' } : undefined}
                    >
                      <span>{d.label}</span>
                      <span className="ml-auto truncate font-mono text-[10.5px]"
                        style={{ color: 'var(--sn-ink-500)' }}>{d.group}</span>
                    </button>
                  </div>
                );
              })}
              {/*
                THE SECOND HALF OF THE FLAGSHIP EXAMPLE. "add a new category on
                the taxonomy service" always finds the Taxonomy PAGE (its own
                name is a literal word in the query), so the box must never
                reach this far to say "nothing" — the old gate on that state was
                the whole bug. This is deliberately quieter than the top hit:
                a one-line offer, never a card, so a normal lookup like "papic
                pricing" (below MIN_SENTENCE_TOKENS) never sees it at all.
              */}
              {showAskEscapeHatch ? (
                <div
                  className="mx-1.5 mb-1 mt-2 border-t pt-2"
                  style={{ borderColor: 'var(--sn-line-soft, #F1ECE3)' }}
                >
                  {asked?.ok ? (
                    <button
                      type="button"
                      onClick={() => openAnswer(asked.answer)}
                      className="flex w-full items-start gap-2 rounded-lg border px-2.5 py-2 text-left"
                      style={{ borderColor: 'var(--sn-line)' }}
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
                    <p className="px-2.5 py-1 text-[11px]" style={{ color: 'var(--sn-ink-500)' }}>
                      {asked.reason === 'unavailable'
                        ? 'The assistant is not switched on here.'
                        : 'It could not place that one either.'}
                    </p>
                  ) : (
                    <button
                      type="button"
                      onClick={ask}
                      disabled={asking}
                      className="flex w-full items-center gap-1.5 rounded-md px-2.5 py-1.5 text-left text-[11.5px] font-medium disabled:opacity-50"
                      style={{ color: 'var(--sn-ink-500)' }}
                    >
                      <Sparkles aria-hidden className="h-3 w-3 shrink-0" style={{ color: 'var(--sn-gold, #A9834B)' }} strokeWidth={2} />
                      {asking ? 'Thinking…' : `Not this? Ask Setnayan to walk you through “${q.trim()}” instead`}
                    </button>
                  )}
                </div>
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
