import { entryHttp } from "@/modules/entries/http";
import {
  correctionWorkspace,
  correctIdentity,
} from "@/modules/entries/identity-corrections";
export async function GET(r: Request) {
  return entryHttp(r, false, (userId) =>
    correctionWorkspace(
      userId,
      new URL(r.url).searchParams.get("requestId") ?? undefined,
    ),
  );
}
export async function POST(r: Request) {
  return entryHttp(r, true, async (userId) =>
    correctIdentity(userId, await r.text()),
  );
}
