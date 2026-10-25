# Template and writing-style library (task #21)

Status: draft for approval · 2026-10-26

## Why

How good a generated post is depends mostly on two inputs the writer gets: **how it should sound** (writing style) and **what shape it
takes** (template). Today Orbit has 24 hand-written templates in code (`packages/agent/src/library/templates.ts`) and preset styles that are
thin. This work replaces both with a large, curated library and makes the AI use it well, so posts sound like the user, vary from post to post,
avoid AI tells, and adapt to the user's niche over time.

## Goals

1. **Two layers, same architecture as the reference product.**
   - *Writing style* = how a post sounds. Stored as today (`VoiceStyle.styleProfile`, versions, corpus). Each style carries: a voice
     summary, do/don't rules for hooks, body rhythm, closings, language, formatting; measured formatting targets (blocks, hook length, line
     length, list usage); signature moves (fill-in patterns with "use when"); reference posts; final self-checks; language variant.
     The user's own style (from their posts) is the default; presets are starting points. **User rules always win** over style.
   - *Template* = what shape a post takes. Two types: **hook** (opening formula) and **post** (full skeleton). Each: title, category (15:
     authority, case-study, comparison, curated, educational, engagement, framework, lead-gen, listicle, news-and-trends, opinion, personal,
     prediction, promotional, story), skeleton with `[slots]`, ordered beats, why it works (the persuasion principle), evidence it needs
     (story / number / news / none), and tags.
2. **The AI picks, the user can override.** For every new post the writer is given one template chosen by Orbit (fit to the picked angle,
   category, the user's niche, evidence available, and rotation). The user can browse a Templates library, save/pin a template, or pick one
   in the composer; a pinned template always wins. (The reference product only applies user-pinned templates; across 100 observed chats its
   AI never searched templates. Auto-picking is our improvement.)
3. **Sounds like the user.** The writer receives 2–3 of the user's own best posts as examples (few-shot), not only rules — research shows
   examples beat style descriptions for personal voice. Learn from edits: when the user changes a draft, the diff (what they cut, added,
   reworded) updates the user's style automatically, in the background, matching the reference product (its voice/style memory is agent-extracted from chats
   with no approval step). Every update is a new style version, visible and revertible (existing `VoiceStyleVersion`). The learning guard
   stays: edits only change how the user writes, never add personal facts.
4. **Variety.** A rotation keeps the same template, hook type and structure from repeating across the user's recent posts (window: last 10
   posts). Hook candidates are generated as a spread of distinct options (verbalized-sampling style) rather than one at a time.
5. **Fewer AI tells.** Extend the existing code checks (`writing/lint.ts`, `patterns.ts`) with a maintained list of AI tells: em/en dashes
   where the user forbids them, "not just X but Y", reflexive triads, filler openers/closers, overused words ("delve", "landscape",
   "game-changer"…), uniform sentence lengths. Failing drafts get one targeted repair pass (existing W6 mechanism) before the user sees them.
6. **Adapts to the niche over time.** Per-user template scores from signals: kept with few edits, published, later engagement (when
   analytics exist). Scores bias the AI pick; niche keywords from memory/strategy steer slot fills and example selection.

## Non-goals

- Copying the reference product's template text, titles or descriptions. The local reference set (a CSV kept outside git via
  `.git/info/exclude`) is used for **coverage, structure and the quality bar**. Generic formulas everyone uses
  ("Unpopular opinion:", "X mistakes I made") are fine to keep as patterns.
- Imitating named real creators. Presets are named for the style, not a person.
- Paid model calls in tests. Library generation is a one-off offline batch with a cost cap.

## Anti-goals (failure even if it works)

- Posts that read templated: visible slot scaffolding, the same opening twice in a row, every post the same length.
- Invented personal facts to fill a story/number slot. Templates needing evidence are skipped (or the slot asked for) when evidence is missing.
- A library so large the AI picks badly; quality beats count.

## How the library gets built

1. Parse the reference set (973 rows: 563 hook, 410 post). Cluster near-duplicates per category.
2. For each cluster, one cheap model pass writes **one Orbit template**: own title, own wording, the formula and beats kept, why-it-works,
   evidence needs, tags. Batch by category; cost cap set before running.
3. Automatic overlap check against the source (n-gram similarity threshold); anything too close is regenerated. Human spot-check per category.
4. Target: roughly 250–350 templates (hooks + posts), stored in the database (`Template` table with a `system` flag; user templates and saves
   reuse it), seeded by a script. The 24 code templates migrate into it.
5. Preset writing styles (~8–12) are rewritten in the full style shape above from public-domain-style descriptions of each voice archetype
   (e.g. "blunt operator", "warm storyteller", "data teacher"), each with original reference posts.

## Where it plugs in

- **Writer brief:** chosen template (skeleton + beats), style profile, user's example posts, user rules, rotation constraints.
- **Angles step (already built):** each angle's hidden brief names a category; the template pick follows the picked angle.
- **Draft card:** shows the template used ("Template: <name> · Swap"); Swap reopens the pick with alternatives. *(my call)*
- **Composer:** a Template pill (like the style pill) to pin one; "Templates" page to browse, filter by type/category, preview, save, use.
- **Agent tools:** `searchTemplates`, `readTemplate` for explicit requests ("use a listicle"), and the automatic pick inside the writing step.

## Evidence

Reference behaviour from REA/static analysis and the user's own session (read-only), notes kept locally outside git:
style data shape (`writing-quality` §1.2), template API and fields (§2.2), pinned-template briefs ("adapt the selected pinned template…
following its section order and list/closing mechanics"), 0 template-search calls across 100 chats.
Research: few-shot beats style controls for personal voice (EMNLP 2025, arXiv 2509.14543); AI-text tells (Pangram, "9 signs of AI writing");
diversity via verbalized sampling (arXiv 2510.01171).

## Left to the builder

Exact DB schema, similarity threshold, rotation window tuning, UI layout within the Orbit design system, batch prompt wording.

## Definition of done

Unit tests for pick/rotation/lint; e2e (mock model): new post → template auto-picked and shown on the draft, pin from library overrides it,
no repeated template in two consecutive posts; seeded library loads; quality eval (W12) comparing before/after on 10 briefs within $5.
