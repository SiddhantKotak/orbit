import { getTemplateBySlug, listTemplates, prisma, setTemplateSaved } from "@brandloop/db";
import { getAccount } from "@/lib/account";

const int = (v: string | null, d: number, max: number) => Math.min(max, Math.max(0, Number.parseInt(v ?? "", 10) || d));
const NEED_PROFILE = () => Response.json({ error: "Create a profile first." }, { status: 400 });

/**
 * The template library: the shipped templates and this profile's own, filtered by type and category, searched, paged.
 * `saved=1` lists only the ones this profile saved; every row says whether it is saved.
 */
export async function getTemplatesHandler(request: Request): Promise<Response> {
  const profile = (await getAccount())?.currentProfile;
  if (!profile) return NEED_PROFILE();
  const q = new URL(request.url).searchParams;
  const type = q.get("type");
  const { items, total } = await listTemplates({
    type: type === "HOOK" || type === "POST" ? type : undefined,
    category: q.get("category") || undefined,
    search: q.get("search")?.slice(0, 100) || undefined,
    savedBy: q.get("saved") === "1" ? profile.id : undefined,
    ownerProfileId: profile.id,
    offset: int(q.get("offset"), 0, 100_000),
    limit: Math.max(1, int(q.get("limit"), 50, 100)),
  });
  return Response.json({
    total,
    items: items.map((t) => ({
      id: t.id,
      slug: t.slug,
      type: t.type,
      category: t.category,
      title: t.title,
      why: t.why,
      skeleton: t.skeleton,
      beats: t.beats,
      needs: t.needs,
      tags: t.tags,
      saved: t.saved,
    })),
  });
}

/** Saves (`saved: true`) or unsaves a template for this profile. Another profile's own template is not found. */
export async function setSavedHandler(id: string, saved: boolean): Promise<Response> {
  const profile = (await getAccount())?.currentProfile;
  if (!profile) return NEED_PROFILE();
  const row = await prisma.template.findUnique({ where: { id }, select: { id: true, system: true, profileId: true } });
  if (!row || !(row.system || row.profileId === profile.id)) return Response.json({ error: "Template not found." }, { status: 404 });
  await setTemplateSaved(profile.id, row.id, saved);
  return Response.json({ id: row.id, saved });
}

/** A template by slug, if this profile may see it. */
export async function ownTemplateBySlug(profileId: string, slug: string) {
  const t = await getTemplateBySlug(slug).catch(() => null);
  return t && (t.system || t.profileId === profileId) ? t : null;
}
