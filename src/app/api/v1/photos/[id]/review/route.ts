import { profileCommand } from "@/modules/identity/profile-http";
import { reviewPhoto } from "@/modules/identity/photos";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  return profileCommand(request, (userId, value) =>
    reviewPhoto(userId, id, value),
  );
}
