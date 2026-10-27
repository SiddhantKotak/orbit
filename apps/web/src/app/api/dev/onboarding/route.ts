import { revalidateTag } from "next/cache";
import { prisma } from "@brandloop/db";
import { ACCOUNT_CACHE_TAG, getAccount } from "@/lib/account";
import { devDbNameEnabled } from "@/lib/dev-db-name";

const E2E_NAME = "E2E onboarding";

/**
 * Dev-only (AI_MOCK_MODEL=1, never production), for e2e: puts the signed-in test user in a known onboarding state.
 *  - `fresh`: a new profile that has not been onboarded, made current (a stand-in for a new sign-up).
 *  - `reset`: deletes that profile and makes the user's oldest remaining profile current again.
 *  - `ready`: marks every one of the user's other profiles onboarded (a fresh test database creates its first one un-onboarded).
 */
export async function POST(request: Request) {
  if (!devDbNameEnabled()) return new Response("Not found", { status: 404 });
  const { mode } = (await request.json().catch(() => ({}))) as { mode?: string };
  const account = await getAccount();
  const userId = account.user.id;

  if (mode === "ready") {
    await prisma.profile.updateMany({ where: { ownerUserId: userId, NOT: { name: E2E_NAME } }, data: { onboardingCompleted: true } });
  } else if (mode === "fresh" || mode === "reset") {
    await prisma.profile.deleteMany({ where: { ownerUserId: userId, name: E2E_NAME } });
    const base = await prisma.profile.findFirst({ where: { ownerUserId: userId, deletedAt: null }, orderBy: { createdAt: "asc" } });
    if (mode === "fresh") {
      const created = await prisma.profile.create({ data: { teamId: base!.teamId, ownerUserId: userId, name: E2E_NAME } });
      await prisma.user.update({ where: { id: userId }, data: { currentProfileId: created.id } });
    } else {
      await prisma.user.update({ where: { id: userId }, data: { currentProfileId: base?.id ?? null } });
    }
  } else {
    return Response.json({ error: "mode must be fresh, reset or ready" }, { status: 400 });
  }
  revalidateTag(ACCOUNT_CACHE_TAG, { expire: 0 });
  return Response.json({ ok: true });
}
