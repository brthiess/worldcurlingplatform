import {
  photoActor,
  photoBody,
  photoFailure,
} from "@/modules/identity/photo-http";
import { requirePhotoOwner, submitPhoto } from "@/modules/identity/photos";
export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const current = await photoActor(request, true),
      { id } = await params;
    await requirePhotoOwner(current.id, id);
    const bytes = await photoBody(request);
    return Response.json(
      await submitPhoto(
        current.id,
        id,
        request.headers.get("x-request-id") ?? "",
        bytes,
        request.headers.get("content-type") ?? "",
      ),
      { status: 201, headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    return photoFailure(e);
  }
}
