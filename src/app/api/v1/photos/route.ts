import { photoActor, photoFailure } from "@/modules/identity/photo-http";
import { photoWorkspace } from "@/modules/identity/photos";
export async function GET(request: Request) {
  try {
    return Response.json(await photoWorkspace((await photoActor(request)).id), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (e) {
    return photoFailure(e);
  }
}
