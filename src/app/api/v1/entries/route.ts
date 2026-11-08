import { entryWorkspace, saveEntry } from "@/modules/entries/entries";
import { entryHttp } from "@/modules/entries/http";
export async function GET(r: Request) {
  return entryHttp(r, false, (userId) => entryWorkspace(userId));
}
export async function POST(r: Request) {
  return entryHttp(
    r,
    true,
    async (userId) => {
      const input = await r.json();
      return saveEntry(userId, input?.id, input, true);
    },
    201,
  );
}
