import { Prisma, type Template, type TemplateType } from "../generated/prisma/client";
import { prisma } from "../client";

export type TemplateRow = Template;
export type SeedTemplate = {
  slug: string;
  type: TemplateType;
  category: string;
  title: string;
  skeleton: string;
  beats: string[];
  why: string;
  needs: string[];
  tags: string[];
};

export type TemplateQuery = { type?: TemplateType; category?: string; search?: string; savedBy?: string; offset?: number; limit?: number };

export async function listTemplates(q: TemplateQuery): Promise<{ items: TemplateRow[]; total: number }> {
  const search = q.search?.trim();
  const where: Prisma.TemplateWhereInput = {
    ...(q.type ? { type: q.type } : {}),
    ...(q.category ? { category: q.category } : {}),
    ...(q.savedBy ? { saves: { some: { profileId: q.savedBy } } } : {}),
    ...(search
      ? {
          OR: [
            { title: { contains: search, mode: "insensitive" } },
            { skeleton: { contains: search, mode: "insensitive" } },
            { category: { contains: search, mode: "insensitive" } },
            { tags: { has: search.toLowerCase() } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.template.findMany({ where, orderBy: [{ category: "asc" }, { title: "asc" }, { id: "asc" }], skip: q.offset ?? 0, take: q.limit ?? 50 }),
    prisma.template.count({ where }),
  ]);
  return { items, total };
}

export function getTemplateBySlug(slug: string): Promise<TemplateRow | null> {
  return prisma.template.findUnique({ where: { slug } });
}

export async function setTemplateSaved(profileId: string, templateId: string, saved: boolean): Promise<void> {
  if (saved) {
    await prisma.templateSave.upsert({ where: { profileId_templateId: { profileId, templateId } }, create: { profileId, templateId }, update: {} });
  } else {
    await prisma.templateSave.deleteMany({ where: { profileId, templateId } });
  }
}

export async function recordTemplateUse(input: { profileId: string; templateId: string; documentId: string | null; source: "auto" | "picked" }): Promise<void> {
  await prisma.templateUse.create({ data: input });
}

export function recentTemplateUses(profileId: string, limit: number): Promise<{ templateId: string; createdAt: Date }[]> {
  return prisma.templateUse.findMany({ where: { profileId }, orderBy: { createdAt: "desc" }, take: limit, select: { templateId: true, createdAt: true } });
}

/** Per template: the mean of `1 - editRatio` over this profile's uses that have a ratio (a lightly edited draft scores high). */
export async function templateScores(profileId: string): Promise<Map<string, number>> {
  const rows = await prisma.templateUse.groupBy({ by: ["templateId"], where: { profileId, editRatio: { not: null } }, _avg: { editRatio: true } });
  const scores = new Map<string, number>();
  for (const r of rows) scores.set(r.templateId, 1 - (r._avg.editRatio ?? 0.5));
  return scores;
}

/** Insert or refresh the shipped templates by slug. Never touches user-made rows. */
export async function upsertSystemTemplates(rows: SeedTemplate[]): Promise<number> {
  for (const r of rows) {
    await prisma.template.upsert({ where: { slug: r.slug }, create: { ...r, system: true }, update: { ...r, system: true } });
  }
  return rows.length;
}
