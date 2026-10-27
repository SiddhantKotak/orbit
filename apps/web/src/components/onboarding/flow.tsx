"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Button, Hint, Input, Label, Logo, NativeSelect, Pill, cn } from "@brandloop/ui";
import { ONBOARDING_GOALS, type OnboardingGoal } from "@brandloop/ai/constants";
import type { Strategy } from "@brandloop/ai/schemas";
import type { OnboardingAnswers, PostLength } from "@brandloop/db";
import { textareaClass } from "@/components/dialog-classes";
import { suggestTopics } from "@/lib/onboarding-topics";
import { finishAction, goToStepAction, leaveAction, saveStepAction, skipStepAction } from "@/app/onboarding/actions";
import { StrategyReview } from "./strategy-review";

export type Preset = { id: string; name: string; tagline: string | null };

const STEPS = [
  { title: "About you", short: "About" },
  { title: "Goal and audience", short: "Goal" },
  { title: "Your voice", short: "Voice" },
  { title: "Topics and proof", short: "Topics" },
  { title: "Your strategy", short: "Strategy" },
] as const;

const SUBTITLE = [
  "A few basics so your drafts sound like they come from you.",
  "What you want LinkedIn to do for you, and who you want to reach.",
  "Show us how you write, or start from a style you like.",
  "What you want to be known for, and the proof you are happy to share.",
  "A plan built from your answers. Change anything, then confirm.",
];

const ROLES = ["Founders", "Engineering leaders", "Marketing leaders", "Hiring managers", "Recruiters", "Product managers", "Designers", "Investors", "Early-career people"];
const INDUSTRIES = ["Software and SaaS", "Fintech", "Healthcare", "E-commerce", "Education", "Agencies and consulting", "Manufacturing", "Media"];
const SIZES = ["Solo", "2 to 10", "11 to 50", "51 to 200", "201 to 1,000", "1,000+"];
const LENGTHS: { id: PostLength; label: string }[] = [
  { id: "short", label: "Short" },
  { id: "medium", label: "Medium" },
  { id: "long", label: "Long" },
];

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const splitPosts = (text: string) => text.split(/^\s*---\s*$/m).map((p) => p.trim()).filter(Boolean);

function Toggle({ id, label, hint, checked, onChange }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <label htmlFor={id} className="flex cursor-pointer items-center justify-between gap-4 rounded-card-sm border border-line-control px-4 py-3 has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-accent-text">
      <span className="min-w-0">
        <span className="block text-[14px] font-medium text-text">{label}</span>
        <span className="block text-xs text-text-2">{hint}</span>
      </span>
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} className="size-5 shrink-0 accent-[var(--accent)]" />
    </label>
  );
}

function ChipGroup({ legend, options, value, onChange }: { legend: string; options: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const all = [...options, ...value.filter((v) => !options.includes(v))];
  return (
    <fieldset className="min-w-0">
      <legend className="mb-2 text-[13px] font-medium text-text">{legend}</legend>
      <div className="flex flex-wrap gap-2">
        {all.map((o) => (
          <Pill key={o} selected={value.includes(o)} onClick={() => onChange(value.includes(o) ? value.filter((v) => v !== o) : [...value, o])}>
            {o}
          </Pill>
        ))}
      </div>
    </fieldset>
  );
}

export function OnboardingFlow({
  initialStep,
  answers,
  completed,
  defaults,
  presets,
  selectedVoiceId,
}: {
  initialStep: number;
  answers: OnboardingAnswers;
  completed: boolean;
  defaults: { fullName: string; timezone: string };
  presets: Preset[];
  selectedVoiceId: string | null;
}) {
  const router = useRouter();
  const [step, setStep] = useState(initialStep);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const heading = useRef<HTMLHeadingElement>(null);
  const first = useRef(true);

  // Step 1
  const [fullName, setFullName] = useState(answers.about?.fullName ?? defaults.fullName);
  const [jobTitle, setJobTitle] = useState(answers.about?.jobTitle ?? "");
  const [company, setCompany] = useState(answers.about?.company ?? "");
  const [timezone, setTimezone] = useState(answers.about?.timezone ?? defaults.timezone);
  const tzEdited = useRef(Boolean(answers.about));
  const timezones = useMemo(() => {
    const all = Intl.supportedValuesOf("timeZone");
    return all.includes(timezone) ? all : [timezone, ...all];
  }, [timezone]);
  useEffect(() => {
    if (tzEdited.current) return;
    const detected = Intl.DateTimeFormat().resolvedOptions().timeZone;
    // After hydration, so the server and first client render agree.
    const t = setTimeout(() => detected && !tzEdited.current && setTimezone(detected), 0);
    return () => clearTimeout(t);
  }, []);

  // Step 2
  const [goal, setGoal] = useState<OnboardingGoal | null>(answers.goal?.goal ?? null);
  const [goalNote, setGoalNote] = useState(answers.goal?.note ?? "");
  const [roles, setRoles] = useState(answers.audience?.roles ?? []);
  const [industries, setIndustries] = useState(answers.audience?.industries ?? []);
  const [sizes, setSizes] = useState(answers.audience?.sizes ?? []);
  const [audienceText, setAudienceText] = useState(answers.audience?.text ?? "");
  const [offer, setOffer] = useState(answers.offer ?? "");

  // Step 3
  const v = answers.voice;
  const [voiceMode, setVoiceMode] = useState<"preset" | "own" | "none">(v?.mode ?? "none");
  const [voiceStyleId, setVoiceStyleId] = useState<string | null>(v?.voiceStyleId ?? selectedVoiceId);
  const [posts, setPosts] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [learn, setLearn] = useState<"idle" | "working" | "ready">(v?.mode === "own" && v.voiceStyleId ? "ready" : "idle");
  const [allowEmoji, setAllowEmoji] = useState(v?.allowEmoji ?? false);
  const [allowHashtags, setAllowHashtags] = useState(v?.allowHashtags ?? false);
  const [allowDashes, setAllowDashes] = useState(v?.allowDashes ?? false);
  const [allowLists, setAllowLists] = useState(v?.allowLists ?? true);
  const [length, setLength] = useState<PostLength>(v?.length ?? "medium");

  // Step 4
  const [topics, setTopics] = useState(answers.topics?.topics ?? []);
  const [topicDraft, setTopicDraft] = useState("");
  const [story1, setStory1] = useState(answers.topics?.stories?.[0] ?? "");
  const [story2, setStory2] = useState(answers.topics?.stories?.[1] ?? "");
  const suggestions = useMemo(() => suggestTopics({ jobTitle, company, goal: goal ?? undefined }), [jobTitle, company, goal]);

  // Step 5
  const [draft, setDraft] = useState<Strategy | null>(null);
  const [drafting, setDrafting] = useState(false);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    heading.current?.focus();
  }, [step]);

  async function makeDraft() {
    setDrafting(true);
    setError(null);
    try {
      const res = await fetch("/api/onboarding/strategy", { method: "POST" });
      const body = (await res.json().catch(() => ({}))) as { strategy?: Strategy; error?: string };
      if (!res.ok || !body.strategy) setError(body.error ?? "Couldn't draft your strategy. Try again.");
      else setDraft(body.strategy);
    } catch {
      setError("Couldn't draft your strategy. Try again.");
    }
    setDrafting(false);
  }

  useEffect(() => {
    if (step !== 5 || draft || drafting || error) return;
    const t = setTimeout(() => void makeDraft(), 0);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  async function learnStyle() {
    setError(null);
    let init: RequestInit;
    if (file) {
      const form = new FormData();
      form.set("file", file);
      init = { method: "POST", body: form };
    } else {
      const list = splitPosts(posts);
      if (list.length < 3 || list.some((p) => p.length < 200)) {
        setError("Paste at least 3 posts of 200+ characters, separated by a line with ---");
        return;
      }
      init = { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ posts: list }) };
    }
    setLearn("working");
    try {
      const res = await fetch("/api/voice/own", init);
      const body = (await res.json().catch(() => ({}))) as { jobId?: string; voiceStyleId?: string; error?: string };
      if (!res.ok || !body.jobId || !body.voiceStyleId) throw new Error(body.error || "Couldn't start learning your style");
      for (let i = 0; i < 150; i++) {
        await wait(i < 5 ? 800 : 2000);
        const j = await fetch(`/api/jobs/${body.jobId}`);
        if (!j.ok) continue;
        const job = (await j.json()) as { status: string; error?: string | null };
        if (job.status === "DONE") {
          setVoiceMode("own");
          setVoiceStyleId(body.voiceStyleId);
          setLearn("ready");
          return;
        }
        if (job.status === "FAILED") throw new Error(job.error || "Couldn't learn your style");
      }
      throw new Error("Learning your style is taking longer than expected. You can skip this and add it later.");
    } catch (err) {
      setLearn("idle");
      setError(err instanceof Error ? err.message : "Couldn't learn your style");
    }
  }

  function payload() {
    if (step === 1) return { step: 1, about: { fullName, jobTitle, company, timezone } };
    if (step === 2) return { step: 2, goal: { goal, note: goalNote }, audience: { roles, industries, sizes, text: audienceText }, offer };
    if (step === 3) return { step: 3, voice: { mode: voiceMode, voiceStyleId: voiceMode === "none" ? null : voiceStyleId, allowEmoji, allowHashtags, allowDashes, allowLists, length } };
    return { step: 4, topics: { topics, stories: [story1, story2].filter((s) => s.trim()) } };
  }

  function validate(): string | null {
    if (step === 1) {
      if (!fullName.trim()) return "Tell us your name";
      if (!jobTitle.trim()) return "Tell us your role or title";
    }
    if (step === 2 && !goal) return "Choose what you want LinkedIn to do for you";
    return null;
  }

  function go(next: number) {
    setError(null);
    setStep(next);
    void goToStepAction(next);
  }

  function onContinue() {
    const problem = validate();
    if (problem) return setError(problem);
    setError(null);
    startTransition(async () => {
      const result = await saveStepAction(payload());
      if (!result.ok) return setError(result.error);
      setStep(step + 1);
    });
  }

  function onSkip() {
    setError(null);
    startTransition(async () => {
      const result = await skipStepAction(step);
      if (!result.ok) return setError(result.error);
      setStep(step + 1);
    });
  }

  function onLeave() {
    startTransition(async () => {
      if (!completed) await leaveAction();
      router.push(completed ? "/settings" : "/");
      router.refresh();
    });
  }

  function onConfirm(strategy: Strategy | null) {
    setError(null);
    startTransition(async () => {
      const result = await finishAction(strategy);
      if (!result.ok) return setError(result.error);
      router.push("/?welcome=1");
      router.refresh();
    });
  }

  const optional = step >= 2 && step <= 4;
  const body: ReactNode =
    step === 1 ? (
      <div className="flex flex-col gap-5">
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-name">Your name</Label>
          <Input id="ob-name" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-role">Role or title</Label>
          <Input id="ob-role" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Head of design" autoComplete="organization-title" required />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-company">Company or industry</Label>
          <Input id="ob-company" value={company} onChange={(e) => setCompany(e.target.value)} placeholder="Fintech" autoComplete="organization" />
          <Hint>Optional. Use whichever you would say first.</Hint>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-tz">Timezone</Label>
          <NativeSelect
            id="ob-tz"
            value={timezone}
            onChange={(e) => {
              tzEdited.current = true;
              setTimezone(e.target.value);
            }}
          >
            {timezones.map((t) => (
              <option key={t} value={t}>
                {t.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
          <Hint>Detected from your browser. Used for your posting schedule.</Hint>
        </div>
      </div>
    ) : step === 2 ? (
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-text">What do you want LinkedIn to do for you?</legend>
          <div role="radiogroup" aria-label="Primary goal" className="flex flex-wrap gap-2">
            {(Object.keys(ONBOARDING_GOALS) as OnboardingGoal[]).map((g) => (
              <button key={g} type="button" role="radio" aria-checked={goal === g} onClick={() => setGoal(g)} className={cn("orbit-transition min-h-10 rounded-pill border px-4 text-[14px] font-medium", goal === g ? "border-inverse bg-inverse text-on-inverse" : "border-line-control text-text hover:border-text-3")}>
                {ONBOARDING_GOALS[g].label}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-goal-note">Anything to add about your goal?</Label>
          <Input id="ob-goal-note" value={goalNote} onChange={(e) => setGoalNote(e.target.value)} placeholder="Optional" />
        </div>
        <ChipGroup legend="Who do you want to reach? Roles" options={ROLES} value={roles} onChange={setRoles} />
        <ChipGroup legend="Industries" options={INDUSTRIES} value={industries} onChange={setIndustries} />
        <ChipGroup legend="Company size" options={SIZES} value={sizes} onChange={setSizes} />
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-audience">Describe them in your own words</Label>
          <Input id="ob-audience" value={audienceText} onChange={(e) => setAudienceText(e.target.value)} placeholder="Optional" />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-offer">What do you offer?</Label>
          <textarea id="ob-offer" rows={3} value={offer} onChange={(e) => setOffer(e.target.value)} className={textareaClass} placeholder="A service, a product, a role you are hiring for. Optional." />
        </div>
      </div>
    ) : step === 3 ? (
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="mb-2 text-[13px] font-medium text-text">Start from a style</legend>
          <div role="radiogroup" aria-label="Writing style" className="grid gap-2 sm:grid-cols-2">
            {presets.map((p) => {
              const on = voiceMode === "preset" && voiceStyleId === p.id;
              return (
                <button key={p.id} type="button" role="radio" aria-checked={on} onClick={() => (setVoiceMode("preset"), setVoiceStyleId(p.id))} className={cn("orbit-transition rounded-card-sm border px-4 py-3 text-left", on ? "border-inverse bg-inverse text-on-inverse" : "border-line-control text-text hover:border-text-3")}>
                  <span className="block text-[14px] font-medium">{p.name}</span>
                  {p.tagline && <span className={cn("block text-xs", on ? "text-on-inverse" : "text-text-2")}>{p.tagline}</span>}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="flex flex-col gap-1.5 rounded-card-sm border border-line-control p-4">
          <Label htmlFor="ob-posts">Or paste 3 to 5 of your own posts</Label>
          <textarea id="ob-posts" rows={6} value={posts} onChange={(e) => (setPosts(e.target.value), setError(null))} disabled={learn === "working"} className={textareaClass} placeholder={"First post…\n---\nSecond post…\n---\nThird post…"} />
          <Hint>Separate posts with a line containing ---. Or upload your LinkedIn export (Shares.csv or the zip).</Hint>
          <input aria-label="LinkedIn export file" type="file" accept=".csv,.zip,text/csv,application/zip" disabled={learn === "working"} onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="text-[13px] text-text-2 file:mr-3 file:rounded-pill file:border file:border-line-control file:bg-transparent file:px-3 file:py-1.5 file:text-[13px] file:text-text" />
          <div className="mt-1 flex items-center gap-3">
            <Button type="button" variant="secondary" size="sm" onClick={learnStyle} disabled={learn === "working" || (!file && splitPosts(posts).length === 0)}>
              Learn my style
            </Button>
            <span role="status" className="text-[13px] text-text-2">
              {learn === "working" ? "Analysing your posts…" : learn === "ready" ? "Your style is ready and selected." : ""}
            </span>
          </div>
        </div>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-1 text-[13px] font-medium text-text">Quick rules</legend>
          <Toggle id="ob-emoji" label="Emojis" hint="Allow emojis in posts" checked={allowEmoji} onChange={setAllowEmoji} />
          <Toggle id="ob-hashtags" label="Hashtags" hint="Allow hashtags" checked={allowHashtags} onChange={setAllowHashtags} />
          <Toggle id="ob-dashes" label="Dashes" hint="Allow em and en dashes" checked={allowDashes} onChange={setAllowDashes} />
          <Toggle id="ob-lists" label="Lists" hint="Allow bullet and numbered lists" checked={allowLists} onChange={setAllowLists} />
          <div role="radiogroup" aria-label="Post length" className="mt-1 flex items-center gap-2">
            <span className="mr-1 text-[13px] text-text-2">Length</span>
            {LENGTHS.map((l) => (
              <button key={l.id} type="button" role="radio" aria-checked={length === l.id} onClick={() => setLength(l.id)} className={cn("orbit-transition h-8 rounded-pill border px-3.5 text-[13px] font-medium", length === l.id ? "border-inverse bg-inverse text-on-inverse" : "border-line-control text-text hover:border-text-3")}>
                {l.label}
              </button>
            ))}
          </div>
        </fieldset>
      </div>
    ) : step === 4 ? (
      <div className="flex flex-col gap-6">
        <fieldset>
          <legend className="mb-1 text-[13px] font-medium text-text">Pick 3 to 5 topics you want to be known for</legend>
          <Hint className="mb-2">Suggestions from your role. Add your own below.</Hint>
          <div className="flex flex-wrap gap-2">
            {[...suggestions, ...topics.filter((t) => !suggestions.includes(t))].map((t) => (
              <Pill key={t} selected={topics.includes(t)} onClick={() => setTopics(topics.includes(t) ? topics.filter((x) => x !== t) : topics.length < 5 ? [...topics, t] : topics)}>
                {t}
              </Pill>
            ))}
          </div>
          <form
            className="mt-3 flex gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              const t = topicDraft.trim();
              if (t && topics.length < 5 && !topics.some((x) => x.toLowerCase() === t.toLowerCase())) setTopics([...topics, t]);
              setTopicDraft("");
            }}
          >
            <Input aria-label="Add your own topic" value={topicDraft} onChange={(e) => setTopicDraft(e.target.value)} placeholder="Add your own" />
            <Button type="submit" variant="secondary" size="md">
              Add
            </Button>
          </form>
          <p className="mt-2 text-xs text-text-2" aria-live="polite">
            {topics.length} of 5 selected
          </p>
        </fieldset>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-story1">A story or result you are happy to share</Label>
          <textarea id="ob-story1" rows={3} value={story1} onChange={(e) => setStory1(e.target.value)} className={textareaClass} placeholder="Only things that are true. Optional." />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ob-story2">Another one</Label>
          <textarea id="ob-story2" rows={3} value={story2} onChange={(e) => setStory2(e.target.value)} className={textareaClass} placeholder="Optional" />
        </div>
      </div>
    ) : (
      <StrategyReview draft={draft} drafting={drafting} onChange={setDraft} onRetry={() => void makeDraft()} />
    );

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[640px] flex-col px-5 pb-10 pt-6 sm:px-6">
      <header className="flex items-center justify-between gap-3">
        <Logo size={26} />
        <Button variant="ghost" size="sm" onClick={onLeave} disabled={pending}>
          {completed ? "Close" : "Skip setup"}
        </Button>
      </header>

      <nav aria-label="Setup progress" className="mt-8">
        <ol className="flex items-center gap-2">
          {STEPS.map((s, i) => (
            <li key={s.title} aria-current={step === i + 1 ? "step" : undefined} className="flex min-w-0 flex-1 flex-col gap-2">
              <span className={cn("h-1 rounded-pill", i + 1 <= step ? "bg-accent" : "bg-line-3")} />
              <span className={cn("hidden truncate text-xs sm:block", step === i + 1 ? "text-text" : "text-text-3")}>
                <span className="sr-only">Step {i + 1}: </span>
                {s.short}
              </span>
            </li>
          ))}
        </ol>
        <p className="mt-3 text-xs text-text-2 sm:hidden">
          Step {step} of {STEPS.length}
        </p>
      </nav>

      <main key={step} className="route-view--enter mt-8 flex flex-1 flex-col">
        <h1 ref={heading} tabIndex={-1} className="type-page-title text-text focus-visible:outline-none">
          {STEPS[step - 1]!.title}
        </h1>
        <p className="mt-2 text-[15px] leading-[1.55] text-text-2">{SUBTITLE[step - 1]}</p>
        <div className="mt-7">{body}</div>
        {error && (
          <p role="alert" className="mt-5 text-[13px] text-danger">
            {error}
          </p>
        )}
      </main>

      <footer className="mt-10 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={() => go(step - 1)} disabled={step === 1 || pending}>
          Back
        </Button>
        <div className="flex items-center gap-2">
          {optional && (
            <Button variant="secondary" onClick={onSkip} disabled={pending}>
              Skip
            </Button>
          )}
          {step === 5 ? (
            <>
              <Button variant="secondary" onClick={() => onConfirm(null)} disabled={pending || drafting}>
                Skip strategy
              </Button>
              <Button onClick={() => onConfirm(draft)} disabled={pending || drafting || !draft}>
                Confirm and start
              </Button>
            </>
          ) : (
            <Button onClick={onContinue} disabled={pending || learn === "working"}>
              Continue
            </Button>
          )}
        </div>
      </footer>
    </div>
  );
}
