/**
 * Shared OAuth provider brand marks — extracted from oauth-button-row.tsx so both
 * the web button row (server-action forms) AND the desktop button variant
 * (system-browser loopback) render the identical, on-guideline marks. Pure SVG,
 * no hooks → safe in both server and client components.
 *
 * Google G: standardized 4-color quadrant geometry per Google's branding
 * guidelines (red #EA4335 · blue #4285F4 · yellow #FBBC05 · green #34A853).
 * Apple: the monochrome glyph sanctioned for light-mode "Sign in with Apple"
 * buttons. Both are nominative-use sign-in affordances, not app-icon copies.
 */

export function GoogleGIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden role="img" focusable={false}>
      <path
        fill="#EA4335"
        d="M12 5c1.6168 0 3.1013.5557 4.2607 1.6427l3.1734-3.1747C17.5066 1.5947 14.9419.5 12 .5 7.7027.5 3.9893 2.9787 2.1933 6.6053l3.6913 2.8693C6.7613 6.6213 9.1453 5 12 5z"
      />
      <path
        fill="#4285F4"
        d="M23.5 12.273c0-.8453-.075-1.6587-.215-2.4407H12v4.6147h6.4607c-.2787 1.502-1.124 2.7733-2.394 3.624l3.8773 3.0067C22.207 19.057 23.5 15.9197 23.5 12.273z"
      />
      <path
        fill="#FBBC05"
        d="M5.884 14.474c-.2007-.6-.314-1.2387-.314-1.974s.1133-1.374.314-1.974L2.1927 7.6307C1.4173 9.1707 1 10.4733 1 12.5c0 2.0267.4173 3.3293 1.1927 4.8693l3.6913-2.8953z"
      />
      <path
        fill="#34A853"
        d="M12 23.5c2.9407 0 5.4067-.9707 7.207-2.6293l-3.8767-3.0067c-1.072.72-2.4513 1.1453-3.3303 1.1453-2.855 0-5.2387-1.6207-6.116-3.8067L2.1933 18.064C3.99 21.6913 7.7033 23.5 12 23.5z"
      />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" aria-hidden role="img" focusable={false}>
      <path
        fill="#000000"
        d="M16.365 1.43c0 1.14-.493 2.27-1.177 3.08-.744.9-1.99 1.57-2.987 1.57-.12 0-.23-.02-.3-.03-.01-.06-.04-.22-.04-.39 0-1.15.572-2.27 1.206-2.98.804-.94 2.142-1.64 3.248-1.68.03.13.05.28.05.43zm4.565 15.71c-.03.07-.463 1.58-1.518 3.12-.91 1.33-1.852 2.66-3.347 2.69-1.468.03-1.94-.87-3.61-.87-1.67 0-2.19.84-3.58.9-1.44.05-2.53-1.43-3.45-2.75-1.886-2.71-3.32-7.65-1.39-10.99.96-1.65 2.68-2.7 4.54-2.73 1.42-.03 2.76.96 3.63.96.86 0 2.5-1.19 4.22-1.01.72.03 2.74.29 4.04 2.18-.105.07-2.41 1.41-2.38 4.22.03 3.36 2.95 4.48 2.98 4.49z"
      />
    </svg>
  );
}
