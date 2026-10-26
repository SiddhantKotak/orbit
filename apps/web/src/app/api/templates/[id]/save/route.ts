import { setSavedHandler } from "@/lib/templates-api";

type Ctx = { params: Promise<{ id: string }> };

export async function PUT(_request: Request, { params }: Ctx) {
  return setSavedHandler((await params).id, true);
}

export async function DELETE(_request: Request, { params }: Ctx) {
  return setSavedHandler((await params).id, false);
}
