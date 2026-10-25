const PATTERNS: [RegExp, string][] = [
  [/\b(?:today|yesterday|tonight)\b/i, "a day is named"],
  [/\b(?:this|last) (?:week|month)\b|\bpast \d+ days\b|\blast \d+ days\b/i, "a recent period is named"],
  [/\b(?:latest|breaking|trending|just announced|just launched|just released|right now|these days|recently|news)\b/i, "news phrasing"],
  [/\b(?:january|february|march|april|june|july|august|september|october|november|december)\b/i, "a month is named"],
  [/\b(?:in|during|for|of) may\b|\bmay 20\d\d\b/i, "a month is named"],
  [/\b20\d\d\b/, "a year is named"],
];

/** Whether a request needs current facts (design §6.1): news phrasing, a recent period, a month or a year. Evergreen topics do not. */
export function isTimely(text: string): { timely: boolean; reason: string | null } {
  for (const [re, reason] of PATTERNS) if (re.test(text)) return { timely: true, reason };
  return { timely: false, reason: null };
}
