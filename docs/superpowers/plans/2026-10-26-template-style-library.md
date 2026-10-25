# Template and Writing-Style Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the 24 code templates and thin presets with a curated database library (~250–350 hook/post templates, 8–12 full preset styles) that the AI auto-picks per post with rotation, plus few-shot user examples, AI-tell checks and automatic style learning from edits.

**Architecture:** Templates move from `packages/agent/src/library/templates.ts` into Postgres (`Template`, `TemplateSave`, `TemplateUse`). The writer's format selection (`writing/format.ts`) gains an `auto` source fed by `library/pick.ts`. Library content is produced once by an offline batch script from a local reference CSV and committed as JSON seed data. Style learning runs as a background job that writes a new `VoiceStyleVersion`.

**Tech Stack:** Next.js 16 (`apps/web`), Prisma 7 (`packages/db`), AI SDK + OpenAI via `AiClient` (`packages/ai`), Vitest, Playwright (`dev:e2e`, mock model).

**Spec:** `docs/superpowers/specs/2026-10-26-template-style-library-design.md`

## Global Constraints

- Never commit the reference CSV or any text copied from it; titles/descriptions/bodies are our own wording. No third-party product or creator names in code, data, comments or commits (public repo).
- User hard rules always outrank style and template.
- Templates whose `needs` evidence is missing are never auto-picked; never invent a story, number or news item to fill a slot.
- Rotation window: the user's last 10 posts (no template repeated; hook purpose and block structure repeated at most once).
- Library batch: hard cost cap $5 total; model `gpt-6-luna`; overlap threshold: 5-gram Jaccard similarity to its source row < 0.20, otherwise regenerate (max 2 retries, then drop).
- Tests and e2e use the mock model and `TEST_DATABASE_URL` only; migrations are applied to the test DB in tasks; the controller deploys to the real DB after a backup.
- Style learning is automatic (no approval), each change a new `VoiceStyleVersion`, revertible; it runs through `learningGuard` and never stores personal facts.
- Commits: plain conventional messages, no attribution trailer.

## Review Focus

1. Library empty or seed not run → writer falls back to today's post-type plan, no crash (Task 3).
2. Every candidate used in the last 10 posts → least-recently-used candidate is picked, never null when candidates exist (Task 4).
3. Pinned template needs evidence the user didn't give → the writer leaves no `[slot]`; the reply asks for the missing fact instead of drafting (Task 4).
4. Template structure conflicts with user rules (template has a list, user forbids lists) → user rule wins, lint passes (Task 4).
5. Trivial edit (typo fix, <5% of characters changed) → no style learning job, no new version (Task 7).

---

### Task 1: Template data model and service

**Files:**
- Modify: `packages/db/prisma/schema.prisma`
- Create: `packages/db/prisma/migrations/<timestamp>_templates/migration.sql` (timestamp after `20261023090000_carousel` and any `research_brief` migration)
- Create: `packages/db/src/services/templates.ts`, `packages/db/src/services/templates.test.ts`
- Modify: `packages/db/src/index.ts`

**Interfaces:**
- Produces: models `Template {id, slug @unique, type TemplateType(HOOK|POST), category String, title, skeleton, beats String[], why, needs String[] ("story"|"number"|"news"), tags String[], system Boolean @default(true), profileId String? (user-made), createdAt, updatedAt}`, `TemplateSave {profileId, templateId, createdAt, @@id([profileId, templateId])}`, `TemplateUse {id, profileId, templateId, documentId String?, source ("auto"|"picked"), editRatio Float?, createdAt, @@index([profileId, createdAt])}`.
- Produces functions: `listTemplates(q: {type?: "HOOK"|"POST"; category?: string; search?: string; savedBy?: string; offset?: number; limit?: number}): Promise<{items: TemplateRow[]; total: number}>`, `getTemplateBySlug(slug: string): Promise<TemplateRow | null>`, `setTemplateSaved(profileId: string, templateId: string, saved: boolean): Promise<void>`, `recordTemplateUse(input: {profileId: string; templateId: string; documentId: string | null; source: "auto" | "picked"}): Promise<void>`, `recentTemplateUses(profileId: string, limit: number): Promise<{templateId: string; createdAt: Date}[]>`, `templateScores(profileId: string): Promise<Map<string, number>>` (score = mean of `1 - editRatio` over uses with a ratio, default 0.5), `upsertSystemTemplates(rows: SeedTemplate[]): Promise<number>`.

- [ ] **Step 1:** Write `templates.test.ts` (test DB helpers as in `carousels.test.ts`): upsert 3 rows then list by type/category/search returns the right subset and total; upsert again is idempotent by slug; save/unsave toggles `savedBy` filter; `recentTemplateUses` returns newest first; `templateScores` averages `1 - editRatio`, default 0.5.
- [ ] **Step 2:** Run `pnpm --filter @brandloop/db test templates` — FAIL.
- [ ] **Step 3:** Add models + migration; apply to the test DB with the repo pattern (`prisma migrate diff` → `db execute --url $TEST_DATABASE_URL` → `migrate resolve`); implement the service; export from `index.ts`.
- [ ] **Step 4:** Run the test — PASS; `pnpm --filter @brandloop/db exec tsc --noEmit` clean.
- [ ] **Step 5:** Commit `feat(db): templates, saves and template uses`.

### Task 2: Library build script (offline batch)

**Files:**
- Create: `packages/agent/scripts/build-library.ts`, `packages/agent/src/library/build.ts`, `packages/agent/src/library/build.test.ts`
- Output (committed): `packages/agent/data/templates.json`, `packages/agent/data/preset-styles.json`

**Interfaces:**
- Produces: `type SeedTemplate = {slug; type: "HOOK"|"POST"; category; title; skeleton; beats: string[]; why; needs: ("story"|"number"|"news")[]; tags: string[]}`; `clusterRows(rows: RefRow[], threshold = 0.6): RefRow[][]` (token Jaccard on normalized `content`, same `type`+`category`); `ngramSimilarity(a: string, b: string, n = 5): number`; `rewriteCluster(ai: AiClient, cluster: RefRow[]): Promise<SeedTemplate>`; `buildLibrary(opts: {rows: RefRow[]; ai: AiClient; maxUsd: number; onProgress?}): Promise<{templates: SeedTemplate[]; dropped: number; usd: number}>`.
- CLI: `pnpm --filter @brandloop/agent exec tsx --env-file-if-exists=../../.env scripts/build-library.ts --csv <path> --out data/templates.json --max-usd 5 [--dry-run]` (`--dry-run` uses the scripted mock client, no network).

- [ ] **Step 1:** Tests: `clusterRows` merges two near-identical hooks and keeps distinct ones apart; `ngramSimilarity("a b c d e f", "a b c d e f") === 1` and unrelated text ≈ 0; `buildLibrary` with a fake `AiClient` that first returns the source text verbatim regenerates it (similarity ≥ 0.20 rejected) and drops after 2 retries; stops when `maxUsd` is reached; output slugs are unique kebab-case; no output contains a source title.
- [ ] **Step 2:** Run — FAIL. **Step 3:** Implement (rewrite prompt asks for: own title, own wording, keep the formula/beats, `why` names the principle, `needs` from slot types, 2–5 tags). Also generate 10 preset styles in the `StyleProfile` shape (`packages/ai/src/style.ts`, `StyleProfileSchema`) named by archetype (e.g. "Blunt operator", "Warm storyteller", "Data teacher", "Contrarian analyst", "Builder in public", "Calm explainer", "Punchy minimalist", "Coach", "Curator", "Founder memo") with 3 original reference posts each; validate with the schema.
- [ ] **Step 4:** Tests PASS; `--dry-run` produces valid JSON.
- [ ] **Step 5:** Commit script + tests (`feat(agent): offline template library builder`). **Controller step (not the implementer):** run the real batch once (≤ $5), show the user 5 random templates per category for a spot-check, then commit the two JSON files.

### Task 3: Seed and DB-backed format selection

**Files:**
- Create: `packages/db/prisma/seed-templates.ts`
- Modify: `packages/agent/src/writing/format.ts`, `packages/agent/src/types.ts` (drop static `FORMAT_IDS` refine for templates; keep frameworks), `packages/agent/src/library/templates.ts` (the 24 rows move into `templates.json`; file keeps the `Template` type re-exported from the DB row shape), `apps/web/src/components/chat/format-menu.tsx` (load templates from `/api/templates`)
- Test: `packages/agent/src/writing/format.test.ts`

**Interfaces:**
- Consumes: Task 1 service, Task 2 `SeedTemplate`.
- Produces: `selectFormat(input: {selectedFormatId: string | null; postType; style; request; template: TemplateRow | null}): Format` — `Format.source` gains `"auto"`; `template` is the resolved pinned or auto-picked row (resolution happens in Task 4). Pinned id unknown → ignored (no 400) and the turn proceeds with auto.

- [ ] **Step 1:** Tests: template given → plan from skeleton, `source` reflects picked/auto; `template: null` and no framework → existing post-type behaviour unchanged (Review Focus 1); framework id still works.
- [ ] **Step 2–4:** FAIL → implement (seed script upserts `templates.json` with `system=true`; `pnpm --filter @brandloop/db exec tsx prisma/seed-templates.ts`) → PASS.
- [ ] **Step 5:** Commit `feat: templates load from the database`.

### Task 4: Auto-pick with rotation in the writing step

**Files:**
- Create: `packages/agent/src/library/pick.ts`, `pick.test.ts`
- Modify: `packages/agent/src/tools/delegate.ts` (`WritingInput` gains `templateSlug?: string | null`; `delegateWritingRun` resolves pinned/auto template and records `TemplateUse` on `createDocument`), `packages/agent/src/tools/options.ts` (option gains `category: string | null`), `packages/agent/src/prompt.ts` (angles carry a category), `packages/agent/src/specialists/prompts.ts` (writer: follow template beats, never leave a slot, user rules win)

**Interfaces:**
- Produces: `pickTemplate(input: {candidates: TemplateRow[]; category: string | null; evidence: {hasStory: boolean; numbers: string[]; hasNews: boolean}; recent: string[] /* template ids, newest first, ≤10 */; scores: Map<string, number>; nicheTerms: string[]; seed: string}): TemplateRow | null`.
- Scoring (deterministic for a seed): drop candidates whose `needs` aren't met; category match +3; each tag overlapping `nicheTerms` +1 (max +2); `+ 2 × score`; candidates in `recent` excluded unless all are, then least-recent wins; ties broken by `hash(seed:id)` (reuse `hash` in `library/index.ts`).
- `nicheTerms`: content-strategy pillar names plus the user's memory `topics/<slug>` slugs (lowercased words), loaded once per turn.
- Agent tools `searchTemplates({query, type, category})` and `readTemplate({slug})` (in `packages/agent/src/tools/templates.ts`, added to `buildTools`) for explicit asks like "use a listicle"; a slug chosen this way is passed as `templateSlug` and recorded as `source:"picked"`.

- [ ] **Step 1:** Tests: evidence gate excludes a `needs:["story"]` template; category beats tags; recent exclusion; all-recent → least recent (Review Focus 2); same seed → same pick; integration test in `delegate` (mock specialist) records one `TemplateUse` with `source:"auto"`; pinned template needing a missing number → writer brief instructs asking for it and no draft is created (Review Focus 3); user rule `forbidLists` + list template → lint passes because rules win (Review Focus 4).
- [ ] **Step 2–4:** FAIL → implement → PASS (`pnpm --filter @brandloop/agent test pick delegate`).
- [ ] **Step 5:** Commit `feat(agent): auto-pick templates with rotation`.

### Task 5: AI-tell checks

**Files:** Modify `packages/agent/src/writing/patterns.ts`, `writing/lint.ts` (new `LintId`s), `specialists/checks.ts` (`WRITING_CHECK_IDS` adds `ai-tells`); Test `writing/lint.test.ts`.

**Interfaces:** `aiTells(text: string): {id: "not-just" | "triad" | "filler" | "overused" | "uniform-rhythm"; detail: string}[]`. Violations level `"target"` (repair pass fixes them; they never block saving).
- Lists: overused = delve, tapestry, landscape, game-changer, unlock, elevate, leverage (verb), seamless, robust, pivotal, "in today's fast-paced", "let's dive in", "here's the kicker", "the best part?"; `not-just` = /\bnot (just|only) [^.]{1,60}(,)? but\b/i and "It's not X. It's Y." pairs; `triad` = ≥2 sentences with "A, B, and C" lists; `uniform-rhythm` = ≥6 sentences with length coefficient of variation < 0.25.

- [ ] Steps: tests per detector incl. false-positive guards ("not only on Mondays" without "but"); FAIL → implement → PASS → commit `feat(agent): flag common AI tells for the repair pass`.

### Task 6: User's own posts as examples

**Files:** Modify `packages/agent/src/writing/inject.ts` (new `renderExamplesBlock(posts: string[], budget = 2_500): string`), the writer context assembly in `delegate.ts`; Create helper `pickExamplePosts(corpus: {text; source; postedAt}[], style: StyleProfile | null, n = 3): string[]` in `writing/examples.ts`; Test `writing/examples.test.ts`.

- Selection: prefer source `ORBIT` then `EXPORT` then `PASTE`; length within the style's `postCharacters` range; newest first; never more than 3; empty corpus → block omitted.
- [ ] Steps: tests (ordering, budget truncation at a post boundary, empty) → FAIL → implement → PASS → commit `feat(agent): writer sees the user's own posts as examples`.

### Task 7: Automatic style learning from edits

**Files:** Create `packages/agent/src/writing/learn-edits.ts`, test; Modify document save path (`packages/db/src/services/documents.ts` caller in `apps/web/src/lib/documents-api.ts`) to enqueue a job via `@brandloop/jobs` when a `USER_EDIT` version is saved; `apps/web/src/lib/run-job.ts` handler; Settings style sheet (`apps/web/src/components/chat/style-details-sheet.tsx` or the writing-style settings page) gets "History" with Revert if not present.

**Interfaces:** `editDelta(aiText: string, userText: string): {ratio: number; removed: string[]; added: string[]}`; `learnFromEdit(ai: AiClient, input: {profile: StyleProfile; aiText; userText}): Promise<{rules: StyleProfile["rules"]; changed: boolean}>` (max 7 do/dont per area kept; passes `learningGuard`); job `style.learn-from-edit {profileId, documentId}`: compares the latest AI version with the user's current text, skips when ratio < 0.05 (Review Focus 5), writes a new `VoiceStyleVersion` + updates `VoiceStyle.styleProfile`, and stores `editRatio` on the matching `TemplateUse`.
- [ ] Steps: tests (tiny edit → no job/no version; real edit → one new version; facts never written; revert restores previous profile) → FAIL → implement (mock `AiClient` in tests) → PASS → commit `feat: learn writing style from the user's edits`.

### Task 8: Templates library page, pinning and draft card

**Files:** Replace `apps/web/src/app/(app)/templates/page.tsx` (title "Templates"); Create `apps/web/src/components/templates/*` (grid, filters type/category/search, preview sheet, Save, Use); API `apps/web/src/app/api/templates/route.ts` (GET list), `api/templates/[id]/save/route.ts` (PUT/DELETE); "Use" opens a new chat with the template pinned (`selectedFormatId` = slug); draft card (`message-parts.tsx` createDocument card) shows "Template: <title> · Swap" — Swap opens the format menu filtered to the same category and re-applies via `updateDocument`. Tests: route unit tests; e2e `apps/web/e2e/templates.spec.ts`.

- [ ] e2e: library lists templates with type/category filters; Save persists across reload; Use → new chat with the template pinned → "create a post on llm" → pick angle → draft card shows "Template: <title>"; a second post in the same profile shows a different template (rotation).
- [ ] Steps: tests → FAIL → implement (Orbit components/tokens) → PASS → commit `feat(web): templates library, pinning and template on the draft card`.

### Task 9: Preset styles upgrade

**Files:** Modify the preset seed (find where `VoiceKind.PRESET` rows are created, W3 commit `eff915d`) to load `packages/agent/data/preset-styles.json`; Test that each preset parses with `StyleProfileSchema` and renders under `STYLE_BUDGET`.
- [ ] Steps: test → FAIL → implement → PASS → commit `feat: richer preset writing styles`.

### Task 10: Quality eval (controller, needs user go-ahead for spend)

Run the existing eval (`pnpm --filter @brandloop/agent eval`) on 10 briefs before (current `main`) and after, ≤ $5 total; report scores for voice match, variety (distinct templates/hooks), AI-tell count, and grounding. Real-DB deploy of the Task 1 migration after a backup.
