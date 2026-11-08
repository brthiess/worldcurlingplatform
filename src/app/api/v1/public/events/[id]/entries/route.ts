import { publicEventEntries } from "@/modules/entries/entries";
export async function GET(
  _r: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  return Response.json(await publicEventEntries((await ctx.params).id), {
    headers: { "Cache-Control": "no-store" },
  });
}
