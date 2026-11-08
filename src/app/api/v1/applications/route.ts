import {
  applicationCommand,
  applicationWorkspace,
} from "@/modules/events/applications";
import { applicationHttp } from "@/modules/events/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return applicationHttp(request, false, (userId) =>
    applicationWorkspace(userId),
  );
}
export async function POST(request: Request) {
  return applicationHttp(
    request,
    true,
    async (userId) => {
      const input = await request.json();
      return applicationCommand(userId, input?.id, input, true);
    },
    201,
  );
}
