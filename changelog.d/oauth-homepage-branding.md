## 2026-07-23 · fix(home): homepage passes Google OAuth branding review — visible "Setnayan" wordmark + plain-language purpose line + og:site_name

Google's OAuth branding verification (Setnayan Cloud project, consent screen for the YouTube-livestream + Google-Drive-photo-delivery scopes) rejected the app with two issues, both rooted in the homepage `https://www.setnayan.com`:

1. **"The app name 'Setnayan' … does not match the app name on your home page."** The page had **no `og:site_name`**, the `<h1>` is the tagline "Keep your memories. Plan your moments.", and the largest visible hero text is the brand-origin tagline **"Set na ’yan"** — so an automated/human matcher reads the page's prominent name as "Set na ’yan" ≠ "Setnayan". The floating glass nav rendered only the icon mark (`aria-label="Home"`), never the textual wordmark.
2. **"Your home page does not explain the purpose of your app."** The lead copy was poetic ("The independent hub to keep a lifetime of memories") and never plainly stated what the software does, nor named the two capabilities that actually consume the requested Google scopes — YouTube livestreaming (Live Studio) and Google Drive photo delivery (`drive.file`).

**Fix (design-preserving — the cinematic no-scroll gate and the locked "Set na ’yan" tagline are untouched; owner-approved approach 2026-07-23):**

- `apps/web/app/page.tsx` — add `openGraph.siteName: 'Setnayan'` so the page emits `og:site_name` exactly matching the consent-screen app name.
- `HomeReskin.tsx` nav — add a visible **"Setnayan" wordmark** (`<span class="hr-wordmark">`) beside the mark; change the logo button's `aria-label` from "Home" to "Setnayan — home" and its `title` to "Setnayan". The mark still paints in `currentColor`, so the wordmark inherits the same white→ink adaptive switch on gate/open.
- `HomeReskin.tsx` `HOME_HERO.sub` — replace the abstract sub-copy with a plain-language purpose line that names the app and states what it does, including the two Google-scope features: *"Setnayan is the Filipino app for planning weddings and life events — plan free, livestream your day to YouTube, deliver your photos to Google Drive, and keep every memory for life."* (Truthful — the OAuth app really does drive `/api/oauth/youtube/*` livestream + `/api/oauth/drive/*` `drive.file` photo delivery.)
- `home-reskin.css` — `.hr-logo` becomes an auto-width icon+wordmark pill (`gap`, side padding); new `.hr-wordmark` type spec (Geist, 16px/600); the ≤480px query keeps the square 40px badge and hides the wordmark (reviewers verify on desktop); `.hr-hsub` gains `max-width: 54ch` + auto side-margins so the longer purpose line stays centered and readable on wide viewports.

No schema, route, or data change; homepage ISR + JSON-LD graph + the `after()` digest/email flushes are all untouched.

SPEC IMPACT: None — homepage marketing copy/branding only; no locked SKU, schema, or decision affected. The "Set na ’yan" brand-origin tagline is preserved (it remains the hero kick); "Setnayan" is now additionally shown as the wordmark.
