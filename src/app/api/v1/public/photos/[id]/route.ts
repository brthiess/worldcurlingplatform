import { photoFailure, photoResponse } from "@/modules/identity/photo-http";
import { publicPhoto } from "@/modules/identity/photos";
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    return photoResponse(await publicPhoto((await params).id));
  } catch (e) {
    return photoFailure(e);
  }
}
