import { reviewClaim } from "@/modules/identity/profiles";
import { profileCommand } from "@/modules/identity/profile-http";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return profileCommand(request, (user, value) => reviewClaim(user, id, value));
}
