-- papic_story_challenges_expanded
--
-- Owner 2026-08-10, after the first four shipped: "make more. something to
-- uplift the groom, bride, and as a couple. questions that are fun to share but
-- still memorable and safe enough to share."
--
-- Sixteen more story questions (45–60), taking the library 44 → 60. Every one is
-- answered to camera in ten seconds, like 41–44.
--
-- ── THE TWO KINDS, AND WHY THAT COVERS ALL THREE OF THE OWNER'S ASKS ────────
--
-- `stories`        — carry the {who} side token. A bride-side guest is asked
--                    about THE BRIDE, a groom-side guest about THE GROOM.
--                    🔑 THIS *IS* "uplift the groom" AND "uplift the bride":
--                    each guest is asked about the half they actually know.
--                    A fixed "praise the bride" handed to the groom's college
--                    roommate produces a polite non-answer — the opposite of
--                    memorable. Targeting by side beats targeting by name.
-- `stories_couple` — no token; always about the two of them together. This is
--                    "as a couple", and it is the only way to get it: a
--                    both-side guest resolving {who} to "the couple" happens by
--                    accident of their side, not by design.
--
-- ── SAFE ENOUGH TO SHARE — A CONSTRAINT ON THE WORDING, NOT A DISCLAIMER ────
-- Owner's word: "safe". These prompts are engineered so the WORST honest answer
-- is still one the couple would happily play at a reception:
--   • Every question points at something GOOD — proud of, kindest, best at,
--     made you laugh, what people get wrong. None asks for the wildest, the
--     most embarrassing, the secret, or the story they have never told. Those
--     read as fun on a planning screen and land as a problem on a projector,
--     in front of both families, permanently.
--   • The two that could tip — the funny one and the first-impression one —
--     carry an explicit steer ("Keep it kind" / "Be nice") IN the prompt, where
--     the guest reads it, not in a policy nobody sees.
--   • Nothing asks a guest to compare the two of them, rank anyone, or speak
--     about an ex, money, or family friction.
-- The § 2.2 blocklist trigger (papic_missions_prompt_guard) still applies on
-- insert and none of these trip it — but the blocklist stops dares, not
-- tactlessness. THE WORDING IS THE ACTUAL SAFETY MECHANISM.
--
-- ── ONLY TWO GET A GUARANTEED BOARD SLOT, ON PURPOSE ────────────────────────
-- The board is 20 slots (see the previous migration's header). Ranks 11–14 are
-- the first four stories; this adds ranks 15–16 only, so the default board is
-- 10 heroes + 6 stories + 4 errands. Ranking all sixteen would leave ZERO
-- errands, and the errands are what walk a guest to the paid line items the
-- couple actually spent on (§ 9 "the library IS the spend-maximizer").
-- The two chosen are both `stories_couple`, because 41–44 are all side-token
-- ones — without these the default board never asks about the two of them
-- together at all.
--
-- 🔑 THE OTHER FOURTEEN ARE REACHED BY THE COUPLE PICKING THEM. That picker is
-- built in this same PR. Adding library rows that nothing can surface is the
-- exact trap the previous migration documented, and shipping fourteen of them
-- would have been committing it deliberately.
--
-- KEEP THIS MIGRATION IDEMPOTENT (it may be re-applied).

BEGIN;

-- ── The side-token set: uplift the one you came for ────────────────────────
INSERT INTO public.papic_challenge_library
  (library_id, slug, category, title, prompt, capture_kind, mission_type, priority_rank)
VALUES
  (45, 'story-brag',            'stories', 'Brag For Them',
   'Brag about {who} for ten seconds. Go.', 'clip', 'prompt', NULL),
  (46, 'story-three-words',     'stories', 'Three Words',
   'Describe {who} in three words, then explain one. Ten seconds.', 'clip', 'prompt', NULL),
  (47, 'story-best-at',         'stories', 'The Best At',
   'What is {who} the absolute best at? Ten seconds to say it.', 'clip', 'prompt', NULL),
  (48, 'story-kindest',         'stories', 'The Kindest Thing',
   'The kindest thing {who} has ever done for you. Ten seconds.', 'clip', 'prompt', NULL),
  (49, 'story-get-wrong',       'stories', 'Set It Straight',
   'What do people always get wrong about {who}? Ten seconds to set it straight.', 'clip', 'prompt', NULL),
  (50, 'story-first-thought',   'stories', 'First Impression',
   'What did you think the first time you met {who}? Ten seconds. Be nice.', 'clip', 'prompt', NULL),
  (51, 'story-made-you-laugh',  'stories', 'Made You Laugh',
   'The last time {who} made you laugh. Ten seconds — keep it kind.', 'clip', 'prompt', NULL),
  (52, 'story-proud',           'stories', 'Proud Of Them',
   'What are you most proud of {who} for? Ten seconds.', 'clip', 'prompt', NULL),

-- ── The couple set: uplift the two of them together ────────────────────────
-- 53 + 54 take ranks 15–16 — the only two of the sixteen on every board.
  (53, 'story-knew-it',         'stories_couple', 'When You Knew',
   'When did you know these two were it? Ten seconds.', 'clip', 'prompt', 15),
  (54, 'story-together',        'stories_couple', 'Better Together',
   'Your favourite thing about the two of them together. Ten seconds.', 'clip', 'prompt', 16),
  (55, 'story-advice',          'stories_couple', 'Advice For The Years',
   'Ten seconds of advice for the years ahead. Serious or not.', 'clip', 'prompt', NULL),
  (56, 'story-different',       'stories_couple', 'Different Together',
   'How are they different when they are with each other? Ten seconds.', 'clip', 'prompt', NULL),
  (57, 'story-ten-years',       'stories_couple', 'Ten Years From Now',
   'Where will these two be in ten years? Ten seconds to call it.', 'clip', 'prompt', NULL),
  (58, 'story-best-day',        'stories_couple', 'The Best Day',
   'The best day you have ever spent with the two of them. Ten seconds.', 'clip', 'prompt', NULL),
  (59, 'story-their-song',      'stories_couple', 'Their Song',
   'A song that will always make you think of them — and why. Ten seconds.', 'clip', 'prompt', NULL),
  (60, 'story-their-kids',      'stories_couple', 'One Day, Their Kids',
   'What will you tell their kids about them one day? Ten seconds.', 'clip', 'prompt', NULL)
ON CONFLICT (slug) DO NOTHING;

COMMENT ON COLUMN public.papic_challenge_library.category IS
  'Grouping label, free text — nothing in the app branches on it except the couple''s story picker, which lists `stories` (side-token, asked about the half this guest knows) and `stories_couple` (always about the two of them). Errand categories: couple_family · food_drinks · band_dance · decor_booth · meet_room · fashion_candids · big_moments.';

COMMIT;
