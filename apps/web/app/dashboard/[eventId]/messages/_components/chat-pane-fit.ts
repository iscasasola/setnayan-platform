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
