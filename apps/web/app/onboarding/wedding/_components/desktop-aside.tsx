/**
 * OnboardingDesktopAside — editorial canvas beside the phone frame on desktop.
 *
 * WHY (owner directive 2026-06-13): on desktop the onboarding was a 430px phone
 * card stranded on a stone background — it rendered, but the wide screen went
 * unused. The owner chose "enrich the canvas, keep the frame": the locked
 * .onbw>.phone prototype (port-as-is lock 2026-06-02) is untouched; this aside
 * fills the space to its left with a branded editorial panel so a couple planning
 * on a laptop gets a designed experience, not a floating phone.
 *
 * Rendered as the first child of `.onbw`, BEFORE `.phone`. It is display:none
 * below 1024px (see onboarding-desktop.css), so mobile + tablet are byte-for-byte
 * unchanged. The panel is purely decorative reinforcement — every functional
 * control lives in the phone — so it's aria-hidden to avoid a screen reader
 * announcing the brand + reassurances twice (the phone's top bar already carries
 * the SETNAYAN lockup).
 */
export function OnboardingDesktopAside() {
  return (
    <aside className="onb-aside" aria-hidden="true">
      <div className="onb-aside-inner">
        <div className="onb-aside-mark">
          {/* Same gold symbol mark the phone's top bar carries (brandlock). */}
          <svg viewBox="0 0 5333.3335 5333.3335" role="img" aria-label="Setnayan">
            <path
              d="M 1859.526,3749.781 C 1458.028,3717.757 1065.454,3548.554 758.3406,3241.44 451.2286,2934.328 282.2397,2541.742 250.2195,2140.255 l 1326.8215,1.536 V 661.7647 C 1368.543,727.4195 1172.067,841.5416 1006.804,1006.804 768.3191,1245.29 633.8543,1548.261 602.7217,1859.526 H 250 C 282.024,1458.028 451.2265,1065.455 758.3406,758.3406 1065.453,451.2287 1458.039,282.2396 1859.526,250.2195 V 2422.739 H 661.7647 c 65.6549,208.498 179.7773,404.975 345.0393,570.237 238.486,238.486 541.457,372.95 852.722,404.083 z m 280.948,0 1.537,-1609.307 h 280.948 v 1197.761 c 208.498,-65.655 404.974,-179.776 570.237,-345.039 238.485,-238.486 372.95,-541.457 404.082,-852.722 H 3750 c -32.024,401.498 -201.226,794.071 -508.341,1101.185 -307.112,307.112 -699.697,476.101 -1101.185,508.122 z m 0,-1890.255 c 32.025,-401.498 201.227,-794.073 508.341,-1101.1854 0.658,-0.6584 1.316,-1.3173 1.975,-1.9754 -80.395,-42.041 -163.892,-76.0428 -249.331,-101.7389 -85.439,-25.696 -172.821,-43.0864 -260.985,-51.9046 V 250.2195 c 401.497,32.0253 794.073,201.0094 1101.185,508.1211 307.114,307.1134 476.317,699.6874 508.341,1101.1854 h -352.722 c -31.132,-311.265 -165.597,-614.236 -404.082,-852.722 -15.719,-15.7189 -32.464,-29.741 -48.727,-44.5564 -15.975,14.4789 -31.774,29.1397 -47.191,44.5564 -238.485,238.486 -372.95,541.457 -404.082,852.722 z"
              fill="#cb9e4b"
              fillRule="nonzero"
              transform="matrix(1.3333333,0,0,-1.3333333,0,5333.3333)"
            />
          </svg>
          <span className="onb-aside-wm">SETNAYAN</span>
        </div>

        <div className="onb-aside-eyebrow">Wedding planning, simplified</div>
        <h2 className="onb-aside-h">Let&rsquo;s build the plan for your day.</h2>
        <p className="onb-aside-sub">
          A few quick questions &mdash; your dream team, timeline, and budget,
          sorted to fit. Free to start, and it saves as you go.
        </p>

        <ul className="onb-aside-list">
          {[
            'Free to start — no card needed',
            'Every vendor matched to your style',
            'Your plan saves as you go',
          ].map((line) => (
            <li key={line}>
              <span className="onb-aside-tick">
                <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
                  <path
                    d="M5 12.5l4.2 4.2L19 7"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </span>
              {line}
            </li>
          ))}
        </ul>

        <div className="onb-aside-sig">Set na &rsquo;yan.</div>
      </div>
    </aside>
  );
}
