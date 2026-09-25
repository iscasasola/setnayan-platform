import type { ReactElement } from 'react';
import type { HubSectionCanvas, HubSceneSlot } from '@/lib/hub-canvas';
import { SCENE_TEMPLATES, sceneTemplateClass, type SceneTemplate } from '@/lib/scene-templates';
import { SceneClip } from './scene-clip';

/**
 * A TEMPLATE SCENE ON THE GUEST PAGE — one of the 25 (`lib/scene-templates.ts`),
 * filled with what the couple put in its slots.
 *
 * ── THE CONTRACT OTHER BUILDERS USE (keep it stable) ──────────────────────
 * `renderScene(input)` is the one guest renderer for a template scene. The
 * couple's own sections call it (`custom-section-widget.tsx`), and the Love
 * Story builder (Phase 7) calls it once per moment — a moment IS a scene, with
 * the same `canvas` shape. It returns `null` when the scene has nothing to show
 * a guest, so a dispatcher's null check keeps even the canvas frame off it.
 *
 * ── HOW IT LAYS OUT ────────────────────────────────────────────────────────
 * One `<section>` whose DIRECT CHILDREN are the parts — a picture, the words,
 * a word block — because "one part after another" addresses exactly that level
 * (`every-widget-is-one-section.test.ts`). The template's LAYOUT class picks
 * the grid; the frame's body is a size container (`hub-has-tpl`), so the
 * desktop arrangement appears only when the scene is actually given the width
 * for it — a phone, a narrow column and the editor's phone preview all get the
 * phone arrangement the template defines. A browser without container queries
 * gets the phone arrangement too: stacked, complete, readable.
 *
 * 🔒 PLAIN TEXT, NEVER MARKUP. Every word here is a text node.
 */

export type SceneFacts = {
  /** The couple's names, as the invitation card prints them (10 Title card, 11 sign-off). */
  names: string | null;
  /** Their monogram text (16). */
  monogram: string | null;
  /** Whole days until the day, or null when past / no date / solemn (12). */
  daysToGo: number | null;
  /** The shipped special message (11 Letter, when the scene has no words of its own). */
  specialMessage: string | null;
  /** Love-story milestones (24 Timeline, when the scene has no blocks of its own). */
  milestones: readonly { head: string; text: string }[];
};

export const NO_SCENE_FACTS: SceneFacts = {
  names: null,
  monogram: null,
  daysToGo: null,
  specialMessage: null,
  milestones: [],
};

export type SceneRenderInput = {
  /** Already sanitized (`sanitizeHubCanvas`); must carry a `template`. */
  canvas: HubSectionCanvas;
  /** The scene's own heading and words (the custom section's `custom`). */
  words: { title: string; body: string };
  /** ref → signed URL, resolved once for the whole page. */
  mediaUrls?: Readonly<Record<string, string>>;
  facts?: SceneFacts;
};

type Pic = { url: string; snippet: boolean; index: number };

export function renderScene(input: SceneRenderInput): ReactElement | null {
  const id = input.canvas.template;
  if (!id) return null;
  const t = SCENE_TEMPLATES[id];
  const facts = input.facts ?? NO_SCENE_FACTS;
  const slots: HubSceneSlot[] = input.canvas.slots ?? [];
  const { title, body } = input.words;

  /* The pictures that RESOLVED — a ref whose signing failed is not a picture,
     and an empty box on a wedding page reads as broken. */
  const pics: Pic[] = [];
  for (let i = 0; i < t.media; i += 1) {
    const s = slots[i];
    const url = s?.media ? input.mediaUrls?.[s.media] : undefined;
    if (url) pics.push({ url, snippet: s?.kind === 'snippet', index: i });
  }
  const blocks = t.blocks > 0 ? readBlocks(slots, t, facts) : [];
  const display = displayText(t, facts, title);
  const letterBody = t.builtOn === 'special_message' ? body || facts.specialMessage || '' : body;
  const hasWords = Boolean(title || letterBody);

  const anything = pics.length > 0 || blocks.length > 0 || Boolean(display) || hasWords;
  if (!anything) return null;

  const video = input.canvas.video;
  const media = (p: Pic) => (
    <figure key={`m${p.index}`} className="hub-tpl-m">
      {p.snippet ? (
        <SceneClip
          src={p.url}
          play={video?.play ?? 'loop'}
          open={video?.open ?? 'fullscreen'}
          label={title ? `Play: ${title}` : 'Play the video'}
        />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element -- a signed, per-guest URL; next/image would re-host it
        <img className="hub-tpl-media" src={p.url} alt="" loading="lazy" decoding="async" />
      )}
    </figure>
  );

  const words = (key: string) =>
    hasWords && t.layout !== 'title' && t.layout !== 'number' ? (
      <div key={key} className="hub-tpl-w">
        {title && t.layout !== 'quote' ? <p className="hub-tpl-h">{title}</p> : null}
        {letterBody ? <p className="hub-tpl-p">{letterBody}</p> : null}
        {t.layout === 'quote' && title ? <p className="hub-tpl-sign">{title}</p> : null}
        {t.layout === 'letter' && facts.names ? <p className="hub-tpl-sign">{facts.names}</p> : null}
      </div>
    ) : null;

  const parts: (ReactElement | null)[] = [];
  switch (t.layout) {
    case 'title':
    case 'number':
    case 'mono':
      parts.push(display ? <p key="x" className="hub-tpl-x">{display}</p> : null);
      if (t.layout === 'number' && display) {
        parts.push(
          <p key="c" className="hub-tpl-p">
            {title || (facts.daysToGo === 1 ? 'day to go' : facts.daysToGo === 0 ? 'The day is here' : 'days to go')}
          </p>,
        );
      } else if (body) {
        parts.push(<p key="c" className="hub-tpl-p">{body}</p>);
      }
      break;
    case 'cols':
    case 'timeline':
    case 'qa':
      if (title) parts.push(<p key="h" className="hub-tpl-h">{title}</p>);
      for (const [i, b] of blocks.entries()) {
        parts.push(
          <div key={`b${i}`} className="hub-tpl-b">
            {b.head ? <p className="hub-tpl-bh">{b.head}</p> : null}
            {b.text ? <p className="hub-tpl-p">{b.text}</p> : null}
          </div>,
        );
      }
      if (body) parts.push(<p key="p" className="hub-tpl-p">{body}</p>);
      break;
    default:
      /* Pictures, then words — the phone order for every media + text
         template. The desktop grid places them (and flips 2 · Photo right). */
      for (const p of pics) parts.push(media(p));
      parts.push(words('w'));
  }

  const kept = parts.filter((p): p is ReactElement => p !== null);
  if (kept.length === 0) return null;
  return (
    <section className={sceneTemplateClass(id)} data-scene-template={id}>
      {kept}
    </section>
  );
}

/** The same renderer as a component, for JSX callers. */
export function SceneTemplateView(props: SceneRenderInput) {
  return renderScene(props);
}

function readBlocks(
  slots: readonly HubSceneSlot[],
  t: SceneTemplate,
  facts: SceneFacts,
): { head: string; text: string }[] {
  const own = slots
    .slice(0, t.blocks)
    .map((s) => ({ head: s.head ?? '', text: s.text ?? '' }))
    .filter((b) => b.head || b.text);
  if (own.length > 0) return own;
  // 24 · Timeline is built on the love story's milestones when the couple wrote none.
  return t.builtOn === 'milestones' ? facts.milestones.slice(0, t.blocks).map((m) => ({ ...m })) : [];
}

function displayText(t: SceneTemplate, facts: SceneFacts, title: string): string | null {
  if (t.builtOn === 'names') return title || facts.names;
  if (t.builtOn === 'monogram') return facts.monogram;
  if (t.builtOn === 'countdown') {
    return facts.daysToGo === null ? null : facts.daysToGo === 0 ? '0' : String(facts.daysToGo);
  }
  return null;
}
