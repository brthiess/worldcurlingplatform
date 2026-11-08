import { staffCommand, staffWorkspace } from "@/modules/identity/staff";
import { applicationHttp } from "@/modules/events/http";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return applicationHttp(request, false, staffWorkspace);
}
export async function POST(request: Request) {
  let action = "grant";
  const response = await applicationHttp(
    request,
    true,
    async (userId) => {
      const input = await request.json();
      action = input?.action ?? "grant";
      return staffCommand(userId, input);
    },
    201,
  );
  return response.status === 201 && action === "revoke"
    ? new Response(response.body, { status: 200, headers: response.headers })
    : response;
}
