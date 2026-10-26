import { CATEGORIES } from "@brandloop/agent/client";

export type TemplateDto = {
  id: string;
  slug: string;
  type: "HOOK" | "POST";
  category: string;
  title: string;
  why: string;
  skeleton: string;
  beats: string[];
  needs: string[];
  tags: string[];
  saved: boolean;
};

export const categoryLabel = (id: string) => CATEGORIES.find((c) => c.id === id)?.label ?? id.replace(/-/g, " ").replace(/^./, (c) => c.toUpperCase());

/** What the writer must supply for a template, in words ("story" -> "a real story of yours"). */
export const NEED_LABELS: Record<string, string> = { story: "A real story of yours", number: "A real number", news: "A recent news item" };

/** The home link that starts a chat with this post template pinned. */
export const templateHref = (slug: string) => `/?template=${encodeURIComponent(slug)}`;
