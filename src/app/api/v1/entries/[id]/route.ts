import { entryDetail, saveEntry } from "@/modules/entries/entries";
import { entryHttp } from "@/modules/entries/http";
type Context = { params: Promise<{ id: string }> };
export async function GET(r: Request, ctx: Context) {
  return entryHttp(r, false, async (userId) =>
    entryDetail(
      userId,
      (await ctx.params).id,
      new URL(r.url).searchParams.has("version")
        ? Number(new URL(r.url).searchParams.get("version"))
        : undefined,
    ),
  );
}
export async function POST(r: Request, ctx: Context) {
  return entryHttp(r, true, async (userId) =>
    saveEntry(userId, (await ctx.params).id, await r.json()),
  );
}
