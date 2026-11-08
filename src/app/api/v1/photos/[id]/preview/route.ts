import {
  photoActor,
  photoFailure,
  photoResponse,
} from "@/modules/identity/photo-http";
import { previewPhoto } from "@/modules/identity/photos";
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return photoResponse(
      await previewPhoto((await photoActor(request)).id, (await params).id),
    );
  } catch (e) {
    return photoFailure(e);
  }
}
