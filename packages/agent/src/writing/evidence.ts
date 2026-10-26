import { extractNumbers } from "./measure";

export type Evidence = { hasStory: boolean; numbers: string[]; hasNews: boolean };

/**
 * What the user has supplied that a post could lean on: a story (saved knowledge, or a first-person experience in the
 * text), numbers, and news. Shared by hook purposes and template picking so both gate on the same facts.
 * `facts` is the provenance text (request plus grounding); `topic` is the user's topic in the orchestrator's words.
 */
export function gatherEvidence(input: { facts: string; topic: string; hasKnowledge: boolean; hasResearch?: boolean }): Evidence {
  const hasStory =
    input.hasKnowledge ||
    /\b(?:I|we)\s+(?:\w+\s+)?(?:hired|built|launched|started|lost|made|learned|failed|shipped|quit|raised|sold)\b|\bmy (?:first|last|client|team|company)\b/i.test(input.facts);
  return {
    hasStory,
    numbers: extractNumbers(input.facts),
    hasNews: Boolean(input.hasResearch) || /\b(?:announc|launch|releas|new feature|just shipped)/i.test(input.topic),
  };
}
