import { entryHttp } from "@/modules/entries/http";
import {
  registrationWorkspace,
  registrationCommand,
} from "@/modules/entries/registration";
export async function GET(r: Request) {
  return entryHttp(r, false, (id) => registrationWorkspace(id));
}
export async function POST(r: Request) {
  return entryHttp(r, true, async (id) =>
    registrationCommand(id, await r.json()),
  );
}
