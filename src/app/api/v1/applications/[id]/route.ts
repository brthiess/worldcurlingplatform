import {
  applicationCommand,
  applicationDetail,
} from "@/modules/events/applications";
import { applicationHttp } from "@/modules/events/http";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return applicationHttp(request, false, async (userId) =>
    applicationDetail(userId, (await context.params).id),
  );
}
export async function POST(request: Request, context: Context) {
  return applicationHttp(request, true, async (userId) =>
    applicationCommand(userId, (await context.params).id, await request.json()),
  );
}
