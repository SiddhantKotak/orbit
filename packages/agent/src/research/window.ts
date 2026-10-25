/** The research window (design §6.1): "this week" is Monday to today in the user's timezone, and it stays a week. */
export type ResearchWindow = { start: string; end: string; label: string };

const MONTHS = ["january", "february", "march", "april", "may", "june", "july", "august", "september", "october", "november", "december"];
const SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function localDate(now: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

const utc = (ymd: string) => new Date(`${ymd}T00:00:00Z`);
const fmt = (d: Date) => d.toISOString().slice(0, 10);
const addDays = (ymd: string, n: number) => fmt(new Date(utc(ymd).getTime() + n * 86_400_000));
/** Monday = 0 … Sunday = 6. */
const weekday = (ymd: string) => (utc(ymd).getUTCDay() + 6) % 7;

export function windowLabel(start: string, end: string): string {
  const [s, e] = [utc(start), utc(end)];
  const day = (d: Date) => d.getUTCDate();
  const mon = (d: Date) => SHORT[d.getUTCMonth()]!;
  if (start === end) return `${day(s)} ${mon(s)}`;
  if (s.getUTCMonth() === e.getUTCMonth() && s.getUTCFullYear() === e.getUTCFullYear()) return `${day(s)}–${day(e)} ${mon(e)}`;
  return `${day(s)} ${mon(s)} – ${day(e)} ${mon(e)}`;
}

const make = (start: string, end: string): ResearchWindow => ({ start, end, label: windowLabel(start, end) });

/** A window the text names, or null. "This week" is Monday to today and is never widened to the month. */
export function resolveWindow(text: string, now: Date, timezone: string): ResearchWindow | null {
  const t = text.toLowerCase();
  const today = localDate(now, timezone);
  if (/\byesterday\b/.test(t)) return make(addDays(today, -1), addDays(today, -1));
  const past = /\b(?:past|last)\s+(\d{1,3})\s+days?\b/.exec(t);
  if (past) return make(addDays(today, -(Math.max(1, Number(past[1])) - 1)), today);
  if (/\blast week\b/.test(t)) {
    const monday = addDays(today, -weekday(today) - 7);
    return make(monday, addDays(monday, 6));
  }
  if (/\bthis week\b|\bthe week so far\b/.test(t)) return make(addDays(today, -weekday(today)), today);
  if (/\bthis month\b/.test(t)) return make(`${today.slice(0, 7)}-01`, today);
  if (/\btoday\b|\bjust announced\b|\bbreaking\b/.test(t)) return make(today, today);
  const month = MONTHS.findIndex((m) => new RegExp(`\\b${m}\\b`).test(t) && !(m === "may" && !/\b(in|during|for|of)\s+may\b|\bmay\s+20\d\d\b/.test(t)));
  if (month >= 0) {
    const thisYear = Number(today.slice(0, 4));
    const named = /\b(20\d\d)\b/.exec(t)?.[1];
    const year = named ? Number(named) : month > Number(today.slice(5, 7)) - 1 ? thisYear - 1 : thisYear;
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const last = fmt(new Date(Date.UTC(year, month + 1, 0)));
    return make(start, last > today ? today : last);
  }
  return null;
}

/** The default for a timely request that names no window: the last 7 days. */
export function defaultWindow(now: Date, timezone: string): ResearchWindow {
  const today = localDate(now, timezone);
  return make(addDays(today, -6), today);
}

/** "19 October to 22 October 2026", for the search query text. */
export function windowWords(w: ResearchWindow): string {
  const f = (ymd: string) => `${utc(ymd).getUTCDate()} ${MONTHS[utc(ymd).getUTCMonth()]![0]!.toUpperCase()}${MONTHS[utc(ymd).getUTCMonth()]!.slice(1)} ${utc(ymd).getUTCFullYear()}`;
  return w.start === w.end ? f(w.start) : `${f(w.start)} to ${f(w.end)}`;
}

export const inWindow = (ymd: string, w: ResearchWindow) => ymd >= w.start && ymd <= w.end;
