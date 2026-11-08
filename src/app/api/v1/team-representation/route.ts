import {
  representationCommand,
  representationWorkspace,
} from "@/modules/identity/representation";
import { entryHttp } from "@/modules/entries/http";
export async function GET(r: Request) {
  return entryHttp(r, false, representationWorkspace);
}
export async function POST(r: Request) {
  return entryHttp(r, true, async (userId) =>
    representationCommand(userId, await r.json()),
  );
}
