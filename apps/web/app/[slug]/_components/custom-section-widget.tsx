import type { ReactElement } from 'react';
import { sanitizeCustomSection } from '@/lib/custom-sections';
import { sanitizeHubCanvas } from '@/lib/hub-canvas';
import { renderScene, type SceneFacts } from './scene-template';

/**
 * A SECTION THE COUPLE WROTE — a heading and their own words.
 *
 * Owner, 2026-09-23: *"they can add a blank screen in between, to create
 * content on the website as well."*
 *
 * ⛔ NO BODY, NO SECTION. A heading with nothing under it reads to a guest as a
 * broken page — a promise and a blank — so an empty slot renders `null` and the
 * dispatcher's own null check keeps even the canvas frame off it. The couple
 * still sees the slot in their editor; it simply does not publish until it has
 * something to say.
 *
 * ⛔ AND IT IS PLAIN TEXT, NEVER MARKUP. `whitespace-pre-line` honours the line
 * breaks the couple typed and nothing else: the words go into a text node, so
 * there is no path from a `config_json` a host can write to HTML on a guest's
 * page. The same posture as `our-love-story-widget.tsx` beside it.
 *
 * The heading is optional on purpose — a couple who wants a bare passage of
 * text between two sections should not have to invent a title for it.
 */
export function CustomSectionWidget({ config }: { config: unknown }) {
  const { title, body } = sanitizeCustomSection(config);
  if (!body) return null;

  return (
    <section className="space-y-4">
      {title ? (
        <p className="pahina-eyebrow">
          <span>{title}</span>
        </p>
      ) : null}
      <p className="max-w-prose whitespace-pre-line text-base leading-relaxed text-ink/80">
        {body}
      </p>
    </section>
  );
}

/**
 * WHAT A DISPATCHER CALLS FOR A `custom_N` ROW — a plain function, not a
 * component, so its `null` reaches the dispatcher's own null check and the
 * canvas frame stays off an empty scene (the frame refuses `children === null`).
 *
 * 🎬 A SCENE MADE FROM A TEMPLATE (Event Hub Maker Phase 5) draws through
 * `renderScene`; a section written before templates existed draws exactly as it
 * always did. The template is read here — the dispatchers never touch the
 * canvas contract themselves (`every-dispatcher-frames-the-canvas.test.ts`).
 */
export function renderCustomSection(input: {
  config: unknown;
  mediaUrls?: Readonly<Record<string, string>>;
  facts: SceneFacts;
}): ReactElement | null {
  const canvas = sanitizeHubCanvas(input.config);
  if (canvas.template) {
    return renderScene({
      canvas,
      words: sanitizeCustomSection(input.config),
      mediaUrls: input.mediaUrls,
      facts: input.facts,
    });
  }
  if (!sanitizeCustomSection(input.config).body) return null;
  return <CustomSectionWidget config={input.config} />;
}
