import { NextResponse } from "next/server";
import { z } from "zod";
import { listStyleVersions, restoreStyleVersion } from "@brandloop/db";
import { getAccount } from "@/lib/account";

type Ctx = { params: Promise<{ id: string }> };

/** The own style's kept versions, newest first. A preset or someone else's style is a 404. */
export async function GET(_request: Request, ctx: Ctx) {
  const { currentProfile } = await getAccount();
  if (!currentProfile) return NextResponse.json({ error: "Create a profile first" }, { status: 400 });
  const versions = await listStyleVersions(currentProfile.id, (await ctx.params).id);
  return versions ? NextResponse.json({ versions }) : NextResponse.json({ error: "Writing style not found" }, { status: 404 });
}

/** `{version}`: saves that earlier version again as the newest one (Revert). */
export async function POST(request: Request, ctx: Ctx) {
  const { currentProfile } = await getAccount();
  if (!currentProfile) return NextResponse.json({ error: "Create a profile first" }, { status: 400 });
  const parsed = z.object({ version: z.number().int().min(1) }).safeParse(await request.json().catch(() => undefined));
  if (!parsed.success) return NextResponse.json({ error: "Send the version to restore." }, { status: 400 });
  try {
    return NextResponse.json(await restoreStyleVersion(currentProfile.id, (await ctx.params).id, parsed.data.version));
  } catch (err) {
    const message = err instanceof Error ? err.message : "Couldn't restore";
    return NextResponse.json({ error: message }, { status: /no longer kept/.test(message) ? 409 : /not found/i.test(message) ? 404 : 400 });
  }
}
