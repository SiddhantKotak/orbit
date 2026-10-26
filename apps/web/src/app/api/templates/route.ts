import { listTemplates } from "@brandloop/db";
import { getAccount } from "@/lib/account";

const int = (v: string | null, d: number, max: number) => Math.min(max, Math.max(0, Number.parseInt(v ?? "", 10) || d));

/** The template library for the composer's Format menu: filter by type and category, search, and page. */
export async function GET(request: Request) {
  if (!(await getAccount())?.currentProfile) return Response.json({ error: "Create a profile first." }, { status: 400 });
  const q = new URL(request.url).searchParams;
  const type = q.get("type");
  const { items, total } = await listTemplates({
    type: type === "HOOK" || type === "POST" ? type : undefined,
    category: q.get("category") || undefined,
    search: q.get("search") || undefined,
    offset: int(q.get("offset"), 0, 100_000),
    limit: Math.max(1, int(q.get("limit"), 50, 100)),
  });
  return Response.json({
    total,
    items: items.map((t) => ({ slug: t.slug, type: t.type, category: t.category, title: t.title, why: t.why, skeleton: t.skeleton, tags: t.tags })),
  });
}
