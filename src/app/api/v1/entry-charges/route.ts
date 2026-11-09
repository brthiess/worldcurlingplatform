import { entryHttp } from "@/modules/entries/http";
import { chargeWorkspace, chargeCommand } from "@/modules/payments/charges";
export async function GET(r: Request) {
  return entryHttp(r, false, (id) => chargeWorkspace(id));
}
export async function POST(r: Request) {
  return entryHttp(r, true, async (id) => chargeCommand(id, await r.json()));
}
