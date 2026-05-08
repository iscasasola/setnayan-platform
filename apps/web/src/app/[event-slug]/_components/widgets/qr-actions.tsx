"use client";

import { useState } from "react";

export function QrActions() {
  const [copied, setCopied] = useState(false);

  function copy() {
    if (typeof window === "undefined") return;
    void navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    });
  }

  function save() {
    // Triggers Add to Home Screen on iOS Safari (system-handled). On other
    // browsers, the most-useful "save" is bookmarking — but we surface this
    // CTA prominently regardless because the work order calls it out.
    const ua = navigator.userAgent.toLowerCase();
    if (ua.includes("iphone") || ua.includes("ipad")) {
      alert(
        "On iPhone / iPad: tap the Share icon in Safari, then 'Add to Home Screen'. Your invitation lives there from now on.",
      );
    } else if (ua.includes("android")) {
      alert(
        "On Android: tap the menu (⋮) in Chrome, then 'Add to Home screen' or 'Install app'.",
      );
    } else {
      alert(
        "Bookmark this page (Cmd/Ctrl + D) so you can return any time without re-scanning.",
      );
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2">
      <button type="button" onClick={save} className="btn-default text-[12px]">
        <span aria-hidden>📲</span> Save to phone
      </button>
      <button type="button" onClick={copy} className="btn-default text-[12px]">
        <span aria-hidden>🔗</span> {copied ? "Copied!" : "Copy link"}
      </button>
      <button
        type="button"
        disabled
        className="btn-ghost cursor-not-allowed text-[12px] opacity-60"
        title="Wallet pass ships in V1.5"
      >
        <span aria-hidden>👛</span> Add to wallet
      </button>
    </div>
  );
}
