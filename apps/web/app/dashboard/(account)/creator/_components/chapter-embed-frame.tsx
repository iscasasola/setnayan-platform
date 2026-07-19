/**
 * ChapterEmbedFrame — the ONLY place a chapter embed is mounted in an iframe.
 *
 * Red line (Creator build plan): embeds are sandboxed + provider-allowlisted.
 *   • `src` is always a normalized embed URL produced by lib/creator-chapters
 *     `normalizeEmbed` (youtube-nocookie / instagram /embed / tiktok /embed/v2)
 *     — never a raw pasted URL.
 *   • `sandbox="allow-scripts allow-same-origin allow-presentation"` — players
 *     need scripts + same-origin for their own asset fetches + presentation for
 *     fullscreen. Deliberately NO `allow-top-navigation` (the embed can't
 *     hijack the tab) and NO `allow-popups`/`allow-forms`/`allow-modals`.
 *   • `referrerPolicy` is tight; `loading="lazy"` keeps it cheap.
 *
 * This is a creator-only PREVIEW for now — the public chapter timeline (CP-3)
 * is a separate PR, but it must reuse this exact frame.
 */
export function ChapterEmbedFrame({
  src,
  title,
}: {
  src: string;
  title: string;
}) {
  return (
    <div className="relative w-full overflow-hidden rounded-tile bg-ink/[0.06]" style={{ aspectRatio: '16 / 9' }}>
      <iframe
        src={src}
        title={title}
        loading="lazy"
        referrerPolicy="strict-origin-when-cross-origin"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        allow="encrypted-media; picture-in-picture; fullscreen"
        className="absolute inset-0 h-full w-full border-0"
      />
    </div>
  );
}
