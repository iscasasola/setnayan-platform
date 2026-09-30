'use client';

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { HUB_DRAFT_BAR_FIELD, SUPERSEDED, makerLatestWrite, makerSave, makerWritesPending, requestMakerRefresh } from '@/lib/maker-refresh';
import { canvasFingerprint, canvasWriteKey, draftedCanvasOr, noteDraftedCanvas } from '@/lib/maker-draft-store';
import type { HubSectionCanvas } from '@/lib/hub-canvas';
import type { HubDraftActionResult } from '@/lib/hub-draft';
import { loveStoryScenes, resolveMoments } from '@/lib/love-story-moments';
import { MomentNotKept, applyMomentIntent, momentNeedsServer, type LocalMomentIntent } from '@/lib/love-story-moment-intent';
import { patchStoryWord, storyStr, STORY_SHORT_MAX } from '@/lib/love-story-words';
import { loveStoryPreviewMessage, markMakerCanvasStale, postToMakerCanvas } from '@/lib/maker-live-preview';
import { hubDraftAction } from '../../hub-draft-actions';
import { LoveStoryBook, type LoveStoryBookProps } from './love-story-book';
import { LoveStoryChaptersPanel } from './love-story-chapters-panel';
import type { LoveStoryBlob } from './story-fields';
import { HubDraftField } from '../../_components/hub-draft-field';

/**
 * ⚡ OUR LOVE STORY, INSTANT IN THE EVENT HUB MAKER.
 *
 * Owner, 2026-09-30: *"editing Our Story and the Programme … so hard to edit …
 * Takes so long to edit both. the delay of response is terrible"*. MEASURED in
 * the code before this file: every words save and every moment save was a
 * server action that ended `landAfterWrite` → `revalidatePath` of the Maker, so
 * its answer carried a WHOLE render of the Maker (3–6 s on production, one at a
 * time — Next runs actions and refreshes through one queue), and nothing on the
 * page changed until it came back. The words panel did not even save until
 * "Save your answers" was pressed.
 *
 * NOW (DECISION_LOG "EVERYTHING REBUILT IN THE MAKER IS INSTANT BY DESIGN"):
 *   · ONE copy of the story in the Maker (`lib/maker-draft-store.ts`, key
 *     `events:love_story`) — the scrapbook, the words panel and a stage's panel
 *     all read it, so a keystroke in one is on the others at once;
 *   · every change is applied HERE with the server's own functions
 *     (`patchStoryWord`, `applyMomentIntent`) and drawn at once — the scrapbook
 *     re-renders, the stages' canvases take the words through the editor bridge
 *     (`loveStoryPreviewMessage`);
 *   · the save runs behind it: `hubDraftAction` intent=save (the one generic
 *     draft action — zero new server actions), batched (`makerLatestWrite`:
 *     typing is one save after the pause, quick taps are one save), `held` (no
 *     render of the Maker is owed — the Apply count comes back in the answer);
 *   · a refused save puts the story back as it was saved, on the page and on
 *     the canvas, and says so in words;
 *   · what the bridge cannot draw (a moment added, removed, hidden, moved to
 *     another chapter; the words the essay style composes) reloads the stage
 *     canvases ONCE, after the save landed, double-buffered.
 * A change that must be decided by the server — photos from another event, or
 * a NEW photo (it is screened before it is kept) — still goes to
 * `loveStoryMomentAction`, exactly as before (`momentNeedsServer`).
 */

export const LOVE_STORY_DRAFT_TYPE = 'events:love_story';

type Story = Record<string, unknown>;
type DraftAction = typeof hubDraftAction;

const asStory = (v: unknown): Story => (v && typeof v === 'object' && !Array.isArray(v) ? (v as Story) : {});

/* ── the one copy, and who is listening ─────────────────────────────────── */

let version = 0;
const listeners = new Set<() => void>();
const notify = () => {
  version += 1;
  for (const l of listeners) l();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
/** The last story the draft is known to hold — a refused save goes back here. */
let savedStory: Story | null = null;
/** A change the bridge could not draw is in this burst — reload the canvases once it lands. */
let owesCanvas = false;
/** The newest refusal, in words — every panel on the story shows it. */
let refusal: { seq: number; text: string } | null = null;

/**
 * 🧪 THE DEV LAB'S SAVE (`/dev/details-lab?item=love-story`, a 404 in
 * production): the same path, a stand-in for the database, so the timings can
 * be measured without signing in. Never set anywhere else.
 */
let labSaver: DraftAction | null = null;
export function setLoveStoryLabSaver(fn: DraftAction | null): void {
  if (process.env.NODE_ENV !== 'production') labSaver = fn;
}

/** The story to show and to build on: the Maker's own copy while it is newer than the server's. */
export function liveStoryOf(server: unknown): Story {
  return asStory(draftedCanvasOr(LOVE_STORY_DRAFT_TYPE, asStory(server) as HubSectionCanvas));
}

/** The story, re-read whenever a Maker panel changes it. */
export function useLiveLoveStory(server: unknown): Story {
  useSyncExternalStore(subscribe, () => version, () => version);
  return liveStoryOf(server);
}

export function useLoveStoryRefusal(): { seq: number; text: string } | null {
  useSyncExternalStore(subscribe, () => version, () => version);
  return refusal;
}

/** What the canvases draw of the story — changes here the bridge cannot lay. */
function sceneShape(story: Story): string {
  return loveStoryScenes(story)
    .map((s) => `${s.id}|${s.chapter}|${s.media.join(',')}`)
    .join(';');
}

function postPreview(story: Story) {
  postToMakerCanvas(
    loveStoryPreviewMessage(
      loveStoryScenes(story).map((s) => ({ id: s.id, when: s.when, chapterLabel: s.chapterLabel, line: s.line, place: s.place ?? '' })),
    ),
  );
}

/**
 * ⚡ ONE CHANGE TO THE STORY: drawn now, saved behind it.
 * `redraw` = the canvases must load again once it has saved (the bridge cannot
 * draw it). Resolves once its save is decided (or carried by a later one).
 */
export async function editLoveStory(input: {
  eventId: string;
  next: Story;
  server: unknown;
  /** What changed, in the couple's words — said if it does not save. */
  what: string;
  redraw?: boolean;
  draftAction?: DraftAction;
}): Promise<'saved' | 'refused' | 'carried'> {
  const { eventId, next, server, what } = input;
  const prev = liveStoryOf(server);
  /* Nothing of ours on its way: what is shown IS what the draft holds (a render
     — Apply, Restore — may have replaced it since our last save). */
  if (savedStory === null || makerWritesPending(canvasWriteKey(LOVE_STORY_DRAFT_TYPE)) === 0) savedStory = prev;
  if (input.redraw || sceneShape(prev) !== sceneShape(next)) owesCanvas = true;
  noteDraftedCanvas(LOVE_STORY_DRAFT_TYPE, next as HubSectionCanvas, asStory(server) as HubSectionCanvas);
  refusal = null;
  notify();
  postPreview(next);

  const events: Record<string, unknown> = { love_story: next };
  /* together_since is DUAL-STORED (`updateOurStory`): the column follows the
     story's own answer — only when the story carries one, so a moment edit
     never clears a date the couple gave at onboarding. */
  if (typeof next.together_since === 'string') events.together_since = storyStr(next.together_since, STORY_SHORT_MAX) || null;
  const send = input.draftAction ?? labSaver ?? hubDraftAction;
  let res: HubDraftActionResult | typeof SUPERSEDED;
  try {
    res = await makerSave(
      () =>
        makerLatestWrite(canvasWriteKey(LOVE_STORY_DRAFT_TYPE), () => {
          const fd = new FormData();
          fd.set('intent', 'save');
          fd.set('patch', JSON.stringify({ events }));
          fd.set(HUB_DRAFT_BAR_FIELD, '1');
          return send(eventId, fd);
        }),
      requestMakerRefresh,
      { held: true, ok: (r) => r !== SUPERSEDED && r.ok === true },
    );
  } catch {
    res = { ok: false, intent: 'save', error: 'Please try again.' };
  }
  /* A later change carried this one — its answer decides for both. */
  if (res === SUPERSEDED) return 'carried';
  if (res.ok) {
    savedStory = next;
    if (owesCanvas) {
      owesCanvas = false;
      markMakerCanvasStale();
    }
    return 'saved';
  }
  /* Only what did not save goes back — on the page AND on the canvas — said in words. */
  const back = savedStory ?? asStory(server);
  owesCanvas = false;
  noteDraftedCanvas(LOVE_STORY_DRAFT_TYPE, back as HubSectionCanvas, asStory(server) as HubSectionCanvas);
  refusal = { seq: version + 1, text: `${what} did not save, so it is back as it was. ${res.error || 'Please try again.'}` };
  notify();
  postPreview(back);
  return 'refused';
}

/** Say something about the story on every panel that shows it (a change that could not be made). */
export function sayLoveStory(text: string): void {
  refusal = { seq: version + 1, text };
  notify();
}

function RefusalLine({ className }: { className?: string }) {
  const r = useLoveStoryRefusal();
  if (!r) return null;
  return (
    <p role="alert" data-love-story-refused-save="" className={className ?? 'text-[13px] text-terracotta-700'}>
      {r.text}
    </p>
  );
}

/* ── the scrapbook ──────────────────────────────────────────────────────── */

const INTENT_WHAT: Record<LocalMomentIntent, string> = {
  add: 'The new moment',
  edit: 'That moment',
  delete: 'Removing that moment',
  arrange: 'Showing or hiding that moment',
};

/**
 * The scrapbook in the Maker: the SAME `LoveStoryBook`, drawn from the Maker's
 * own copy of the story, its forms applied here at the tap. `action` is still
 * the server's, for what only the server may decide.
 */
export function LiveLoveStoryBook({
  story: server,
  draftAction,
  ...book
}: Omit<LoveStoryBookProps, 'moments' | 'since'> & { story: LoveStoryBlob; draftAction?: DraftAction }) {
  const story = useLiveLoveStory(server);
  const moments = resolveMoments(story);
  const years = moments.map((m) => m.date?.y).filter((y): y is number => typeof y === 'number');
  const serverAction = book.action;
  const action = async (fd: FormData): Promise<void> => {
    const now = liveStoryOf(server);
    const before = resolveMoments(now);
    if (momentNeedsServer(before, fd)) return serverAction(fd);
    const intent = String(fd.get('intent')) as LocalMomentIntent;
    const r = applyMomentIntent(before, intent, fd);
    if (!r.ok) {
      /* The sheet says it and stays open; a Remove / Hide button says it above the book. */
      if (intent === 'add' || intent === 'edit') throw new MomentNotKept(r.error);
      sayLoveStory(r.error);
      return;
    }
    // The first write keeps the moments BESIDE the legacy words — as the action does.
    void editLoveStory({
      eventId: book.eventId,
      next: { ...now, moments: r.after },
      server,
      what: INTENT_WHAT[intent],
      draftAction,
    });
    if (r.touched) {
      const id = r.touched.id;
      window.requestAnimationFrame(() =>
        document.getElementById(`moment-${id}`)?.scrollIntoView({ block: 'center', behavior: 'smooth' }),
      );
    }
  };
  return (
    <>
      <RefusalLine className="mb-2 text-sm text-terracotta-700" />
      <LoveStoryBook {...book} moments={moments} since={years.length ? Math.min(...years) : null} action={action} />
    </>
  );
}

/* ── the words ──────────────────────────────────────────────────────────── */

/**
 * The Love Story's questions and moment list, saving AS THEY ARE TYPED — no
 * Save button. Each box writes only its own key (`patchStoryWord`): the same
 * words can be open in Details and in a stage's panel at once, and a box drawn
 * before an edit elsewhere must never write its older words back.
 */
export function LiveStoryPanel({
  eventId,
  story: server,
  ownsPro,
  draftAction,
  footer,
}: {
  eventId: string;
  story: LoveStoryBlob;
  ownsPro: boolean;
  draftAction?: DraftAction;
  footer?: ReactNode;
}) {
  const story = useLiveLoveStory(server);
  const formRef = useRef<HTMLFormElement>(null);
  /** The boxes typed in since the last answer — a refusal puts THEM back. */
  const typed = useRef<Set<string>>(new Set());
  const [state, setState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const refused = useLoveStoryRefusal();

  useEffect(() => {
    if (!refused || !formRef.current) return;
    const back = liveStoryOf(server);
    for (const name of typed.current) {
      const el = formRef.current.elements.namedItem(name);
      if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) continue;
      const anchors = asStory(back.anchors);
      const v = name.startsWith('anchor_') ? anchors[name.slice(7)] : back[name];
      el.value = typeof v === 'string' ? v : '';
    }
    typed.current.clear();
    setState('idle');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [refused?.seq]);

  const edit = (name: string) => {
    const form = formRef.current;
    if (!form) return;
    const now = liveStoryOf(server);
    const patched = patchStoryWord(now, name, new FormData(form));
    /* Nothing changed (a tap on a moment, a box left as it was): nothing to save. */
    if (!patched || canvasFingerprint(patched.story as HubSectionCanvas) === canvasFingerprint(now as HubSectionCanvas)) return;
    typed.current.add(name);
    setState('saving');
    void editLoveStory({
      eventId,
      next: patched.story,
      server,
      what: 'Your story',
      /* The questions also make the essay look's paragraph, which the bridge
         does not lay — the canvases load it again once it has saved. */
      redraw: true,
      draftAction,
    }).then((out) => {
      if (out === 'saved') setState('saved');
    });
  };
  const onField = (e: React.FormEvent<HTMLFormElement>) => {
    const t = e.target as HTMLInputElement;
    if (t.name) edit(t.name);
  };

  return (
    <form
      ref={formRef}
      data-love-story-live=""
      className="rounded-md border border-ink/10 bg-white/70 p-3"
      onChange={onField}
      /* A milestone row added or removed is a click, not an input. */
      onClick={(e) => {
        if ((e.target as Element).closest('button')) window.setTimeout(() => edit('ms_year'), 0);
      }}
      onSubmit={(e) => e.preventDefault()}
    >
      {/* It drafts — nothing here reaches a guest before Apply. */}
      <HubDraftField />
      <LoveStoryChaptersPanel story={story as LoveStoryBlob} ownsPro={ownsPro} />
      <p role="status" className="mt-4 text-xs text-ink/60" data-love-story-save-state={state}>
        {state === 'saving' ? 'Saving…' : state === 'saved' ? 'Saved to your draft' : 'Every change saves as you type'}
      </p>
      <RefusalLine />
      {footer}
    </form>
  );
}
