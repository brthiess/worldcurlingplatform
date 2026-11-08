import {
  delegationWorkspace,
  delegationCommand,
} from "@/modules/identity/authority";
import { applicationHttp } from "@/modules/events/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return applicationHttp(request, false, delegationWorkspace);
}
export async function POST(request: Request) {
  return applicationHttp(request, true, async (userId) =>
    delegationCommand(userId, await request.json()),
  );
}
