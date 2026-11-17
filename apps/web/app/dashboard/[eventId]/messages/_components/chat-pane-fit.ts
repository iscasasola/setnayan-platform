/**
 * 📏 THE CHAT'S RIGHT COLUMN ENDS AT THE WINDOW'S FOOT — sized from where it actually stands on screen.
 *
 * The pane is sticky under the pin line, so once the page scrolls it stands AT the pin line — but on arrival it stands
 * wherever the page put it: under the couple's "Plan with peace of mind" strip and the "Chats" title, under an
 * "updated while open" bar, under whatever the page draws next. Two attempts sized it from a guess about what stands
 * above it (the pin line, then the pin line plus a measured gutter) and each missed what it did not know about:
 * W1 measured the composer's foot at 1093 of 1024 at 768 and 869 of 800 at 1280 on live f896598 (RW-330) — the pane
 * sat at y≈173 while it was sized as if it stood at 93.
 *
 * So nothing above it is modelled any more: the pane's OWN top on screen is read (`getBoundingClientRect`) and the
 * column is the window below it. `ChatPanes` re-reads it on load, resize, scroll and any change in the page's height.
 * Plain DOM, no React — the e2e spec runs THIS function in a real browser against the real markup and measures the
 * composer (`tests/e2e/the-chat-box-is-in-the-window.spec.ts`).
 */

export function fitChatPane(root: HTMLElement): void {
  const pane = root.querySelector<HTMLElement>('[data-supplier-cols-pane]');
  if (!pane) return;
  const top = Math.max(0, Math.round(pane.getBoundingClientRect().top));
  if (root.style.getPropertyValue('--sn-chat-pane-top') !== `${top}px`) {
    root.style.setProperty('--sn-chat-pane-top', `${top}px`);
  }
}

/**
 * 👀 RE-FIT WHENEVER THE PANE CAN HAVE MOVED — and return the cleanup. `ChatPanes` calls this; the e2e spec calls the
 * SAME function, so the wiring is measured, not only the arithmetic.
 *
 * W1 on live 1c8fe6b (after #7804): the fit was right but never re-ran when the couple's "Plan with peace of mind" strip
 * arrived (~0.7 s after load, inserted ABOVE the pane): the pane moved from 93 to 173, the variable stayed 93 for 5 s+,
 * and only a window resize fixed it. A ResizeObserver on `<body>` alone did not see it. So the pane is re-fitted on
 * everything that can move it:
 *   · a node added or removed anywhere in the page (a strip, a line, a banner — `MutationObserver`, childList + subtree;
 *     attribute writes are not watched, so the fit's own variable never wakes it);
 *   · any ANCESTOR of the chat changing size (the column a strip lands in grows — `ResizeObserver` on each ancestor up
 *     to `<body>`), which also catches a change made by CSS alone;
 *   · window resize and scroll (sticky: the pane rises to the pin line as the page scrolls).
 * One read per frame however many of them fire (throttled: the next frame, or 120 ms where no frame comes); all of it
 * stops on unmount.
 */
export function watchChatPane(root: HTMLElement): () => void {
  // ⏱ NEXT FRAME OR 120 ms, WHICHEVER COMES FIRST. A tab that is not painting (in the background, a hidden pane)
  // runs NO animation frames, so a frame-only re-fit simply waits: W1 read the variable stuck at 93 for 5 s+ and saw it
  // fixed by any resize (which makes the tab paint) — the shape of a frame that never came. Timers still run there.
  let frame = 0;
  let timer: ReturnType<typeof setTimeout> | null = null;
  const run = () => {
    if (frame) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = 0;
    timer = null;
    fitChatPane(root);
  };
  const refit = () => {
    if (frame || timer !== null) return;
    frame = requestAnimationFrame(run);
    timer = setTimeout(run, 120);
  };
  fitChatPane(root);
  window.addEventListener('resize', refit);
  window.addEventListener('scroll', refit, { passive: true });
  const sized = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(refit);
  for (let el: HTMLElement | null = root.parentElement; el; el = el.parentElement) {
    sized?.observe(el);
    if (el === document.body) break;
  }
  const added = typeof MutationObserver === 'undefined' ? null : new MutationObserver(refit);
  added?.observe(document.body, { childList: true, subtree: true });
  return () => {
    if (frame) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    window.removeEventListener('resize', refit);
    window.removeEventListener('scroll', refit);
    sized?.disconnect();
    added?.disconnect();
  };
}
