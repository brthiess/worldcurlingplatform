import { entryHttp } from "@/modules/entries/http";
import { importWorkspace, stageImport } from "@/modules/imports/staging";
export const GET = (r: Request) =>
  entryHttp(r, false, (actor) => {
    const q = new URL(r.url).searchParams;
    return importWorkspace(
      actor,
      q.get("job") ?? undefined,
      q.get("record") ?? undefined,
    );
  });
export const POST = (r: Request) =>
  entryHttp(r, true, async (actor) => stageImport(actor, await r.json()));
