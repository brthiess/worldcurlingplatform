import { entryHttp } from "@/modules/entries/http";
import { rankingWorkspace, saveRankingInput } from "@/modules/rankings/inputs";
import { positiveVersion } from "@/domain/ranking-inputs";
export async function GET(r: Request) {
  return entryHttp(r, false, (userId) => {
    const p = new URL(r.url).searchParams;
    return rankingWorkspace(
      userId,
      p.get("id") ?? undefined,
      p.has("version") ? positiveVersion(Number(p.get("version"))) : undefined,
    );
  });
}
export async function POST(r: Request) {
  return entryHttp(r, true, async (userId) =>
    saveRankingInput(userId, await r.json()),
  );
}
